import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const InputSchema = z.object({
  entity: z
    .string()
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/)
    .describe("APIv4 entity name, e.g. Contact, Contribution, Activity."),
  includeCustom: z
    .boolean()
    .default(true)
    .describe("Include custom fields (Name.custom_field notation)."),
  loadOptions: z
    .boolean()
    .default(false)
    .describe(
      "Include option lists for pseudoconstant fields. Verbose — turn on only when you need option values.",
    ),
});

interface FieldRow {
  name: string;
  title?: string;
  data_type?: string;
  fk_entity?: string;
  required?: boolean;
  readonly?: boolean;
  options?: Array<{ id: unknown; name: string; label?: string }> | boolean;
  description?: string;
  custom_field_id?: number;
}

interface ActionRow {
  name: string;
  description?: string;
  params?: Record<string, unknown>;
}

export const describeEntityTool: ToolDefinition<typeof InputSchema> = {
  name: "civicrm_describe_entity",
  title: "Describe entity schema",
  description:
    "Introspect an APIv4 entity — returns available fields (incl. custom fields) and actions. Call this before civicrm_api4 when unsure of field names or action support.",
  inputSchema: InputSchema,
  async handler({ entity, includeCustom, loadOptions }, { client }) {
    const [fields, actions] = await Promise.all([
      client.api4<FieldRow>(entity, "getFields", {
        loadOptions,
        values: {},
        checkPermissions: true,
        action: "get",
        ...(includeCustom ? {} : { where: [["type", "!=", "Custom"]] }),
      }),
      client.api4<ActionRow>(entity, "getActions", {}),
    ]);

    const fieldLines = fields.values.map((f) => {
      const type = f.data_type ?? "?";
      const fk = f.fk_entity ? ` → ${f.fk_entity}` : "";
      const flags = [
        f.required ? "required" : null,
        f.readonly ? "readonly" : null,
        f.custom_field_id ? "custom" : null,
      ]
        .filter(Boolean)
        .join(",");
      return `${f.name}  [${type}${fk}${flags ? ` ${flags}` : ""}]${
        f.title && f.title !== f.name ? ` — ${f.title}` : ""
      }`;
    });

    const actionLines = actions.values.map(
      (a) => `${a.name}${a.description ? ` — ${a.description.split("\n")[0]}` : ""}`,
    );

    const text =
      `# ${entity}\n\n` +
      `## Actions (${actions.values.length})\n${actionLines.join("\n")}\n\n` +
      `## Fields (${fields.values.length})\n${fieldLines.join("\n")}`;

    return textResult(text, {
      entity,
      actions: actions.values,
      fields: fields.values,
    });
  },
};
