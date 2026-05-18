import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { emitAudit } from "./audit.js";
import { CivicrmClient, CivicrmError } from "./civicrm/client.js";
import type { Config } from "./config.js";
import { allTools } from "./tools/index.js";
import { errorResult, type ToolContext, type ToolDefinition } from "./tools/types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function filterTools(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: ToolDefinition<any>[],
  config: Config,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): ToolDefinition<any>[] {
  const disabled = new Set(config.toolsDisabled);
  const enabled = config.toolsEnabled ? new Set(config.toolsEnabled) : null;
  return tools.filter((t) => {
    if (disabled.has(t.name)) return false;
    if (enabled && !enabled.has(t.name)) return false;
    return true;
  });
}

export function createServer(config: Config): Server {
  const client = new CivicrmClient(config);
  const ctx: ToolContext = { client, config };

  const server = new Server(
    { name: "civicrm-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: ToolDefinition<any>[] = filterTools(allTools(), config);
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
    const started = Date.now();
    const toolName = req.params.name;
    const rawArgs = req.params.arguments ?? {};
    const tool = byName.get(toolName);
    if (!tool) {
      emitAudit({
        ts: new Date().toISOString(),
        tool: toolName,
        args: rawArgs,
        status: "refused",
        duration_ms: Date.now() - started,
        error_message: "unknown tool",
      });
      return errorResult(`Unknown tool: ${toolName}`) as never;
    }

    const parsed = tool.inputSchema.safeParse(rawArgs);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map(
          (i: { path: (string | number)[]; message: string }) =>
            `${i.path.join(".") || "(root)"}: ${i.message}`,
        )
        .join("; ");
      emitAudit({
        ts: new Date().toISOString(),
        tool: toolName,
        args: rawArgs,
        status: "refused",
        duration_ms: Date.now() - started,
        error_message: `invalid arguments: ${issues}`,
      });
      return errorResult(`Invalid arguments for ${toolName}: ${issues}`) as never;
    }

    try {
      const result = (await tool.handler(parsed.data, ctx)) as {
        isError?: boolean;
        content?: { text?: string }[];
      };
      const dryRun =
        (parsed.data as { dry_run?: boolean })?.dry_run === true ||
        config.dryRunDefault === true;
      emitAudit({
        ts: new Date().toISOString(),
        tool: toolName,
        args: parsed.data,
        dry_run: dryRun || undefined,
        status: result.isError ? "error" : "ok",
        duration_ms: Date.now() - started,
        error_message: result.isError ? result.content?.[0]?.text : undefined,
      });
      return result as never;
    } catch (err) {
      const dryRun =
        (parsed.data as { dry_run?: boolean })?.dry_run === true ||
        config.dryRunDefault === true;
      const isCivi = err instanceof CivicrmError;
      emitAudit({
        ts: new Date().toISOString(),
        tool: toolName,
        args: parsed.data,
        dry_run: dryRun || undefined,
        status: "error",
        duration_ms: Date.now() - started,
        error_code: isCivi ? err.errorCode : undefined,
        error_message: (err as Error).message,
      });
      if (isCivi) {
        return errorResult(`CiviCRM error: ${err.message}`) as never;
      }
      return errorResult(`Unexpected error: ${(err as Error).message}`) as never;
    }
  });

  return server;
}
