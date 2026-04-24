import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const InputSchema = z.object({
  contact_id: z.number().int().positive().optional().describe("Filter by donor contact id."),
  since: z
    .string()
    .optional()
    .describe("ISO date/datetime lower bound for receive_date, e.g. '2026-01-01'."),
  until: z
    .string()
    .optional()
    .describe("ISO date/datetime upper bound for receive_date."),
  status: z
    .string()
    .optional()
    .describe("Contribution status name, e.g. 'Completed', 'Pending', 'Failed', 'Refunded'."),
  financial_type: z
    .string()
    .optional()
    .describe("Financial type name, e.g. 'Donation', 'Member Dues', 'Event Fee'."),
  limit: z.number().int().min(1).max(200).default(50),
});

interface ContributionRow {
  id: number;
  contact_id: number;
  "contact_id.display_name"?: string;
  total_amount: number;
  currency: string;
  "financial_type_id:label"?: string;
  "contribution_status_id:label"?: string;
  "payment_instrument_id:label"?: string;
  receive_date?: string;
  source?: string;
  trxn_id?: string;
}

export const getContributionsTool: ToolDefinition<typeof InputSchema> = {
  name: "civicrm_get_contributions",
  title: "Get contributions",
  description:
    "List contributions (donations, dues, event fees) with optional filters by contact, date window, status, and financial type. Resolves donor display name and human-readable status labels.",
  inputSchema: InputSchema,
  async handler(args, { client }) {
    const where: unknown[][] = [];
    if (args.contact_id) where.push(["contact_id", "=", args.contact_id]);
    if (args.since) where.push(["receive_date", ">=", args.since]);
    if (args.until) where.push(["receive_date", "<=", args.until]);
    if (args.status) where.push(["contribution_status_id:name", "=", args.status]);
    if (args.financial_type) where.push(["financial_type_id:name", "=", args.financial_type]);

    const res = await client.api4<ContributionRow>("Contribution", "get", {
      select: [
        "id",
        "contact_id",
        "contact_id.display_name",
        "total_amount",
        "currency",
        "financial_type_id:label",
        "contribution_status_id:label",
        "payment_instrument_id:label",
        "receive_date",
        "source",
        "trxn_id",
      ],
      where,
      orderBy: { receive_date: "DESC" },
      limit: args.limit,
    });

    if (res.values.length === 0) {
      return textResult("No contributions matched the filters.");
    }

    const total = res.values.reduce((sum, c) => sum + Number(c.total_amount ?? 0), 0);
    const lines = res.values.map((c) => {
      const date = c.receive_date ? c.receive_date.slice(0, 10) : "(no date)";
      const donor = c["contact_id.display_name"] ?? `#${c.contact_id}`;
      const type = c["financial_type_id:label"] ?? "?";
      const status = c["contribution_status_id:label"] ?? "?";
      return `${date}  ${c.currency} ${Number(c.total_amount).toFixed(2)}  ${donor}  [${type} · ${status}]`;
    });

    return textResult(
      `${res.values.length} contribution(s), sum ≈ ${total.toFixed(2)}:\n${lines.join("\n")}`,
      { count: res.values.length, total, values: res.values },
    );
  },
};
