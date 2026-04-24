import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { allTools } from "../tools/index.js";

describe("tool registry", () => {
  const tools = allTools();

  it("registers the expected set of tools", () => {
    const names = new Set(tools.map((t) => t.name));
    for (const expected of [
      "civicrm_system_info",
      "civicrm_find_contacts",
      "civicrm_get_contact",
      "civicrm_get_relationships",
      "civicrm_get_contributions",
      "civicrm_list_events",
      "civicrm_list_entities",
      "civicrm_describe_entity",
      "civicrm_create_contact",
      "civicrm_update_contact",
      "civicrm_log_activity",
      "civicrm_record_contribution",
      "civicrm_add_to_group",
      "civicrm_remove_from_group",
      "civicrm_register_for_event",
      "civicrm_create_membership",
      "civicrm_api4",
    ]) {
      assert.ok(names.has(expected), `missing tool ${expected}`);
    }
  });

  it("names are unique", () => {
    const names = tools.map((t) => t.name);
    assert.equal(new Set(names).size, names.length);
  });

  it("every tool has a non-empty title and description", () => {
    for (const t of tools) {
      assert.ok(t.title.length > 0, `${t.name} missing title`);
      assert.ok(t.description.length > 10, `${t.name} has weak description`);
    }
  });

  it("every tool has a zod input schema", () => {
    for (const t of tools) {
      assert.ok(
        typeof t.inputSchema.safeParse === "function",
        `${t.name} is missing a zod schema`,
      );
    }
  });

  it("find_contacts requires a query", () => {
    const tool = tools.find((t) => t.name === "civicrm_find_contacts")!;
    assert.equal(tool.inputSchema.safeParse({}).success, false);
    assert.equal(tool.inputSchema.safeParse({ query: "alice" }).success, true);
  });

  it("record_contribution rejects zero amount", () => {
    const tool = tools.find((t) => t.name === "civicrm_record_contribution")!;
    assert.equal(
      tool.inputSchema.safeParse({ contact_id: 1, total_amount: 0 }).success,
      false,
    );
    assert.equal(
      tool.inputSchema.safeParse({ contact_id: 1, total_amount: 10 }).success,
      true,
    );
  });
});
