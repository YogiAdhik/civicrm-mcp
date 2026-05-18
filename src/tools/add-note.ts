import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const InputSchema = z.object({
  entity: z
    .enum(["Contact", "Contribution", "Activity", "Case", "Relationship"])
    .default("Contact")
    .describe("Entity the note attaches to. CiviCRM's Note table supports contacts plus several other entity tables."),
  entity_id: z.number().int().positive().describe("Id of the entity the note is about."),
  subject: z
    .string()
    .max(255)
    .optional()
    .describe("Short subject line (≤255 chars)."),
  note: z.string().min(1).describe("Free-text note body. Plain text or HTML."),
  privacy: z
    .enum(["public", "private"])
    .default("public")
    .describe("Visibility flag stored on the note record."),
});

export const addNoteTool: ToolDefinition<typeof InputSchema> = {
  name: "civicrm_add_note",
  title: "Add note",
  description:
    "Attach a free-text Note to a contact, contribution, activity, case, or relationship. Requires CIVICRM_ALLOW_WRITES=true. Notes are the right place for unstructured context that doesn't belong in a custom field.",
  inputSchema: InputSchema,
  async handler(args, { client }) {
    const entityTable = entityToTable(args.entity);
    const values: Record<string, unknown> = {
      entity_table: entityTable,
      entity_id: args.entity_id,
      note: args.note,
      privacy: args.privacy === "private" ? 1 : 0,
    };
    if (args.subject) values.subject = args.subject;

    const res = await client.api4<{ id: number }>("Note", "create", { values });
    const created = res.values[0];
    if (!created) return textResult("Note.create returned no rows.");
    return textResult(
      `Added note #${created.id} on ${args.entity} #${args.entity_id}.`,
      created,
    );
  },
};

function entityToTable(entity: string): string {
  switch (entity) {
    case "Contact":
      return "civicrm_contact";
    case "Contribution":
      return "civicrm_contribution";
    case "Activity":
      return "civicrm_activity";
    case "Case":
      return "civicrm_case";
    case "Relationship":
      return "civicrm_relationship";
    default:
      return `civicrm_${entity.toLowerCase()}`;
  }
}
