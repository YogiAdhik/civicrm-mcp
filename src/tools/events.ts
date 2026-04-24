import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const ListInput = z.object({
  upcoming_only: z
    .boolean()
    .default(true)
    .describe("Only return events whose end_date is today or later."),
  public_only: z
    .boolean()
    .default(false)
    .describe("Only return events with is_public=true."),
  limit: z.number().int().min(1).max(200).default(50),
});

interface EventRow {
  id: number;
  title: string;
  "event_type_id:label"?: string;
  start_date?: string;
  end_date?: string;
  is_public?: boolean;
  is_online_registration?: boolean;
  max_participants?: number | null;
  summary?: string;
}

export const listEventsTool: ToolDefinition<typeof ListInput> = {
  name: "civicrm_list_events",
  title: "List events",
  description:
    "List CiviEvent events. Defaults to upcoming only. Returns id, title, type, dates, public/online flags.",
  inputSchema: ListInput,
  async handler({ upcoming_only, public_only, limit }, { client }) {
    const where: unknown[][] = [["is_active", "=", true]];
    if (upcoming_only) {
      const today = new Date().toISOString().slice(0, 10);
      where.push(["end_date", ">=", today]);
    }
    if (public_only) where.push(["is_public", "=", true]);

    const res = await client.api4<EventRow>("Event", "get", {
      select: [
        "id",
        "title",
        "event_type_id:label",
        "start_date",
        "end_date",
        "is_public",
        "is_online_registration",
        "max_participants",
        "summary",
      ],
      where,
      orderBy: { start_date: "ASC" },
      limit,
    });

    if (res.values.length === 0) {
      return textResult("No events matched.");
    }

    const lines = res.values.map((e) => {
      const when = e.start_date
        ? e.end_date && e.end_date !== e.start_date
          ? `${e.start_date} → ${e.end_date}`
          : e.start_date
        : "(no date)";
      const cap = e.max_participants ? ` · cap ${e.max_participants}` : "";
      const flags = [
        e.is_public ? "public" : null,
        e.is_online_registration ? "online reg" : null,
      ]
        .filter(Boolean)
        .join(", ");
      return `#${e.id}  ${e.title}  [${when}]${cap}${flags ? ` (${flags})` : ""}`;
    });

    return textResult(
      `${res.values.length} event(s):\n${lines.join("\n")}`,
      { count: res.values.length, values: res.values },
    );
  },
};

const RegisterInput = z.object({
  contact_id: z.number().int().positive(),
  event_id: z.number().int().positive(),
  role: z
    .string()
    .default("Attendee")
    .describe("Participant role name, e.g. Attendee, Speaker, Volunteer, Host."),
  status: z
    .string()
    .default("Registered")
    .describe("Participant status name, e.g. Registered, Attended, Cancelled."),
  register_date: z
    .string()
    .optional()
    .describe("ISO-8601 datetime; defaults to now."),
  source: z.string().optional(),
});

export const registerForEventTool: ToolDefinition<typeof RegisterInput> = {
  name: "civicrm_register_for_event",
  title: "Register for event",
  description:
    "Create a Participant record registering a contact for an event. Requires CIVICRM_ALLOW_WRITES=true.",
  inputSchema: RegisterInput,
  async handler(args, { client }) {
    const values: Record<string, unknown> = {
      contact_id: args.contact_id,
      event_id: args.event_id,
      "role_id:name": args.role,
      "status_id:name": args.status,
      ...(args.register_date ? { register_date: args.register_date } : {}),
      ...(args.source ? { source: args.source } : {}),
    };
    const res = await client.api4<{ id: number }>("Participant", "create", { values });
    const row = res.values[0];
    if (!row) return textResult("Participant.create returned no rows.");
    return textResult(
      `Registered contact #${args.contact_id} for event #${args.event_id} as ${args.role} (Participant #${row.id}).`,
      row,
    );
  },
};
