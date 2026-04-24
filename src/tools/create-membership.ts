import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const InputSchema = z.object({
  contact_id: z.number().int().positive(),
  membership_type: z
    .string()
    .describe("Membership type name, e.g. 'General', 'Student', 'Lifetime'."),
  status: z
    .string()
    .default("New")
    .describe("Membership status name, e.g. 'New', 'Current', 'Grace', 'Expired'."),
  join_date: z
    .string()
    .optional()
    .describe("ISO date (YYYY-MM-DD). Defaults to today."),
  start_date: z
    .string()
    .optional()
    .describe("ISO date. If omitted, CiviCRM calculates from the type's duration."),
  end_date: z
    .string()
    .optional()
    .describe("ISO date. If omitted, CiviCRM calculates from the type's duration."),
  source: z.string().optional(),
  extra: z.record(z.unknown()).optional(),
});

export const createMembershipTool: ToolDefinition<typeof InputSchema> = {
  name: "civicrm_create_membership",
  title: "Create membership",
  description:
    "Create a Membership record for a contact. CiviCRM will auto-calculate start/end dates from the membership type's duration if omitted. Requires CIVICRM_ALLOW_WRITES=true.",
  inputSchema: InputSchema,
  async handler(args, { client }) {
    const values: Record<string, unknown> = {
      contact_id: args.contact_id,
      "membership_type_id:name": args.membership_type,
      "status_id:name": args.status,
      ...(args.join_date ? { join_date: args.join_date } : {}),
      ...(args.start_date ? { start_date: args.start_date } : {}),
      ...(args.end_date ? { end_date: args.end_date } : {}),
      ...(args.source ? { source: args.source } : {}),
      ...(args.extra ?? {}),
    };
    const res = await client.api4<{ id: number }>("Membership", "create", { values });
    const row = res.values[0];
    if (!row) return textResult("Membership.create returned no rows.");
    return textResult(
      `Created Membership #${row.id} (${args.membership_type}) for contact #${args.contact_id}.`,
      row,
    );
  },
};
