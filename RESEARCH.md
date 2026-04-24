# CiviCRM MCP Server — Research Notes

Research date: 2026-04-23
Scope: understand CiviCRM architecture, API surface, authentication, and prior MCP art well enough to design an MCP server.

---

## 1. CiviCRM at a glance

- Open-source CRM written in PHP, installs as a module/plugin on top of a CMS.
- Supported CMS hosts: **Drupal**, **Backdrop**, **WordPress**, **Joomla**, plus a new **Standalone** mode (no CMS).
- Multi-tenant per site — each install has its own MySQL DB, its own `civicrm.settings.php`, its own site key and user accounts.
- Business logic is exposed through a first-class API layer. Direct SQL is discouraged because the API fires hooks that extensions and workflows depend on.

## 2. Two API versions

| | APIv3 | APIv4 |
| --- | --- | --- |
| Status | Maintenance-only (regression fixes) | Active, recommended |
| Style | Not strictly REST; `?entity=&action=&json=` | Entity/Action pair in URL path, SQL-like params |
| Endpoint | `/civicrm/ajax/rest` (or legacy `extern/rest.php`, deprecated ≥5.47) | `/civicrm/ajax/api4/{Entity}/{Action}` |
| Parameter style | Flat params + `json={...}` | JSON body (`params={...}` on GET) |
| Can coexist | Yes — both usable in same install |

**Decision:** target APIv4 as the primary surface. Keep APIv3 as an optional fallback tool for legacy entities that aren't yet ported.

## 3. APIv4 request anatomy

**URL per CMS host:**
- Drupal / Backdrop / Standalone: `https://site/civicrm/ajax/api4/{Entity}/{Action}`
- WordPress: `https://site/wp-admin/admin.php?page=CiviCRM&q=civicrm/ajax/api4/{Entity}/{Action}`
- Joomla: `https://site/administrator/index.php?option=com_civicrm&task=civicrm/ajax/api4/{Entity}/{Action}`

**Required header:** `X-Requested-With: XMLHttpRequest` (CSRF-style gate).

**Methods:** POST for writes, GET allowed for reads.

**Body (POST):** JSON object of action params.
**Query (GET):** `?params=<urlencoded-json>`.

**Example:**
```bash
curl -X POST "$BASE/civicrm/ajax/api4/Contact/get" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"where":[["last_name","=","Adams"]],"limit":25}'
```

**Response shape:**
```json
{ "version": 4, "count": 3, "values": [ { "id": 1, ... }, ... ] }
```

**Error shape:**
```json
{ "error_code": 0, "error_message": "..." }
```

## 4. Authentication (AuthX)

AuthX is the core auth extension (bundled since **5.36**) that unifies credentialed API access across all CMS hosts. Three transports, any of which carries the credential:

| Transport | Example |
| --- | --- |
| `Authorization` header | `Authorization: Bearer <API_KEY>` |
| `X-Civi-Auth` header | `X-Civi-Auth: Bearer <API_KEY>` |
| Query string | `?_authx=Bearer+<API_KEY>` |

Supported credentials: **API key**, **JWT**, **Basic `user:pass`** (base64).

**Guards** (admin-configurable):
- *Permission guard* — caller must hold `authenticate with api key` (or `authenticate with password`) permission.
- *Site-key guard* — caller must also know `CIVICRM_SITE_KEY` (PHP constant in `civicrm.settings.php`).

Either guard can be enabled independently. Many hardened sites require both.

**Legacy APIv3 REST** additionally accepts `api_key=...&key=<site_key>` as raw query params. Our MCP server should prefer AuthX and only fall back to legacy on user request.

## 5. API keys in practice

- An API key belongs to **a Contact** in CiviCRM. The API call runs with that Contact's CMS-user permissions.
- Key storage: `civicrm_contact.api_key` column. The `API Key` extension adds a UI; otherwise admins set it via Contact summary → *More* → *API Key* or direct SQL:
  ```sql
  UPDATE civicrm_contact SET api_key='…' WHERE id=123;
  ```
- Recommended: **create a dedicated "MCP Bot" Contact + CMS user** with the minimum permissions (`access CiviCRM`, `view all contacts`, etc.) needed for the workflows exposed. Never use a superadmin key.
- Site key is one secret per install, lives in `civicrm.settings.php`:
  - Drupal: `sites/default/civicrm.settings.php`
  - WordPress: `wp-content/uploads/civicrm/civicrm.settings.php`
  - Joomla: `administrator/components/com_civicrm/civicrm.settings.php`

## 6. APIv4 conceptual model

Every call is **Entity + Action + Params**.

**Standard actions** (inherited by most DAO-backed entities):
- Read: `get`, `autocomplete`, `export`
- Write: `create`, `update`, `save` (upsert w/ `match`), `delete` (soft by default; `useTrash=false` for hard), `replace` (dangerous — implicit bulk delete)
- Metadata: `getFields`, `getActions`, `getLinks`, `checkAccess`
- Managed: `revert`

Entity-specific actions exist (e.g. `Afform.submit`, `Job.execute`, `Mailing.send`, `Contribution.sendReceipt`). Use `getActions` to enumerate.

**Common `get` params:**
- `select: []` — columns + joined fields + expressions (`COUNT(*)`, `MAX(x)`).
- `where: [[field, op, value], ...]` — SQL-like. Operators: `=`, `!=`, `>`, `>=`, `<`, `<=`, `LIKE`, `NOT LIKE`, `IN`, `NOT IN`, `IS NULL`, `IS NOT NULL`, `BETWEEN`, `CONTAINS`, `REGEXP`.
- `having: [...]` — filter on aggregates/expressions.
- `join: [[Entity AS alias, type, [on-conditions]]]` — `LEFT` or `INNER`.
- `orderBy: {field: "ASC|DESC"}`
- `limit`, `offset`
- `groupBy: []`
- `chain: {name: [Entity, Action, Params]}` — nested calls per result; back-refs use `$field` (e.g. `$id`).

**Implicit joins** — dot-notation pulls related entity fields without declaring a join:
```json
{ "select": ["id","display_name","email_primary.email","address_primary.city"] }
```

## 7. Custom fields

- Custom fields live in **Custom Groups** attached to an entity (Contact, Activity, …).
- APIv4 addresses them with the notation `CustomGroupName.field_name` in `select`, `where`, and `values`:
  ```json
  { "select": ["id","Donor_Profile.preferred_contact_method"],
    "where": [["Donor_Profile.donor_level","=","Gold"]] }
  ```
- `getFields` (with `loadOptions: true`) returns every custom field plus its option list (pseudoconstants). The MCP server should call `getFields` at startup per entity and cache the schema so tool arg-help reflects the live site.

## 8. Prior art — what already exists

- **johncallhub/civicrm-mcp-server** (GitHub, JS/Node, npm-installable). Covers Contacts/Activities/Contributions/Events/Memberships CRUD + `system_info`. Auth via `CIVICRM_BASE_URL` + `CIVICRM_API_KEY`. Gaps: relationships, cases, pledges, grants, mailings, groups membership ops, reports, advanced joins/chains, no obvious AuthX guard-awareness, no introspected `getFields` tooling beyond contacts.
- No Python MCP server for CiviCRM located as of 2026-04-23.
- Not in the official MCP Registry.

**Opportunity:** there is room for a second, more complete and schema-driven server. Differentiators we could aim for:
1. **Schema introspection** — at connect time call `getFields`/`getActions` for configured entities and expose that as MCP resources + richer tool schemas.
2. **AuthX-first** — support JWT + site-key guard, not just API key query params.
3. **Write safety** — destructive actions (`delete`, `replace`, `update` without `where`) gated behind an explicit env flag or per-call `confirm: true`.
4. **APIv3 fallback tool** for entities APIv4 doesn't cover.
5. **Generic passthrough** tool `civicrm_api4(entity, action, params)` for power users, plus a curated set of high-level tools (`find_contact`, `log_activity`, `record_contribution`, `add_to_group`) for common flows.

## 9. MCP design principles (from spec)

- Tools are **model-controlled**; humans confirm destructive ops. The server should still gate writes — don't rely only on the client UI.
- Each tool needs a name, description, JSON-Schema `inputSchema`, optional `outputSchema`.
- Errors: return `isError: true` in the result content for business/API errors; use JSON-RPC errors only for unknown-tool/invalid-args.
- Sanitise outputs (CiviCRM responses can contain large HTML blobs in activity details).
- Timeouts + rate limiting on the server side. Never log credentials.

## 10. Proposed MCP server — high-level design

**Stack:** TypeScript, `@modelcontextprotocol/sdk`, stdio transport. Matches user's existing Next/Vercel toolchain; easy to add HTTP/SSE later for remote use.

**Config (env vars):**
- `CIVICRM_BASE_URL` — e.g. `https://crm.example.org`
- `CIVICRM_CMS` — `drupal` | `wordpress` | `joomla` | `standalone` (default `drupal`)
- `CIVICRM_API_KEY` — contact API key (Bearer)
- `CIVICRM_SITE_KEY` — optional, only needed if the install enables the site-key guard
- `CIVICRM_AUTH_MODE` — `authx` (default) | `legacy`
- `CIVICRM_ALLOW_WRITES` — `false` (default) | `true`
- `CIVICRM_ALLOW_DELETES` — `false` (default) | `true`
- `CIVICRM_ENTITIES` — comma list to limit which entities get introspected (perf)

**Tool surface (MVP):**

Curated:
- `civicrm_find_contacts(query, limit?)` — name/email/phone search, returns id + display_name + primary email.
- `civicrm_get_contact(id, fields?)` — full contact incl. resolvable custom groups.
- `civicrm_create_contact(contact_type, values)` — write-gated.
- `civicrm_update_contact(id, values)` — write-gated.
- `civicrm_log_activity(contact_id, activity_type, subject, details?, status?)` — write-gated.
- `civicrm_record_contribution(contact_id, amount, currency, financial_type, received_date?, payment_instrument?)` — write-gated.
- `civicrm_add_to_group(contact_id, group_id)` / `civicrm_remove_from_group` — write-gated.
- `civicrm_list_events(upcoming_only?, limit?)`, `civicrm_register_for_event(contact_id, event_id)`.

Passthrough:
- `civicrm_api4(entity, action, params)` — general escape hatch; writes still gated.
- `civicrm_api3(entity, action, params)` — legacy fallback, off by default.

Introspection:
- `civicrm_list_entities()` — from `Entity.get`.
- `civicrm_describe_entity(entity)` — wraps `getFields` + `getActions`, returns typed field list incl. custom fields.

**Resources (MCP `resources/`):**
- `civicrm://schema/{entity}` — cached `getFields` output per entity, refreshed on `list_changed` signal.
- `civicrm://system/info` — version, extensions, permissions of the bot user.

**Safety rails:**
- On startup, call `Contact.get` with the bot's own key to confirm auth and resolve `bot_contact_id`.
- Refuse `delete` unless `id` or narrow `where` present; refuse `replace` unless `CIVICRM_ALLOW_DELETES=true`.
- Strip known PII-heavy fields from default selects (SSN-like custom fields, notes) unless explicitly requested.
- Redact credentials and any `api_key`/`hash` fields before returning to the model.

**Error handling:**
- HTTP 200 with `error_message` → surface as tool error (`isError: true`).
- HTTP 401/403 → surface as auth failure with guidance (check API key permissions, site-key guard).
- HTTP 404 → surface as "endpoint not reachable; verify `CIVICRM_CMS` and `CIVICRM_BASE_URL`".

## 11. Open questions before coding

1. Target a specific CiviCRM version floor? (Recommend **≥5.47** — AuthX stable, `extern/rest.php` removed.)
2. Is the first target site Drupal, WordPress, or Standalone? Affects the URL builder test suite.
3. Do we want to publish to npm under the user's name/org, or keep private?
4. Desired MCP transport: stdio-only (Claude Desktop/Code) or also HTTP (n8n, Zapier-alike)?

## 12. Sources

- CiviCRM Developer Guide — API overview, APIv4 usage, REST, actions, chaining.
- CiviCRM System Administrator Guide — API keys, site keys, AuthX.
- MCP specification (modelcontextprotocol.io) — tools, error model, security.
- `johncallhub/civicrm-mcp-server` (GitHub) — prior-art scope review.
