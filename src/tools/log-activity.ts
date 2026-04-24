import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const InputSchema = z.object({
  target_contact_id: z
    .number()
    .int()
    .positive()
    .describe("Primary contact the activity is about (target)."),
  activity_type: z
    .string()
    .describe(
      "Activity type name (machine label), e.g. 'Phone Call', 'Meeting', 'Email', or a custom type. Use civicrm_api4 OptionValue.get option_group='activity_type' to list.",
    ),
  subject: z.string().min(1).describe("Short subject line for the activity."),
  details: z.string().optional().describe("Long-form activity body (HTML allowed)."),
  status: z
    .string()
    .default("Completed")
    .describe("Activity status name, e.g. Completed, Scheduled, Cancelled."),
  activity_date: z
    .string()
    .optional()
    .describe("ISO-8601 datetime, e.g. '2026-04-23 14:30:00'. Defaults to now."),
  source_contact_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Contact recorded as the author of the activity. Defaults to the API user."),
  assignee_contact_id: z.number().int().positive().optional(),
});

export const logActivityTool: ToolDefinition<typeof InputSchema> = {
  name: "civicrm_log_activity",
  title: "Log activity",
  description:
    "Record an Activity against a target contact. Requires CIVICRM_ALLOW_WRITES=true.",
  inputSchema: InputSchema,
  async handler(args, { client }) {
    const values: Record<string, unknown> = {
      "activity_type_id:name": args.activity_type,
      subject: args.subject,
      "status_id:name": args.status,
      target_contact_id: [args.target_contact_id],
    };
    if (args.details) values.details = args.details;
    if (args.activity_date) values.activity_date_time = args.activity_date;
    if (args.source_contact_id) values.source_contact_id = args.source_contact_id;
    if (args.assignee_contact_id) {
      values.assignee_contact_id = [args.assignee_contact_id];
    }

    const res = await client.api4<{ id: number }>("Activity", "create", { values });
    const created = res.values[0];
    if (!created) return textResult("Activity.create returned no rows.");
    return textResult(
      `Logged activity #${created.id} (${args.activity_type}) against contact #${args.target_contact_id}.`,
      created,
    );
  },
};
