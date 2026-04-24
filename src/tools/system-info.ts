import { z } from "zod";
import { textResult, type ToolDefinition } from "./types.js";

const InputSchema = z.object({});

interface SystemRow {
  version?: string;
  php_version?: string;
  mysql_version?: string;
  cms?: string;
  domain?: string;
  cms_version?: string;
  extensions?: Record<string, unknown>;
  [k: string]: unknown;
}

export const systemInfoTool: ToolDefinition<typeof InputSchema> = {
  name: "civicrm_system_info",
  title: "System info",
  description:
    "Connectivity sanity check — returns CiviCRM version, CMS, PHP/MySQL versions, and the authenticated bot contact id. Run first when debugging auth or URL setup.",
  inputSchema: InputSchema,
  async handler(_args, { client, config }) {
    const [system, me] = await Promise.all([
      client.api4<SystemRow>("System", "get", { select: ["*"] }),
      client.api4<{ id: number; display_name: string }>("Contact", "get", {
        select: ["id", "display_name"],
        where: [["id", "=", "@user:cid"]],
        limit: 1,
      }).catch(() => null),
    ]);

    const sys = system.values[0] ?? {};
    const botLine = me?.values[0]
      ? `Bot contact: #${me.values[0].id} ${me.values[0].display_name}`
      : "Bot contact: (could not resolve)";

    const lines = [
      `CiviCRM: ${sys.version ?? "?"}`,
      `CMS: ${sys.cms ?? config.cms} ${sys.cms_version ?? ""}`.trim(),
      `PHP: ${sys.php_version ?? "?"}`,
      `MySQL: ${sys.mysql_version ?? "?"}`,
      `Base URL: ${config.baseUrl}`,
      `Auth mode: ${config.authMode}`,
      `Writes: ${config.allowWrites ? "enabled" : "disabled"}`,
      `Deletes: ${config.allowDeletes ? "enabled" : "disabled"}`,
      botLine,
    ];

    return textResult(lines.join("\n"), {
      system: sys,
      bot: me?.values[0] ?? null,
      config: {
        baseUrl: config.baseUrl,
        cms: config.cms,
        authMode: config.authMode,
        allowWrites: config.allowWrites,
        allowDeletes: config.allowDeletes,
      },
    });
  },
};
