import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const InputSchema = z.object({
  entity: z
    .string()
    .min(1)
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/)
    .describe("APIv4 entity name, e.g. Activity, Contribution, Contact, Membership."),
  field: z
    .string()
    .min(1)
    .describe(
      "Field name whose option list you want, e.g. 'activity_type_id', 'financial_type_id', 'contribution_status_id', 'contact_type'.",
    ),
});

interface FieldRow {
  name: string;
  title?: string;
  data_type?: string;
  options?: Record<string, string> | Array<{ id: string | number; label: string }> | false;
}

export const describeFieldOptionsTool: ToolDefinition<typeof InputSchema> = {
  name: "civicrm_describe_field_options",
  title: "Describe field options",
  description:
    "Return the option list (pseudoconstant values) for a single field on an entity. Far cheaper than civicrm_describe_entity when you only need to know the valid values for one enum-like field — e.g. 'what are the legal activity_type values'.",
  inputSchema: InputSchema,
  async handler({ entity, field }, { client }) {
    const res = await client.api4<FieldRow>(entity, "getFields", {
      where: [["name", "=", field]],
      loadOptions: ["id", "name", "label"],
      limit: 1,
    });
    const row = res.values[0];
    if (!row) {
      return textResult(
        `No field "${field}" found on ${entity}. Call civicrm_describe_entity for the full field list.`,
      );
    }
    if (!row.options || (row.options as unknown) === false) {
      return textResult(
        `Field ${entity}.${field} (${row.data_type ?? "?"}) has no option list — it's a free-form value, not an enum.`,
        row,
      );
    }

    const opts = normaliseOptions(row.options);
    const lines: string[] = [
      `${entity}.${field} — ${row.title ?? field} (${opts.length} option${opts.length === 1 ? "" : "s"})`,
      "",
      ...opts.map((o) => `  ${o.id}\t${o.name ?? ""}\t${o.label ?? ""}`),
    ];
    return textResult(lines.join("\n"), {
      entity,
      field,
      title: row.title,
      options: opts,
    });
  },
};

interface NormalOption {
  id: string | number;
  name?: string;
  label?: string;
}

// CiviCRM returns options in two different shapes depending on the loadOptions
// argument — either a flat {id: label} map or an array of {id, name, label}.
// Normalise to the array form before returning.
function normaliseOptions(
  raw: Record<string, string> | Array<{ id: string | number; name?: string; label?: string }>,
): NormalOption[] {
  if (Array.isArray(raw)) {
    return raw.map((o) => ({ id: o.id, name: o.name, label: o.label }));
  }
  return Object.entries(raw).map(([id, label]) => ({ id, label }));
}
