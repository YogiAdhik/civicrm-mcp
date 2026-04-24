<!-- Thanks for contributing to civicrm-mcp. -->

## Summary

<!-- What changed and why, in two or three sentences. -->

## Type of change

- [ ] New tool
- [ ] Tool behaviour change
- [ ] Bug fix
- [ ] Documentation
- [ ] Build / CI / release tooling
- [ ] Other (describe above)

## Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (unit + integration)
- [ ] If a new tool was added, it is registered in `src/tools/index.ts` and covered by a tool-registry assertion
- [ ] Write/delete actions go through `client.api4(...)` so env-gating applies
- [ ] Credentials are not logged or returned in tool output
- [ ] `CHANGELOG.md` has an entry under `[Unreleased]`
