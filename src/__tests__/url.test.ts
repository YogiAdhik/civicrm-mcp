import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { buildApi4Url } from "../civicrm/url.js";

describe("buildApi4Url", () => {
  const base = "https://crm.example.org";

  it("builds a clean path for Drupal", () => {
    assert.equal(
      buildApi4Url({ baseUrl: base, cms: "drupal", entity: "Contact", action: "get" }),
      "https://crm.example.org/civicrm/ajax/api4/Contact/get",
    );
  });

  it("uses the same path for Standalone and Backdrop", () => {
    const entity = "Activity";
    const action = "create";
    const standalone = buildApi4Url({ baseUrl: base, cms: "standalone", entity, action });
    const backdrop = buildApi4Url({ baseUrl: base, cms: "backdrop", entity, action });
    assert.equal(standalone, "https://crm.example.org/civicrm/ajax/api4/Activity/create");
    assert.equal(backdrop, standalone);
  });

  it("wraps the path for WordPress via admin-ajax-style URL", () => {
    const url = buildApi4Url({
      baseUrl: base,
      cms: "wordpress",
      entity: "Contact",
      action: "get",
    });
    assert.equal(
      url,
      "https://crm.example.org/wp-admin/admin.php?page=CiviCRM&q=civicrm/ajax/api4/Contact/get",
    );
  });

  it("URL-encodes entity and action segments", () => {
    const url = buildApi4Url({
      baseUrl: base,
      cms: "drupal",
      entity: "GroupContact",
      action: "save",
    });
    assert.ok(url.endsWith("/civicrm/ajax/api4/GroupContact/save"));
  });
});
