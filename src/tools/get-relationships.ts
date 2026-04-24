import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const InputSchema = z.object({
  contact_id: z.number().int().positive().describe("Contact whose relationships to fetch."),
  active_only: z
    .boolean()
    .default(true)
    .describe("Only return relationships where is_active=true."),
  limit: z.number().int().min(1).max(200).default(50),
});

interface RelationshipRow {
  id: number;
  "relationship_type_id:label"?: string;
  "relationship_type_id.name_a_b"?: string;
  "relationship_type_id.name_b_a"?: string;
  contact_id_a: number;
  contact_id_b: number;
  "contact_id_a.display_name"?: string;
  "contact_id_b.display_name"?: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  description?: string;
}

export const getRelationshipsTool: ToolDefinition<typeof InputSchema> = {
  name: "civicrm_get_relationships",
  title: "Get relationships",
  description:
    "List relationships (family, employer, membership, custom types) for a contact. Resolves the other party's display name and direction automatically.",
  inputSchema: InputSchema,
  async handler({ contact_id, active_only, limit }, { client }) {
    const where: unknown[][] = [
      [
        "OR",
        [
          ["contact_id_a", "=", contact_id],
          ["contact_id_b", "=", contact_id],
        ],
      ],
    ];
    if (active_only) where.push(["is_active", "=", true]);

    const res = await client.api4<RelationshipRow>("Relationship", "get", {
      select: [
        "id",
        "contact_id_a",
        "contact_id_b",
        "contact_id_a.display_name",
        "contact_id_b.display_name",
        "relationship_type_id:label",
        "relationship_type_id.name_a_b",
        "relationship_type_id.name_b_a",
        "start_date",
        "end_date",
        "is_active",
        "description",
      ],
      where,
      orderBy: { start_date: "DESC" },
      limit,
    });

    if (res.values.length === 0) {
      return textResult(
        `Contact #${contact_id} has no${active_only ? " active" : ""} relationships.`,
      );
    }

    const lines = res.values.map((r) => {
      const weAreA = r.contact_id_a === contact_id;
      const role = weAreA
        ? r["relationship_type_id.name_a_b"] ?? r["relationship_type_id:label"] ?? "?"
        : r["relationship_type_id.name_b_a"] ?? r["relationship_type_id:label"] ?? "?";
      const other = weAreA
        ? `#${r.contact_id_b} ${r["contact_id_b.display_name"] ?? ""}`
        : `#${r.contact_id_a} ${r["contact_id_a.display_name"] ?? ""}`;
      const period = [r.start_date, r.end_date].filter(Boolean).join(" → ");
      const state = r.is_active ? "active" : "inactive";
      return `${role}: ${other.trim()}${period ? ` [${period}]` : ""} (${state})`;
    });

    return textResult(
      `Contact #${contact_id} — ${res.values.length} relationship(s):\n${lines.join("\n")}`,
      { count: res.values.length, values: res.values },
    );
  },
};
