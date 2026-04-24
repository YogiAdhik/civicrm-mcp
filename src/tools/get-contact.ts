import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const InputSchema = z.object({
  id: z.number().int().positive().describe("CiviCRM contact id."),
  fields: z
    .array(z.string())
    .optional()
    .describe(
      "Optional list of APIv4 select expressions, e.g. ['id','display_name','email_primary.email','CustomGroup.field']. Defaults to a sensible core set.",
    ),
});

const DEFAULT_FIELDS = [
  "id",
  "contact_type",
  "display_name",
  "first_name",
  "last_name",
  "nick_name",
  "preferred_language",
  "do_not_email",
  "do_not_phone",
  "do_not_sms",
  "do_not_mail",
  "is_deceased",
  "email_primary.email",
  "phone_primary.phone",
  "address_primary.street_address",
  "address_primary.city",
  "address_primary.state_province_id:label",
  "address_primary.postal_code",
  "address_primary.country_id:label",
  "created_date",
  "modified_date",
];

const REDACT_FIELDS = new Set(["api_key", "hash"]);

export const getContactTool: ToolDefinition<typeof InputSchema> = {
  name: "civicrm_get_contact",
  title: "Get contact",
  description:
    "Fetch a single CiviCRM contact by id. Returns core profile plus primary email/phone/address; pass `fields` to override.",
  inputSchema: InputSchema,
  async handler({ id, fields }, { client }) {
    const select = (fields && fields.length > 0 ? fields : DEFAULT_FIELDS).filter(
      (f) => !REDACT_FIELDS.has(f),
    );

    const res = await client.api4<Record<string, unknown>>("Contact", "get", {
      select,
      where: [["id", "=", id]],
      limit: 1,
    });

    const contact = res.values[0];
    if (!contact) {
      return textResult(`No contact with id ${id}.`);
    }

    // Redact defensively — Contact.get shouldn't return api_key/hash without explicit perm,
    // but strip anyway.
    for (const k of REDACT_FIELDS) delete contact[k];

    return textResult(formatContact(contact), contact);
  },
};

function formatContact(c: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(c)) {
    if (v === null || v === undefined || v === "") continue;
    lines.push(`${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  }
  return lines.join("\n");
}
