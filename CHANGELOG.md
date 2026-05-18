# Changelog

All notable changes to this project will be documented in this file. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] - 2026-05-18

Safety hardening + capability expansion. Read the new Safety section in the README.

### Added — safety primitives

- **`CIVICRM_ALLOW_GENERIC_API`** env flag. Gates the `civicrm_api4` passthrough independently of `CIVICRM_ALLOW_WRITES`. The typed write tools (`civicrm_update_contact`, etc.) stay narrower; the generic passthrough is the wider blast radius and now needs its own opt-in.
- **`CIVICRM_DRY_RUN_DEFAULT`** env flag. When `true`, every write/delete action is short-circuited inside the client — the would-be APIv4 call is returned without touching CiviCRM. Reads pass through normally.
- **`CIVICRM_TOOLS_ENABLED`** and **`CIVICRM_TOOLS_DISABLED`** env flags. Comma-separated allow/deny lists for the tool surface. `DISABLED` wins over `ENABLED`. Matches the GitHub MCP server convention.
- **Structured audit log** to stderr. One JSON line per tool call: timestamp, tool name, args (with secrets redacted by key pattern), dry-run flag, status, duration, error code/message. Designed for ops review and board-level transparency.

### Added — new tools

- **`civicrm_whoami`** — resolves the bot contact and probes which CiviCRM entities it can read (Contact, Activity, Contribution, Event, Membership, Group, Tag, Note, Case, Mailing, Pledge). Eliminates the #1 setup question ("does my API key have the right permissions?").
- **`civicrm_list_saved_searches`** and **`civicrm_run_saved_search`** — execute SearchKit `SavedSearch`/`SearchDisplay` queries by name. Lets admins curate complex queries in the CiviCRM UI and have an agent run them safely. Highest-leverage primitive in modern CiviCRM.
- **`civicrm_describe_field_options`** — return the option list for one field (e.g. valid `activity_type_id` values) without pulling the full entity schema. Significantly cuts tokens for enum-discovery.
- **`civicrm_add_note`** — attach a free-text Note to a contact, contribution, activity, case, or relationship. Write-gated.
- **`civicrm_tag_contacts`** and **`civicrm_untag_contacts`** — bulk-tag or untag up to 500 contacts in one call. Accepts a tag id or name. Untag requires `CIVICRM_ALLOW_DELETES=true`.
- **`civicrm_send_contribution_receipt`** — wraps `Contribution.sendReceipt` (with `sendconfirmation` fallback for older 5.x sites). High-frequency stewardship verb.

### Changed

- README Safety section rewritten as a threat-model story rather than a list of mechanisms. Names prompt-injection risks via tool input *and* tool output; documents the five layers of defence (CiviCRM permissions → env-flag gates → per-call MCP-client approval → response hygiene → stdio-only transport); explicitly clarifies that per-call approval is the MCP client's job, not the server's.
- `civicrm_system_info` and the startup log line now surface the new flags (`allowGenericApi`, `dryRunDefault`, tool allowlist size).

### Notes

- This is a small breaking change for anyone already using `civicrm_api4` — they will need to set `CIVICRM_ALLOW_GENERIC_API=true` in addition to the existing `CIVICRM_ALLOW_WRITES`/`CIVICRM_ALLOW_DELETES` flags they had.
- Documented CiviCRM floor is unchanged at 5.47 but realistic-modern target is 6.10 ESR (PHP 8.0+). See `RESEARCH.md` 2026-05 addendum for the 6.x landscape.

## [0.1.1] - 2026-04-24

### Fixed
- MCP Registry namespace case-corrected to `io.github.YogiAdhik/civicrm-mcp` to match the canonical GitHub handle (the registry is case-sensitive on the user segment).

## [0.1.2] - 2026-04-24

### Fixed
- **CRITICAL**: APIv4 REST requests now send parameters as form-urlencoded `params=<json>`, not a raw JSON body. Against a live CiviCRM, the raw-JSON form was silently ignored — every call returned every row, bypassing `select`, `where`, and `limit`. The docs snippet at docs.civicrm.org (which shows `-d '{...}'`) implies JSON works; it does not.
- `civicrm_system_info` used `System.get`, which does not exist in APIv4. Replaced with `Domain.get` for version + `Extension.get` for installed-extension count.
- Integration-test mock server now understands form-urlencoded bodies too.

## [Unreleased]

### Added
- `civicrm_system_info` tool — connectivity / version / auth sanity check.
- `civicrm_get_relationships` — lists a contact's relationships with direction (A→B / B→A) resolved automatically.
- `civicrm_get_contributions` — filtered contribution history with running sum.
- `civicrm_list_events` and `civicrm_register_for_event` — CiviEvent read and registration.
- `civicrm_create_membership` — Membership.create with date auto-calculation.
- Unit tests for URL builder, config loader, AuthX client (mocked `fetch`), and tool registry.
- GitHub Actions CI across Node 18 / 20 / 22.
- Release automation workflow: publishes to npm (with provenance) and the MCP Registry (via GitHub OIDC) on `v*.*.*` tag push.
- `CONTRIBUTING.md`.
- `docs/INSTALL_CIVICRM.md` — beginner guide to CiviCRM Standalone via DDEV.
- `server.json` manifest for the MCP Registry.
- Integration test harness (in-process mock APIv4 HTTP server) and 10 end-to-end tests covering URL path, Bearer header, PII redaction, relationship direction, contribution totals, event filtering, write gating, and error propagation.
- `SECURITY.md`, GitHub issue templates (bug, feature), and pull-request template.

## [0.1.0] - 2026-04-23

Initial release.

### Added
- MCP server scaffold (TypeScript, `@modelcontextprotocol/sdk`, stdio transport).
- AuthX-first HTTP client with legacy `api_key` + `site_key` fallback.
- URL builder for Drupal, WordPress, Backdrop, and Standalone.
- Env-gated write and delete protection (`CIVICRM_ALLOW_WRITES`, `CIVICRM_ALLOW_DELETES`).
- Eleven tools: `civicrm_find_contacts`, `civicrm_get_contact`, `civicrm_list_entities`,
  `civicrm_describe_entity`, `civicrm_create_contact`, `civicrm_update_contact`,
  `civicrm_log_activity`, `civicrm_record_contribution`, `civicrm_add_to_group`,
  `civicrm_remove_from_group`, `civicrm_api4` passthrough.
- `.env.example`, MIT `LICENSE`, `README.md`, and `RESEARCH.md` design notes.
