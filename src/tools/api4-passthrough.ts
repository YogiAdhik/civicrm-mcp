import { z } from "zod";
import { errorResult, textResult, type ToolDefinition } from "./types.js";

const InputSchema = z.object({
  entity: z
    .string()
    .min(1)
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/, "Entity must be an alphanumeric identifier.")
    .describe("APIv4 entity name, e.g. Contact, Contribution, Activity, Group."),
  action: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Action must be an alphanumeric identifier.")
    .describe("APIv4 action name, e.g. get, create, update, save, delete, getFields, getActions."),
  params: z
    .record(z.unknown())
    .default({})
    .describe(
      "APIv4 params object (select, where, values, limit, chain, etc.). Pass {} for default.",
    ),
});

export const api4PassthroughTool: ToolDefinition<typeof InputSchema> = {
  name: "civicrm_api4",
  title: "CiviCRM APIv4 passthrough",
  description:
    "Generic APIv4 call. Accepts entity + action + params. Disabled unless CIVICRM_ALLOW_GENERIC_API=true; writes additionally need CIVICRM_ALLOW_WRITES and deletes need CIVICRM_ALLOW_DELETES. Use civicrm_describe_entity first if unsure of field names.",
  inputSchema: InputSchema,
  async handler({ entity, action, params }, { client, config }) {
    if (!config.allowGenericApi) {
      return errorResult(
        "Refusing civicrm_api4 — set CIVICRM_ALLOW_GENERIC_API=true to enable the generic passthrough. Prefer the typed tools (civicrm_create_contact, civicrm_update_contact, etc.) when possible; they have narrower blast radius.",
      );
    }
    const res = await client.api4(entity, action, params);
    const summary = `${entity}.${action} → count=${res.count}${
      res.countMatched !== undefined ? ` matched=${res.countMatched}` : ""
    }`;
    return textResult(
      `${summary}\n\n${JSON.stringify(res.values, null, 2)}`,
      res,
    );
  },
};
