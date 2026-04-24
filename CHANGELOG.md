# Changelog

All notable changes to this project will be documented in this file. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.1] - 2026-04-24

### Fixed
- MCP Registry namespace case-corrected to `io.github.YogiAdhik/civicrm-mcp` to match the canonical GitHub handle (the registry is case-sensitive on the user segment).

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
