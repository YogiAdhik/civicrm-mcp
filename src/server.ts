import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { CivicrmClient, CivicrmError } from "./civicrm/client.js";
import type { Config } from "./config.js";
import { allTools } from "./tools/index.js";
import { errorResult, type ToolContext, type ToolDefinition } from "./tools/types.js";

export function createServer(config: Config): Server {
  const client = new CivicrmClient(config);
  const ctx: ToolContext = { client, config };

  const server = new Server(
    { name: "civicrm-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: ToolDefinition<any>[] = allTools();
  const byName = new Map(tools.map((t) => [t.name, t]));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      title: t.title,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema, {
        $refStrategy: "none",
        target: "jsonSchema7",
      }) as { type: "object"; [k: string]: unknown },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = byName.get(req.params.name);
    if (!tool) {
      return errorResult(`Unknown tool: ${req.params.name}`) as never;
    }

    const parsed = tool.inputSchema.safeParse(req.params.arguments ?? {});
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map(
          (i: { path: (string | number)[]; message: string }) =>
            `${i.path.join(".") || "(root)"}: ${i.message}`,
        )
        .join("; ");
      return errorResult(`Invalid arguments for ${tool.name}: ${issues}`) as never;
    }

    try {
      return (await tool.handler(parsed.data, ctx)) as never;
    } catch (err) {
      if (err instanceof CivicrmError) {
        return errorResult(`CiviCRM error: ${err.message}`) as never;
      }
      return errorResult(`Unexpected error: ${(err as Error).message}`) as never;
    }
  });

  return server;
}
