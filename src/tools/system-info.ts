import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const InputSchema = z.object({});

interface DomainRow {
  id: number;
  name?: string;
  version?: string;
}

interface ExtensionRow {
  key: string;
  status?: string;
  version?: string;
}

interface ContactRow {
  id: number;
  display_name?: string;
}

export const systemInfoTool: ToolDefinition<typeof InputSchema> = {
  name: "civicrm_system_info",
  title: "System info",
  description:
    "Connectivity sanity check — returns CiviCRM version (via Domain entity), the authenticated bot contact, and a count of installed extensions. Run first when debugging auth or URL setup.",
  inputSchema: InputSchema,
  async handler(_args, { client, config }) {
    const [domain, me, extensions] = await Promise.all([
      client.api4<DomainRow>("Domain", "get", {
        select: ["id", "name", "version"],
        limit: 1,
      }),
      client
        .api4<ContactRow>("Contact", "get", {
          select: ["id", "display_name"],
          where: [["id", "=", "@user:cid"]],
          limit: 1,
        })
        .catch(() => null),
      client
        .api4<ExtensionRow>("Extension", "get", {
          select: ["key", "status", "version"],
          where: [["status", "=", "installed"]],
        })
        .catch(() => null),
    ]);

    const dom = domain.values[0];
    const bot = me?.values[0];
    const exts = extensions?.values ?? [];

    const lines = [
      `CiviCRM: ${dom?.version ?? "?"}`,
      `Domain: ${dom?.name ?? "?"}`,
      `Base URL: ${config.baseUrl}`,
      `CMS host: ${config.cms}`,
      `Auth mode: ${config.authMode}`,
      `Writes: ${config.allowWrites ? "enabled" : "disabled"}`,
      `Deletes: ${config.allowDeletes ? "enabled" : "disabled"}`,
      `Generic APIv4 passthrough: ${config.allowGenericApi ? "enabled" : "disabled"}`,
      bot
        ? `Bot contact: #${bot.id} ${bot.display_name ?? ""}`.trim()
        : "Bot contact: (could not resolve)",
      `Installed extensions: ${exts.length}`,
    ];

    return textResult(lines.join("\n"), {
      domain: dom ?? null,
      bot: bot ?? null,
      extensions: exts,
      config: {
        baseUrl: config.baseUrl,
        cms: config.cms,
        authMode: config.authMode,
        allowWrites: config.allowWrites,
        allowDeletes: config.allowDeletes,
        allowGenericApi: config.allowGenericApi,
      },
    });
  },
};
