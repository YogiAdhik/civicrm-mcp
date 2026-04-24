import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const InputSchema = z.object({
  contact_id: z.number().int().positive().describe("Donor contact id."),
  total_amount: z.number().positive().describe("Contribution amount (major units, e.g. 50.00)."),
  currency: z.string().length(3).default("USD"),
  financial_type: z
    .string()
    .default("Donation")
    .describe("Financial type name, e.g. Donation, Member Dues, Event Fee."),
  contribution_status: z
    .string()
    .default("Completed")
    .describe("Status name, e.g. Completed, Pending, Failed, Refunded."),
  payment_instrument: z
    .string()
    .optional()
    .describe("Payment instrument name, e.g. 'Check', 'Credit Card', 'Cash', 'EFT'."),
  receive_date: z
    .string()
    .optional()
    .describe("ISO-8601 datetime; defaults to now."),
  source: z.string().optional().describe("Free-text source/provenance, e.g. 'spring appeal'."),
  trxn_id: z
    .string()
    .optional()
    .describe("External transaction id (processor reference). Must be unique per site."),
  is_test: z.boolean().default(false),
  extra: z.record(z.unknown()).optional(),
});

export const recordContributionTool: ToolDefinition<typeof InputSchema> = {
  name: "civicrm_record_contribution",
  title: "Record contribution",
  description:
    "Record a donation / contribution for a contact. Requires CIVICRM_ALLOW_WRITES=true.",
  inputSchema: InputSchema,
  async handler(args, { client }) {
    const values: Record<string, unknown> = {
      contact_id: args.contact_id,
      total_amount: args.total_amount,
      currency: args.currency,
      "financial_type_id:name": args.financial_type,
      "contribution_status_id:name": args.contribution_status,
      is_test: args.is_test,
      ...(args.payment_instrument
        ? { "payment_instrument_id:name": args.payment_instrument }
        : {}),
      ...(args.receive_date ? { receive_date: args.receive_date } : {}),
      ...(args.source ? { source: args.source } : {}),
      ...(args.trxn_id ? { trxn_id: args.trxn_id } : {}),
      ...(args.extra ?? {}),
    };

    const res = await client.api4<{ id: number }>("Contribution", "create", { values });
    const created = res.values[0];
    if (!created) return textResult("Contribution.create returned no rows.");
    return textResult(
      `Recorded ${args.currency} ${args.total_amount.toFixed(2)} ` +
        `from contact #${args.contact_id} (Contribution #${created.id}).`,
      created,
    );
  },
};
