# Changelog

All notable changes to this project will be documented in this file. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- `civicrm_system_info` tool — connectivity / version / auth sanity check.
- Unit tests for URL builder, config loader, AuthX client (mocked `fetch`), and tool registry.
- GitHub Actions CI across Node 18 / 20 / 22.
- `CONTRIBUTING.md`.

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
