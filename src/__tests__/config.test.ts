import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { loadConfig } from "../config.js";

function env(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    CIVICRM_BASE_URL: "https://crm.example.org",
    CIVICRM_API_KEY: "k",
    ...extra,
  };
}

describe("loadConfig", () => {
  it("applies sane defaults", () => {
    const cfg = loadConfig(env());
    assert.equal(cfg.cms, "drupal");
    assert.equal(cfg.authMode, "authx");
    assert.equal(cfg.allowWrites, false);
    assert.equal(cfg.allowDeletes, false);
    assert.equal(cfg.timeoutMs, 30_000);
  });

  it("strips trailing slashes from base URL", () => {
    const cfg = loadConfig(env({ CIVICRM_BASE_URL: "https://crm.example.org/" }));
    assert.equal(cfg.baseUrl, "https://crm.example.org");
  });

  it("interprets truthy write flags", () => {
    const cfg = loadConfig(
      env({ CIVICRM_ALLOW_WRITES: "true", CIVICRM_ALLOW_DELETES: "1" }),
    );
    assert.equal(cfg.allowWrites, true);
    assert.equal(cfg.allowDeletes, true);
  });

  it("rejects unknown CMS values", () => {
    assert.throws(
      () => loadConfig(env({ CIVICRM_CMS: "sitecore" })),
      /Invalid CiviCRM MCP config/,
    );
  });

  it("requires an API key", () => {
    assert.throws(
      () => loadConfig({ CIVICRM_BASE_URL: "https://crm.example.org" }),
      /CIVICRM_API_KEY/,
    );
  });
});
