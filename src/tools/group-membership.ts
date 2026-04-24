import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const AddInput = z.object({
  contact_id: z.number().int().positive(),
  group_id: z.number().int().positive().describe("CiviCRM group id (not title)."),
});

const RemoveInput = AddInput;

export const addToGroupTool: ToolDefinition<typeof AddInput> = {
  name: "civicrm_add_to_group",
  title: "Add contact to group",
  description:
    "Add a contact to a group (GroupContact status='Added'). Idempotent — updates an existing row rather than creating duplicates. Requires CIVICRM_ALLOW_WRITES=true.",
  inputSchema: AddInput,
  async handler({ contact_id, group_id }, { client }) {
    const res = await client.api4<{ id: number; status: string }>(
      "GroupContact",
      "save",
      {
        records: [{ contact_id, group_id, status: "Added" }],
        match: ["contact_id", "group_id"],
      },
    );
    const row = res.values[0];
    return textResult(
      row
        ? `Contact #${contact_id} added to group #${group_id} (GroupContact #${row.id}).`
        : `GroupContact.save returned no rows.`,
      row,
    );
  },
};

export const removeFromGroupTool: ToolDefinition<typeof RemoveInput> = {
  name: "civicrm_remove_from_group",
  title: "Remove contact from group",
  description:
    "Mark a contact as Removed from a group (GroupContact status='Removed'). Preserves history — does not hard-delete. Requires CIVICRM_ALLOW_WRITES=true.",
  inputSchema: RemoveInput,
  async handler({ contact_id, group_id }, { client }) {
    const res = await client.api4<{ id: number; status: string }>(
      "GroupContact",
      "save",
      {
        records: [{ contact_id, group_id, status: "Removed" }],
        match: ["contact_id", "group_id"],
      },
    );
    const row = res.values[0];
    return textResult(
      row
        ? `Contact #${contact_id} removed from group #${group_id}.`
        : `GroupContact.save returned no rows.`,
      row,
    );
  },
};
