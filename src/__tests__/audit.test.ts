import { strict as assert } from "node:assert";
import { afterEach, describe, it } from "node:test";
import { emitAudit, redact, resetAuditSink, setAuditSink } from "../audit.js";

describe("audit redact", () => {
  it("redacts known secret-bearing keys at any depth", () => {
    const input = {
      contact_id: 42,
      api_key: "abc",
      values: { hash: "xyz", display_name: "Alice" },
      list: [{ token: "t1" }, { secret: "s1" }, { ok: "fine" }],
    };
    const out = redact(input) as Record<string, unknown>;
    assert.equal(out.contact_id, 42);
    assert.equal(out.api_key, "[REDACTED]");
    const values = out.values as Record<string, unknown>;
    assert.equal(values.hash, "[REDACTED]");
    assert.equal(values.display_name, "Alice");
    const list = out.list as Record<string, unknown>[];
    assert.equal(list[0]!.token, "[REDACTED]");
    assert.equal(list[1]!.secret, "[REDACTED]");
    assert.equal(list[2]!.ok, "fine");
  });

  it("preserves null and undefined", () => {
    assert.equal(redact(null), null);
    assert.equal(redact(undefined), undefined);
  });
});

describe("emitAudit", () => {
  let captured: string[] = [];
  afterEach(() => {
    captured = [];
    resetAuditSink();
  });

  it("emits one JSON line with redacted args", () => {
    setAuditSink((line) => captured.push(line));
    emitAudit({
      ts: "2026-05-18T00:00:00.000Z",
      tool: "civicrm_create_contact",
      args: { contact_type: "Individual", api_key: "leak-me" },
      status: "ok",
      duration_ms: 12,
    });
    assert.equal(captured.length, 1);
    const parsed = JSON.parse(captured[0]!) as {
      kind: string;
      tool: string;
      args: Record<string, unknown>;
      status: string;
    };
    assert.equal(parsed.kind, "audit");
    assert.equal(parsed.tool, "civicrm_create_contact");
    assert.equal(parsed.args.contact_type, "Individual");
    assert.equal(parsed.args.api_key, "[REDACTED]");
    assert.equal(parsed.status, "ok");
  });
});
