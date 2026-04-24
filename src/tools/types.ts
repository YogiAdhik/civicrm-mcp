import type { z } from "zod";
import type { CivicrmClient } from "../civicrm/client.js";
import type { Config } from "../config.js";

export interface ToolContext {
  client: CivicrmClient;
  config: Config;
}

export interface ToolResultContent {
  type: "text";
  text: string;
}

export interface ToolResult {
  content: ToolResultContent[];
  isError?: boolean;
  structuredContent?: unknown;
}

export interface ToolDefinition<Schema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  title: string;
  description: string;
  inputSchema: Schema;
  handler: (args: z.infer<Schema>, ctx: ToolContext) => Promise<ToolResult>;
}

export function textResult(text: string, structured?: unknown): ToolResult {
  const result: ToolResult = { content: [{ type: "text", text }] };
  if (structured !== undefined) result.structuredContent = structured;
  return result;
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}
