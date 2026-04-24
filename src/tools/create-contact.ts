import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const InputSchema = z.object({
  contact_type: z
    .enum(["Individual", "Organization", "Household"])
    .default("Individual"),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  organization_name: z.string().optional(),
  household_name: z.string().optional(),
  email: z.string().email().optional().describe("Primary email — will be attached via chain."),
  phone: z.string().optional().describe("Primary phone — will be attached via chain."),
  source: z.string().optional().describe("Free-text source/provenance tag."),
  extra: z
    .record(z.unknown())
    .optional()
    .describe("Extra values to pass to Contact.create (any other APIv4 fields)."),
});

export const createContactTool: ToolDefinition<typeof InputSchema> = {
  name: "civicrm_create_contact",
  title: "Create contact",
  description:
    "Create a new CiviCRM contact. Chains email and phone creation when provided. Requires CIVICRM_ALLOW_WRITES=true.",
  inputSchema: InputSchema,
  async handler(args, { client }) {
    const values: Record<string, unknown> = {
      contact_type: args.contact_type,
      ...(args.first_name ? { first_name: args.first_name } : {}),
      ...(args.last_name ? { last_name: args.last_name } : {}),
      ...(args.organization_name ? { organization_name: args.organization_name } : {}),
      ...(args.household_name ? { household_name: args.household_name } : {}),
      ...(args.source ? { source: args.source } : {}),
      ...(args.extra ?? {}),
    };

    const chain: Record<string, unknown> = {};
    if (args.email) {
      chain.email = [
        "Email",
        "create",
        { values: { contact_id: "$id", email: args.email, is_primary: true } },
      ];
    }
    if (args.phone) {
      chain.phone = [
        "Phone",
        "create",
        { values: { contact_id: "$id", phone: args.phone, is_primary: true } },
      ];
    }

    const params: Record<string, unknown> = { values };
    if (Object.keys(chain).length > 0) params.chain = chain;

    const res = await client.api4<{ id: number; display_name?: string }>(
      "Contact",
      "create",
      params,
    );

    const created = res.values[0];
    if (!created) {
      return textResult("Contact.create returned no rows.");
    }
    return textResult(
      `Created contact #${created.id}${
        created.display_name ? ` — ${created.display_name}` : ""
      }.`,
      created,
    );
  },
};
