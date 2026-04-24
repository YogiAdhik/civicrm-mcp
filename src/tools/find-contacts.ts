import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const InputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Free-text search; matches display_name, first_name, last_name, or primary email."),
  limit: z.number().int().min(1).max(100).default(25),
});

interface ContactRow {
  id: number;
  display_name: string;
  first_name?: string;
  last_name?: string;
  contact_type?: string;
  "email_primary.email"?: string;
  "phone_primary.phone"?: string;
}

export const findContactsTool: ToolDefinition<typeof InputSchema> = {
  name: "civicrm_find_contacts",
  title: "Find contacts",
  description:
    "Search CiviCRM contacts by name or primary email. Returns id, display name, type, primary email and phone.",
  inputSchema: InputSchema,
  async handler({ query, limit }, { client }) {
    const like = `%${query}%`;
    const res = await client.api4<ContactRow>("Contact", "get", {
      select: [
        "id",
        "display_name",
        "first_name",
        "last_name",
        "contact_type",
        "email_primary.email",
        "phone_primary.phone",
      ],
      where: [
        [
          "OR",
          [
            ["display_name", "LIKE", like],
            ["first_name", "LIKE", like],
            ["last_name", "LIKE", like],
            ["email_primary.email", "LIKE", like],
          ],
        ],
      ],
      orderBy: { sort_name: "ASC" },
      limit,
    });

    if (res.values.length === 0) {
      return textResult(`No contacts matched "${query}".`);
    }

    const lines = res.values.map((c) => {
      const email = c["email_primary.email"] ?? "";
      const phone = c["phone_primary.phone"] ?? "";
      const bits = [email, phone].filter(Boolean).join(" · ");
      return `#${c.id}  ${c.display_name}${c.contact_type ? ` (${c.contact_type})` : ""}${bits ? ` — ${bits}` : ""}`;
    });
    return textResult(
      `Found ${res.values.length} contact(s):\n${lines.join("\n")}`,
      { count: res.values.length, values: res.values },
    );
  },
};
