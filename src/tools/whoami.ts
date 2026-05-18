import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const InputSchema = z.object({});

interface ContactRow {
  id: number;
  display_name?: string;
  contact_type?: string;
  "email_primary.email"?: string;
}

// Read-only probes against common entities. If the call succeeds the bot can
// read that entity; if it 401/403s the bot can't. We don't probe writes —
// that's what dry-run mode is for.
const READ_PROBES: Array<{ entity: string; label: string }> = [
  { entity: "Contact", label: "Contacts" },
  { entity: "Activity", label: "Activities" },
  { entity: "Contribution", label: "Contributions" },
  { entity: "Event", label: "Events" },
  { entity: "Participant", label: "Event participants" },
  { entity: "Membership", label: "Memberships" },
  { entity: "Group", label: "Groups" },
  { entity: "Tag", label: "Tags" },
  { entity: "Note", label: "Notes" },
  { entity: "Case", label: "Cases (CiviCase)" },
  { entity: "Mailing", label: "Mailings (CiviMail)" },
  { entity: "Pledge", label: "Pledges" },
];

export const whoamiTool: ToolDefinition<typeof InputSchema> = {
  name: "civicrm_whoami",
  title: "Who am I",
  description:
    "Resolves the authenticated bot contact and probes which CiviCRM entities it can read. Use this first when setting up the server — it surfaces the most common misconfigurations (wrong API key, missing 'authenticate with api key' permission, bot contact lacks 'access CiviCRM'). Does not probe writes.",
  inputSchema: InputSchema,
  async handler(_args, { client, config }) {
    const me = await client
      .api4<ContactRow>("Contact", "get", {
        select: ["id", "display_name", "contact_type", "email_primary.email"],
        where: [["id", "=", "@user:cid"]],
        limit: 1,
      })
      .catch(() => null);

    const bot = me?.values[0];

    const probes = await Promise.all(
      READ_PROBES.map(async (p) => {
        try {
          await client.api4(p.entity, "get", { select: ["id"], limit: 1 });
          return { ...p, allowed: true, error: undefined as string | undefined };
        } catch (err) {
          return {
            ...p,
            allowed: false,
            error: (err as Error).message,
          };
        }
      }),
    );

    const allowedReads = probes.filter((p) => p.allowed);
    const refusedReads = probes.filter((p) => !p.allowed);

    const lines: string[] = [];
    if (bot) {
      lines.push(
        `Bot contact: #${bot.id} ${bot.display_name ?? "(no name)"} (${bot.contact_type ?? "?"})`,
      );
      if (bot["email_primary.email"]) {
        lines.push(`Primary email: ${bot["email_primary.email"]}`);
      }
    } else {
      lines.push(
        "Bot contact: COULD NOT RESOLVE — check CIVICRM_API_KEY and that the bot has the 'authenticate with api key' permission.",
      );
    }
    lines.push("");
    lines.push(`Auth mode: ${config.authMode}`);
    lines.push(
      `Server flags: writes=${config.allowWrites} deletes=${config.allowDeletes} ` +
        `genericApi=${config.allowGenericApi} dryRun=${config.dryRunDefault}`,
    );
    lines.push("");
    lines.push(`Readable entities (${allowedReads.length}/${probes.length}):`);
    for (const p of allowedReads) lines.push(`  ✓ ${p.label}`);
    if (refusedReads.length > 0) {
      lines.push("");
      lines.push(`Refused (likely missing permission or extension not installed):`);
      for (const p of refusedReads) lines.push(`  ✗ ${p.label}`);
    }
    lines.push("");
    lines.push(
      "Note: write permissions are not probed. Enable CIVICRM_DRY_RUN_DEFAULT=true and call a write tool to test without mutating data.",
    );

    return textResult(lines.join("\n"), {
      bot: bot ?? null,
      reads: probes,
      config: {
        authMode: config.authMode,
        allowWrites: config.allowWrites,
        allowDeletes: config.allowDeletes,
        allowGenericApi: config.allowGenericApi,
        dryRunDefault: config.dryRunDefault,
      },
    });
  },
};
