# Contributing

Thanks for your interest in civicrm-mcp. This is a small project with a narrow scope — the goal is a reliable MCP server that stays close to CiviCRM's APIv4 surface.

## Local setup

```bash
git clone https://github.com/YOUR-USER/civicrm-mcp.git
cd civicrm-mcp
npm install
npm run build
npm test
```

Tests run offline with a mocked `fetch` — no CiviCRM install required for CI.

## Testing against a real CiviCRM

For end-to-end checks you will need:

- A CiviCRM install (≥ 5.47) on Drupal, WordPress, Backdrop, or Standalone.
- A dedicated "MCP Bot" contact with the minimum permissions you want to expose (`access CiviCRM`, `view all contacts`, `authenticate with api key`).
- That contact's API key.

Copy `.env.example` to `.env`, fill in the credentials, then run the server under an MCP client such as Claude Desktop or Claude Code (see `README.md`).

## Adding a new tool

1. Create `src/tools/<slug>.ts`.
2. Export a `ToolDefinition` — name it `civicrm_<verb>_<noun>` (snake case).
3. Use `zod` for `inputSchema`; be explicit with `.describe(...)` — the descriptions are shown to the LLM.
4. Write actions **must** go through `client.api4(entity, writeAction, params)` so the env-flag gating applies.
5. Return results via `textResult(summary, structuredPayload)` — human summary in `content`, machine-readable copy in `structuredContent`.
6. Register it in `src/tools/index.ts` under the right section header.
7. Add a test in `src/__tests__/tools.test.ts` if the schema has non-trivial validation.

## Coding conventions

- TypeScript strict mode, `noUncheckedIndexedAccess`, ES modules.
- British English in prose, American spelling only where dictated by APIs.
- Do not log credentials. `stdout` is reserved for the MCP protocol; use `process.stderr` for logs.
- No inline colours or emoji in user-facing text.

## Releasing

Releases are automated via GitHub Actions. Publishing flow:

1. Bump `version` in `package.json`.
2. Bump `version` **and** `packages[0].version` in `server.json` to the same value.
3. Add an entry at the top of `CHANGELOG.md`.
4. Commit: `git commit -am "Release vX.Y.Z"`.
5. Tag and push: `git tag vX.Y.Z && git push --follow-tags`.

The `release.yml` workflow then:

- Runs typecheck, build, and tests.
- Verifies tag matches `package.json` and `server.json` versions.
- Publishes to npm with `--provenance` (requires `NPM_TOKEN` repo secret).
- Publishes to the MCP Registry via GitHub OIDC (no secret needed).

**First-time setup only:** add an `NPM_TOKEN` secret (automation token with `publish` scope) under the repo's Settings → Secrets and variables → Actions.
