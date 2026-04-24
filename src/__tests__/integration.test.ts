import { strict as assert } from "node:assert";
import { afterEach, describe, it } from "node:test";
import { CivicrmClient } from "../civicrm/client.js";
import type { Config } from "../config.js";
import { findContactsTool } from "../tools/find-contacts.js";
import { getContactTool } from "../tools/get-contact.js";
import { getContributionsTool } from "../tools/get-contributions.js";
import { getRelationshipsTool } from "../tools/get-relationships.js";
import { listEventsTool, registerForEventTool } from "../tools/events.js";
import { logActivityTool } from "../tools/log-activity.js";
import { recordContributionTool } from "../tools/record-contribution.js";
import { systemInfoTool } from "../tools/system-info.js";
import {
  api4Error,
  api4Success,
  startMockCivicrm,
  type MockCivicrm,
} from "./helpers/mock-civicrm.js";

function cfg(base: string, overrides: Partial<Config> = {}): Config {
  return {
    baseUrl: base,
    cms: "standalone",
    apiKey: "test-key",
    siteKey: undefined,
    authMode: "authx",
    allowWrites: false,
    allowDeletes: false,
    timeoutMs: 5_000,
    ...overrides,
  };
}

describe("integration: read tools against a mock CiviCRM", () => {
  let mock: MockCivicrm;
  afterEach(async () => mock?.close());

  it("find_contacts hits the right URL and returns formatted matches", async () => {
    mock = await startMockCivicrm((call) => {
      assert.equal(call.entity, "Contact");
      assert.equal(call.action, "get");
      return api4Success([
        {
          id: 42,
          display_name: "Alice Smith",
          contact_type: "Individual",
          "email_primary.email": "alice@example.org",
        },
      ]);
    });

    const client = new CivicrmClient(cfg(mock.url));
    const res = await findContactsTool.handler(
      { query: "alice", limit: 25 },
      { client, config: cfg(mock.url) },
    );

    assert.equal(res.isError, undefined);
    assert.match(res.content[0]!.text, /#42\s+Alice Smith/);
    assert.equal(mock.calls.length, 1);
    assert.match(
      mock.calls[0]!.headers.authorization as string,
      /^Bearer test-key$/,
    );
  });

  it("get_contact redacts api_key and hash even if the server returns them", async () => {
    mock = await startMockCivicrm(() =>
      api4Success([
        {
          id: 7,
          display_name: "Bob",
          api_key: "SECRET-SHOULD-NOT-LEAK",
          hash: "HASH-SHOULD-NOT-LEAK",
        },
      ]),
    );

    const client = new CivicrmClient(cfg(mock.url));
    const res = await getContactTool.handler(
      { id: 7 },
      { client, config: cfg(mock.url) },
    );

    const text = res.content[0]!.text;
    assert.doesNotMatch(text, /SECRET-SHOULD-NOT-LEAK/);
    assert.doesNotMatch(text, /HASH-SHOULD-NOT-LEAK/);
    const struct = res.structuredContent as Record<string, unknown>;
    assert.equal(struct.api_key, undefined);
    assert.equal(struct.hash, undefined);
  });

  it("get_relationships resolves direction A→B vs B→A", async () => {
    mock = await startMockCivicrm(() =>
      api4Success([
        {
          id: 1,
          contact_id_a: 10,
          contact_id_b: 20,
          "contact_id_a.display_name": "Alice",
          "contact_id_b.display_name": "Acme Corp",
          "relationship_type_id.name_a_b": "Employee of",
          "relationship_type_id.name_b_a": "Employer of",
          "relationship_type_id:label": "Employee / Employer",
          is_active: true,
          start_date: "2024-01-01",
        },
        {
          id: 2,
          contact_id_a: 30,
          contact_id_b: 10,
          "contact_id_a.display_name": "Bob",
          "contact_id_b.display_name": "Alice",
          "relationship_type_id.name_a_b": "Spouse of",
          "relationship_type_id.name_b_a": "Spouse of",
          "relationship_type_id:label": "Spouse",
          is_active: true,
        },
      ]),
    );

    const client = new CivicrmClient(cfg(mock.url));
    const res = await getRelationshipsTool.handler(
      { contact_id: 10, active_only: true, limit: 50 },
      { client, config: cfg(mock.url) },
    );

    const text = res.content[0]!.text;
    // Alice is contact_id_a in row 1 → should see the A→B label "Employee of"
    assert.match(text, /Employee of: #20/);
    // Alice is contact_id_b in row 2 → should see the B→A label "Spouse of"
    assert.match(text, /Spouse of: #30/);
  });

  it("get_contributions sums totals and filters by contact", async () => {
    mock = await startMockCivicrm((call) => {
      const where = call.params.where as unknown[][];
      assert.deepEqual(where[0], ["contact_id", "=", 99]);
      return api4Success([
        {
          id: 1,
          contact_id: 99,
          total_amount: 50,
          currency: "USD",
          "contact_id.display_name": "Donor",
          "financial_type_id:label": "Donation",
          "contribution_status_id:label": "Completed",
          receive_date: "2026-03-15 10:00:00",
        },
        {
          id: 2,
          contact_id: 99,
          total_amount: 25.5,
          currency: "USD",
          "contact_id.display_name": "Donor",
          "financial_type_id:label": "Donation",
          "contribution_status_id:label": "Completed",
          receive_date: "2026-02-01 10:00:00",
        },
      ]);
    });

    const client = new CivicrmClient(cfg(mock.url));
    const res = await getContributionsTool.handler(
      { contact_id: 99, limit: 50 },
      { client, config: cfg(mock.url) },
    );

    assert.match(res.content[0]!.text, /sum ≈ 75\.50/);
    const s = res.structuredContent as { total: number };
    assert.equal(s.total, 75.5);
  });

  it("list_events adds upcoming-only filter by default", async () => {
    mock = await startMockCivicrm((call) => {
      const where = call.params.where as unknown[][];
      // is_active=true plus an end_date >= today constraint
      assert.deepEqual(where[0], ["is_active", "=", true]);
      assert.equal(where[1]![0], "end_date");
      assert.equal(where[1]![1], ">=");
      return api4Success([
        {
          id: 5,
          title: "Spring Gala",
          "event_type_id:label": "Fundraiser",
          start_date: "2026-05-01",
          end_date: "2026-05-01",
          is_public: true,
          is_online_registration: true,
          max_participants: 200,
        },
      ]);
    });

    const client = new CivicrmClient(cfg(mock.url));
    const res = await listEventsTool.handler(
      { upcoming_only: true, public_only: false, limit: 50 },
      { client, config: cfg(mock.url) },
    );
    assert.match(res.content[0]!.text, /#5 {2}Spring Gala/);
  });

  it("system_info surfaces CiviCRM version and bot contact", async () => {
    mock = await startMockCivicrm((call) => {
      if (call.entity === "System") {
        return api4Success([{ version: "5.79.0", cms: "Standalone", php_version: "8.3.0" }]);
      }
      if (call.entity === "Contact") {
        return api4Success([{ id: 1, display_name: "MCP Bot" }]);
      }
      return api4Success([]);
    });

    const client = new CivicrmClient(cfg(mock.url));
    const res = await systemInfoTool.handler(
      {},
      { client, config: cfg(mock.url) },
    );
    const text = res.content[0]!.text;
    assert.match(text, /CiviCRM: 5\.79\.0/);
    assert.match(text, /Bot contact: #1 MCP Bot/);
  });
});

describe("integration: write tools respect gating", () => {
  let mock: MockCivicrm;
  afterEach(async () => mock?.close());

  it("log_activity refuses when writes are disabled", async () => {
    mock = await startMockCivicrm(() => api4Success([{ id: 1 }]));
    const client = new CivicrmClient(cfg(mock.url));
    await assert.rejects(
      () =>
        logActivityTool.handler(
          {
            target_contact_id: 1,
            activity_type: "Phone Call",
            subject: "test",
            status: "Completed",
          },
          { client, config: cfg(mock.url) },
        ),
      /ALLOW_WRITES/,
    );
    assert.equal(mock.calls.length, 0);
  });

  it("record_contribution succeeds when writes are allowed and sends expected params", async () => {
    mock = await startMockCivicrm((call) => {
      assert.equal(call.entity, "Contribution");
      assert.equal(call.action, "create");
      const values = (call.params.values as Record<string, unknown>) ?? {};
      assert.equal(values.contact_id, 42);
      assert.equal(values.total_amount, 100);
      assert.equal(values["financial_type_id:name"], "Donation");
      return api4Success([{ id: 777 }]);
    });
    const config = cfg(mock.url, { allowWrites: true });
    const client = new CivicrmClient(config);
    const res = await recordContributionTool.handler(
      {
        contact_id: 42,
        total_amount: 100,
        currency: "USD",
        financial_type: "Donation",
        contribution_status: "Completed",
        is_test: false,
      },
      { client, config },
    );
    assert.match(res.content[0]!.text, /Contribution #777/);
  });

  it("register_for_event uses pseudoconstant notation for role and status", async () => {
    mock = await startMockCivicrm((call) => {
      const values = (call.params.values as Record<string, unknown>) ?? {};
      assert.equal(values["role_id:name"], "Attendee");
      assert.equal(values["status_id:name"], "Registered");
      return api4Success([{ id: 99 }]);
    });
    const config = cfg(mock.url, { allowWrites: true });
    const client = new CivicrmClient(config);
    const res = await registerForEventTool.handler(
      { contact_id: 1, event_id: 2, role: "Attendee", status: "Registered" },
      { client, config },
    );
    assert.match(res.content[0]!.text, /Registered contact #1 for event #2/);
  });

  it("surfaces a server-side APIv4 error as CivicrmError in the tool handler", async () => {
    mock = await startMockCivicrm(() => api4Error("membership_type_id required", 1));
    const config = cfg(mock.url, { allowWrites: true });
    const client = new CivicrmClient(config);
    await assert.rejects(
      () =>
        recordContributionTool.handler(
          {
            contact_id: 1,
            total_amount: 10,
            currency: "USD",
            financial_type: "Donation",
            contribution_status: "Completed",
            is_test: false,
          },
          { client, config },
        ),
      /membership_type_id required/,
    );
  });
});
