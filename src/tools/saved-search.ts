import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

// SavedSearch + SearchDisplay are the SearchKit primitives that let an admin
// build a query in the CiviCRM UI and have it run reproducibly. Exposing them
// to an agent is far safer (and far cheaper in tokens) than asking the agent
// to hand-author APIv4 where-clauses.

const ListInput = z.object({
  query: z
    .string()
    .optional()
    .describe("Optional substring to filter on the saved search name or label."),
  limit: z.number().int().positive().max(200).default(50),
});

interface SavedSearchRow {
  id: number;
  name: string;
  label?: string;
  description?: string;
  api_entity?: string;
  display_count?: number;
}

export const listSavedSearchesTool: ToolDefinition<typeof ListInput> = {
  name: "civicrm_list_saved_searches",
  title: "List saved searches",
  description:
    "List SavedSearch records (the SearchKit queries an admin has built in the UI). Use this to discover what's available to run via civicrm_run_saved_search.",
  inputSchema: ListInput,
  async handler({ query, limit }, { client }) {
    const where: Array<Array<unknown>> = [];
    if (query) {
      where.push(["OR", [["name", "LIKE", `%${query}%`], ["label", "LIKE", `%${query}%`]]]);
    }
    const res = await client.api4<SavedSearchRow>("SavedSearch", "get", {
      select: ["id", "name", "label", "description", "api_entity"],
      where,
      orderBy: { name: "ASC" },
      limit,
    });
    if (res.values.length === 0) {
      return textResult(
        query
          ? `No saved searches match "${query}".`
          : "No saved searches found. Create one in the CiviCRM UI under Search → Search Builder → Save.",
      );
    }
    const lines = [
      `${res.values.length} saved search${res.values.length === 1 ? "" : "es"}:`,
      "",
      ...res.values.map(
        (s) =>
          `  ${s.name}${s.label && s.label !== s.name ? ` (${s.label})` : ""} → ${s.api_entity ?? "?"}${s.description ? "\n      " + s.description : ""}`,
      ),
    ];
    return textResult(lines.join("\n"), res.values);
  },
};

const RunInput = z.object({
  search: z
    .union([z.string().min(1), z.number().int().positive()])
    .describe("SavedSearch name (string) or id (number)."),
  display: z
    .string()
    .optional()
    .describe(
      "Optional SearchDisplay name to render with. Defaults to the search's default display (same name as the saved search).",
    ),
  limit: z.number().int().positive().max(500).default(50),
  offset: z.number().int().nonnegative().default(0),
  filters: z
    .record(z.unknown())
    .optional()
    .describe(
      "Optional filter values to apply (matches the display's filter inputs). Pass `{}` if the display has no filters.",
    ),
});

interface DisplayRunResult {
  count?: number;
  // SearchDisplay.run returns rows whose shape depends on the display's
  // column definitions — opaque to us, pass-through to the agent.
  values?: Array<Record<string, unknown>>;
}

export const runSavedSearchTool: ToolDefinition<typeof RunInput> = {
  name: "civicrm_run_saved_search",
  title: "Run saved search",
  description:
    "Execute a SavedSearch and return its rows via SearchDisplay.run. Pair with civicrm_list_saved_searches to discover available searches. This is the safest and cheapest way to run complex queries — the admin curates the query in the UI, the agent just calls it by name.",
  inputSchema: RunInput,
  async handler({ search, display, limit, offset, filters }, { client }) {
    let savedSearchName: string;
    if (typeof search === "number") {
      const found = await client.api4<{ name: string }>("SavedSearch", "get", {
        select: ["name"],
        where: [["id", "=", search]],
        limit: 1,
      });
      if (!found.values[0]) {
        return textResult(`SavedSearch #${search} not found.`);
      }
      savedSearchName = found.values[0].name;
    } else {
      savedSearchName = search;
    }
    const displayName = display ?? savedSearchName;

    const res = (await client.api4("SearchDisplay", "run", {
      savedSearch: savedSearchName,
      display: displayName,
      filters: filters ?? {},
      limit,
      offset,
      return: "page:1",
    })) as unknown as DisplayRunResult;

    const rows = res.values ?? [];
    const head = `${savedSearchName} → ${displayName} — ${rows.length} row${rows.length === 1 ? "" : "s"}${typeof res.count === "number" ? ` (total ${res.count})` : ""}`;
    if (rows.length === 0) {
      return textResult(`${head}\n(no results)`);
    }
    return textResult(
      `${head}\n\n${JSON.stringify(rows, null, 2)}`,
      { search: savedSearchName, display: displayName, count: res.count, values: rows },
    );
  },
};
