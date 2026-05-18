import { z } from "zod";
import type { CivicrmClient } from "../civicrm/client.js";
import { textResult, type ToolDefinition } from "./types.js";

const TagInput = z.object({
  contact_ids: z
    .array(z.number().int().positive())
    .min(1)
    .max(500)
    .describe("Contact ids to tag. Bounded at 500 per call to keep one request bounded; chunk larger sets in the caller."),
  tag: z
    .union([z.number().int().positive(), z.string().min(1)])
    .describe("Tag id (number) or tag name (string). Names are resolved to ids on the fly."),
});

const UntagInput = TagInput;

export const tagContactsTool: ToolDefinition<typeof TagInput> = {
  name: "civicrm_tag_contacts",
  title: "Tag contacts",
  description:
    "Add a tag to one or more contacts in a single call. Idempotent — re-tagging an already-tagged contact is a no-op. Requires CIVICRM_ALLOW_WRITES=true.",
  inputSchema: TagInput,
  async handler({ contact_ids, tag }, { client }) {
    const tagId = await resolveTagId(tag, client);
    const records = contact_ids.map((contact_id) => ({
      entity_table: "civicrm_contact",
      entity_id: contact_id,
      tag_id: tagId,
    }));
    const res = await client.api4<{ id: number }>("EntityTag", "save", {
      records,
      match: ["entity_table", "entity_id", "tag_id"],
    });
    return textResult(
      `Tagged ${res.values.length}/${contact_ids.length} contacts with tag #${tagId}.`,
      { tag_id: tagId, results: res.values },
    );
  },
};

export const untagContactsTool: ToolDefinition<typeof UntagInput> = {
  name: "civicrm_untag_contacts",
  title: "Untag contacts",
  description:
    "Remove a tag from one or more contacts in a single call. Requires CIVICRM_ALLOW_WRITES=true AND CIVICRM_ALLOW_DELETES=true (EntityTag rows are hard-deleted).",
  inputSchema: UntagInput,
  async handler({ contact_ids, tag }, { client }) {
    const tagId = await resolveTagId(tag, client);
    const res = await client.api4<{ id: number }>("EntityTag", "delete", {
      where: [
        ["entity_table", "=", "civicrm_contact"],
        ["entity_id", "IN", contact_ids],
        ["tag_id", "=", tagId],
      ],
    });
    return textResult(
      `Removed tag #${tagId} from ${res.values.length} contact(s).`,
      { tag_id: tagId, deleted: res.values },
    );
  },
};

async function resolveTagId(tag: number | string, client: CivicrmClient): Promise<number> {
  if (typeof tag === "number") return tag;
  const res = await client.api4<{ id: number }>("Tag", "get", {
    select: ["id"],
    where: [["name", "=", tag]],
    limit: 1,
  });
  if (!res.values[0]) {
    throw new Error(
      `No tag found with name "${tag}". Pass a numeric id, or create the tag first via the CiviCRM UI / civicrm_api4.`,
    );
  }
  return res.values[0].id;
}
