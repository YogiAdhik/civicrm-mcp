import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const InputSchema = z.object({
  filter: z
    .string()
    .optional()
    .describe("Optional case-insensitive substring to filter entity names, e.g. 'contrib'."),
});

interface EntityRow {
  name: string;
  title?: string;
  title_plural?: string;
  description?: string;
  type?: string[];
}

export const listEntitiesTool: ToolDefinition<typeof InputSchema> = {
  name: "civicrm_list_entities",
  title: "List APIv4 entities",
  description:
    "List all CiviCRM APIv4 entities available on this install (including those added by extensions). Optional substring filter.",
  inputSchema: InputSchema,
  async handler({ filter }, { client }) {
    const res = await client.api4<EntityRow>("Entity", "get", {
      select: ["name", "title", "title_plural", "description", "type"],
      orderBy: { name: "ASC" },
    });

    const needle = filter?.toLowerCase();
    const rows = needle
      ? res.values.filter(
          (e) =>
            e.name.toLowerCase().includes(needle) ||
            (e.title ?? "").toLowerCase().includes(needle),
        )
      : res.values;

    if (rows.length === 0) {
      return textResult(`No entities${filter ? ` matched "${filter}"` : ""}.`);
    }

    const lines = rows.map((e) => {
      const title = e.title && e.title !== e.name ? ` — ${e.title}` : "";
      return `${e.name}${title}`;
    });
    return textResult(
      `${rows.length} entit${rows.length === 1 ? "y" : "ies"}${
        filter ? ` matching "${filter}"` : ""
      }:\n${lines.join("\n")}`,
      { count: rows.length, values: rows },
    );
  },
};
