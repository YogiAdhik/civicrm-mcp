import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { Config } from "../config.js";
import { filterTools } from "../server.js";
import { allTools } from "../tools/index.js";

function cfg(overrides: Partial<Config> = {}): Config {
  return {
    baseUrl: "https://crm.example.org",
    cms: "drupal",
    apiKey: "k",
    siteKey: undefined,
    authMode: "authx",
    allowWrites: false,
    allowDeletes: false,
    allowGenericApi: false,
    dryRunDefault: false,
    toolsEnabled: null,
    toolsDisabled: [],
    timeoutMs: 5_000,
    ...overrides,
  };
}

describe("filterTools", () => {
  const tools = allTools();

  it("returns all tools when no filters are set", () => {
    assert.equal(filterTools(tools, cfg()).length, tools.length);
  });

  it("excludes tools named in CIVICRM_TOOLS_DISABLED", () => {
    const result = filterTools(tools, cfg({ toolsDisabled: ["civicrm_api4"] }));
    const names = result.map((t) => t.name);
    assert.ok(!names.includes("civicrm_api4"));
    assert.ok(names.includes("civicrm_find_contacts"));
  });

  it("restricts to tools named in CIVICRM_TOOLS_ENABLED", () => {
    const result = filterTools(
      tools,
      cfg({ toolsEnabled: ["civicrm_find_contacts", "civicrm_get_contact"] }),
    );
    assert.equal(result.length, 2);
    assert.deepEqual(
      new Set(result.map((t) => t.name)),
      new Set(["civicrm_find_contacts", "civicrm_get_contact"]),
    );
  });

  it("disabled wins over enabled", () => {
    const result = filterTools(
      tools,
      cfg({
        toolsEnabled: ["civicrm_find_contacts", "civicrm_api4"],
        toolsDisabled: ["civicrm_api4"],
      }),
    );
    assert.equal(result.length, 1);
    assert.equal(result[0]!.name, "civicrm_find_contacts");
  });
});
