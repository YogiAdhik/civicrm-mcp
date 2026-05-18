import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { CivicrmClient, CivicrmError } from "../civicrm/client.js";
import type { Config } from "../config.js";

const baseConfig: Config = {
  baseUrl: "https://crm.example.org",
  cms: "drupal",
  apiKey: "test-key",
  siteKey: undefined,
  authMode: "authx",
  allowWrites: false,
  allowDeletes: false,
  allowGenericApi: false,
  dryRunDefault: false,
  toolsEnabled: null,
  toolsDisabled: [],
  timeoutMs: 5_000,
};

interface FetchCall {
  url: string;
  init: RequestInit;
}

interface MockResponse {
  ok?: boolean;
  status?: number;
  body: string;
}

function mockFetch(
  handler: (url: string, init: RequestInit) => MockResponse,
): { calls: FetchCall[]; restore: () => void } {
  const original = globalThis.fetch;
  const calls: FetchCall[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.fetch = (async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    const r = handler(String(url), init);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      text: async () => r.body,
    } as any;
  }) as typeof fetch;
  return { calls, restore: () => void (globalThis.fetch = original) };
}

describe("CivicrmClient", () => {
  let restore: () => void;
  afterEach(() => restore?.());

  it("sends Bearer auth and X-Requested-With on AuthX mode", async () => {
    const mock = mockFetch(() => ({
      body: JSON.stringify({ version: 4, count: 0, values: [] }),
    }));
    restore = mock.restore;

    const client = new CivicrmClient(baseConfig);
    await client.api4("Contact", "get", { limit: 1 });

    assert.equal(mock.calls.length, 1);
    const call = mock.calls[0]!;
    assert.equal(
      call.url,
      "https://crm.example.org/civicrm/ajax/api4/Contact/get",
    );
    const headers = call.init.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer test-key");
    assert.equal(headers["X-Requested-With"], "XMLHttpRequest");
    assert.equal(headers["Content-Type"], "application/x-www-form-urlencoded");
    // APIv4 REST wants params= as a form field, not a raw JSON body.
    const form = new URLSearchParams(call.init.body as string);
    assert.equal(form.get("params"), JSON.stringify({ limit: 1 }));
  });

  it("refuses write actions when CIVICRM_ALLOW_WRITES is false", async () => {
    const mock = mockFetch(() => ({ body: "{}" }));
    restore = mock.restore;
    const client = new CivicrmClient(baseConfig);
    await assert.rejects(() => client.api4("Contact", "create", {}), /ALLOW_WRITES/);
    assert.equal(mock.calls.length, 0, "must not hit the network");
  });

  it("refuses delete actions even when writes are allowed", async () => {
    const mock = mockFetch(() => ({ body: "{}" }));
    restore = mock.restore;
    const client = new CivicrmClient({ ...baseConfig, allowWrites: true });
    await assert.rejects(() => client.api4("Contact", "delete", {}), /ALLOW_DELETES/);
    assert.equal(mock.calls.length, 0);
  });

  it("surfaces APIv4 error_message as CivicrmError", async () => {
    const mock = mockFetch(() => ({
      body: JSON.stringify({ error_code: 42, error_message: "bad where clause" }),
    }));
    restore = mock.restore;
    const client = new CivicrmClient(baseConfig);
    await assert.rejects(
      () => client.api4("Contact", "get", {}),
      (err: unknown) =>
        err instanceof CivicrmError &&
        err.message === "bad where clause" &&
        err.errorCode === 42,
    );
  });

  it("maps 401 to a clear auth-failure message", async () => {
    const mock = mockFetch(() => ({
      ok: false,
      status: 401,
      body: "Unauthorized",
    }));
    restore = mock.restore;
    const client = new CivicrmClient(baseConfig);
    await assert.rejects(
      () => client.api4("Contact", "get", {}),
      /Authentication failed/,
    );
  });

  it("passes site key as X-Civi-Key when configured", async () => {
    const mock = mockFetch(() => ({
      body: JSON.stringify({ version: 4, count: 0, values: [] }),
    }));
    restore = mock.restore;
    const client = new CivicrmClient({ ...baseConfig, siteKey: "SECRET" });
    await client.api4("Contact", "get", {});
    const headers = mock.calls[0]!.init.headers as Record<string, string>;
    assert.equal(headers["X-Civi-Key"], "SECRET");
  });

  it("short-circuits write actions when dryRunDefault is true", async () => {
    const mock = mockFetch(() => ({ body: "{}" }));
    restore = mock.restore;
    const client = new CivicrmClient({
      ...baseConfig,
      allowWrites: true,
      dryRunDefault: true,
    });
    const res = (await client.api4("Contact", "create", { values: { x: 1 } })) as {
      dryRun?: { entity: string; action: string; params: Record<string, unknown> };
    };
    assert.equal(mock.calls.length, 0, "must not hit the network");
    assert.ok(res.dryRun, "response must carry dryRun metadata");
    assert.equal(res.dryRun!.entity, "Contact");
    assert.equal(res.dryRun!.action, "create");
  });

  it("does not short-circuit reads in dry-run mode", async () => {
    const mock = mockFetch(() => ({
      body: JSON.stringify({ version: 4, count: 0, values: [] }),
    }));
    restore = mock.restore;
    const client = new CivicrmClient({ ...baseConfig, dryRunDefault: true });
    await client.api4("Contact", "get", { limit: 1 });
    assert.equal(mock.calls.length, 1, "reads still go to the network");
  });

  it("builds form-encoded body in legacy mode", async () => {
    const mock = mockFetch(() => ({
      body: JSON.stringify({ version: 4, count: 0, values: [] }),
    }));
    restore = mock.restore;
    const client = new CivicrmClient({
      ...baseConfig,
      authMode: "legacy",
      siteKey: "SITE",
    });
    await client.api4("Contact", "get", { limit: 2 });
    const call = mock.calls[0]!;
    const headers = call.init.headers as Record<string, string>;
    assert.equal(headers["Content-Type"], "application/x-www-form-urlencoded");
    const body = call.init.body as string;
    assert.match(body, /api_key=test-key/);
    assert.match(body, /key=SITE/);
    assert.match(body, /params=/);
  });
});

// Silence unused-import warning for beforeEach
void beforeEach;
