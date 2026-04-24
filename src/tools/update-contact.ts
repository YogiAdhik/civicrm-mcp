import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const InputSchema = z.object({
  id: z.number().int().positive().describe("Contact id to update."),
  values: z
    .record(z.unknown())
    .describe(
      "APIv4 field → value map. Use dot-notation for custom fields, e.g. 'CustomGroup.field_name'.",
    ),
});

export const updateContactTool: ToolDefinition<typeof InputSchema> = {
  name: "civicrm_update_contact",
  title: "Update contact",
  description:
    "Update fields on a single CiviCRM contact by id. Requires CIVICRM_ALLOW_WRITES=true.",
  inputSchema: InputSchema,
  async handler({ id, values }, { client }) {
    if (Object.keys(values).length === 0) {
      return textResult("No values supplied; nothing to update.");
    }
    const res = await client.api4<{ id: number }>("Contact", "update", {
      where: [["id", "=", id]],
      values,
      limit: 1,
    });
    const updated = res.values[0];
    if (!updated) {
      return textResult(`No contact matched id ${id}.`);
    }
    return textResult(
      `Updated contact #${updated.id} — ${Object.keys(values).length} field(s) changed.`,
      updated,
    );
  },
};
