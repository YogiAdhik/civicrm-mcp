// Structured audit log for every tool call. One JSON line per call to stderr.
// Admins use this to (a) verify what the bot did during a dry-run rollout,
// (b) prove to their board that they can see every action taken on the CRM.
//
// Secrets are redacted by key-name match before serialisation. stdout is
// reserved for the MCP protocol; everything here goes to stderr.

const SECRET_KEY_PATTERN = /(api_key|apikey|secret|token|password|hash|key)/i;

export interface AuditEntry {
  ts: string;
  tool: string;
  args: unknown;
  dry_run?: boolean;
  status: "ok" | "error" | "refused";
  duration_ms: number;
  error_code?: number | string;
  error_message?: string;
}

export function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY_PATTERN.test(k) ? "[REDACTED]" : redact(v);
    }
    return out;
  }
  return value;
}

export type AuditSink = (line: string) => void;

let sink: AuditSink = (line) => process.stderr.write(line + "\n");

export function setAuditSink(s: AuditSink): void {
  sink = s;
}

export function resetAuditSink(): void {
  sink = (line) => process.stderr.write(line + "\n");
}

export function emitAudit(entry: AuditEntry): void {
  sink(JSON.stringify({ kind: "audit", ...entry, args: redact(entry.args) }));
}
