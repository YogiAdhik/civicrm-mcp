#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr is fine — stdout is reserved for the MCP protocol.
  process.stderr.write(
    `[civicrm-mcp] connected — base=${config.baseUrl} cms=${config.cms} ` +
      `writes=${config.allowWrites} deletes=${config.allowDeletes} ` +
      `genericApi=${config.allowGenericApi}\n`,
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`[civicrm-mcp] fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
