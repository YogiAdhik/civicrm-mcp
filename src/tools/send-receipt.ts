import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const InputSchema = z.object({
  contribution_id: z
    .number()
    .int()
    .positive()
    .describe("Id of the contribution to send a receipt for."),
  from_email_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Optional id of the OptionValue / SiteEmailAddress to send from. Defaults to the default 'from' address configured in CiviCRM.",
    ),
  cc: z.string().email().optional().describe("Optional CC address."),
  bcc: z.string().email().optional().describe("Optional BCC address."),
  receipt_text: z
    .string()
    .optional()
    .describe("Override the receipt body. Omit to use the configured contribution-page receipt template."),
});

export const sendReceiptTool: ToolDefinition<typeof InputSchema> = {
  name: "civicrm_send_contribution_receipt",
  title: "Send contribution receipt",
  description:
    "Send (or re-send) the standard receipt email for a contribution. Wraps Contribution.sendconfirmation. Requires CIVICRM_ALLOW_WRITES=true because the call triggers an outbound email.",
  inputSchema: InputSchema,
  async handler(args, { client }) {
    const params: Record<string, unknown> = {
      where: [["id", "=", args.contribution_id]],
    };
    if (args.from_email_id) params.from_email_address_id = args.from_email_id;
    if (args.cc) params.cc_receipt = args.cc;
    if (args.bcc) params.bcc_receipt = args.bcc;
    if (args.receipt_text) params.receipt_text = args.receipt_text;

    // The action name differs between major versions: 6.x has `sendReceipt`,
    // earlier 5.x lines exposed `sendconfirmation`. We try the modern name
    // first and fall back to the legacy one if the action isn't found.
    let action = "sendReceipt";
    try {
      const res = await client.api4<{ id: number }>("Contribution", action, params);
      return textResult(
        `Triggered receipt for contribution #${args.contribution_id} via ${action}.`,
        { contribution_id: args.contribution_id, action, result: res.values },
      );
    } catch (err) {
      const msg = (err as Error).message ?? "";
      if (!/action|not found|invalid/i.test(msg)) throw err;
      action = "sendconfirmation";
      const res = await client.api4<{ id: number }>("Contribution", action, params);
      return textResult(
        `Triggered receipt for contribution #${args.contribution_id} via ${action} (legacy action).`,
        { contribution_id: args.contribution_id, action, result: res.values },
      );
    }
  },
};
