# Epic 00: Discovery baseline for platform-v7

## Acceptance criteria

- [x] Repository and app contour identified.
- [x] Initial route map created in `docs/codebase-map.md`.
- [x] Initial data-source map created in `docs/data-sources.md`.
- [x] Baseline runbook created in `docs/baseline/README.md`.
- [ ] Lighthouse JSON artifacts committed. Not done in this session because the tool environment did not expose a local clone with installed dependencies and browser runtime.
- [ ] Playwright link crawler committed. GitHub write tool blocked test-file creation twice; must be added from local Codex/CI.

## What changed

- Files added: 3
  - `docs/codebase-map.md`
  - `docs/data-sources.md`
  - `docs/baseline/README.md`

## Key findings

1. Accessible repository with matching `platform-v7`: `pachaninm-lab/pachanin-demo`.
2. Vercel web project observed: `pachanin-canonical-web`.
3. Public domain observed: `pachanin-web.vercel.app`.
4. Actual web stack is Next.js 14 / React 18, while the task spec assumes Next.js 15 / React 19.
5. Data sources are currently dispersed across `apps/web/lib/v7r`, `apps/web/mocks/fixtures`, `apps/web/stores`, `shared`, `apps/web/lib/pilot-data.ts`, `apps/web/lib/runtime-*`, and `config/fixtures`.
6. `platform-v7` and `platform-v7r` coexist. Treat this as a drift risk.
7. Historical hardening notes confirm false `/platform-v9/` links inside `platform-v7` pages.

## Lighthouse delta

Not available yet. Baseline must be generated before E1 code changes.

| Page | Perf | A11y | BP | SEO |
|---|---:|---:|---:|---:|
| /platform-v7/control-tower | — | — | — | — |
| /platform-v7/deals | — | — | — | — |
| /platform-v7/bank | — | — | — | — |
| /platform-v7/disputes | — | — | — | — |
| /platform-v7/demo | — | — | — | — |

## Known issues

- Cannot honestly claim full Discovery is complete until local/CI commands run.
- Test-file creation through the GitHub connector was blocked by safety checks; local Codex should add `tests/e2e/discovery-link-crawler.spec.ts` or equivalent.
- `main` should not be changed blindly. Continue through branch/PR gates.

## Next epic dependencies

Before E1:

1. Run build/test baseline.
2. Commit Lighthouse JSON artifacts.
3. Add route/link crawler locally if the GitHub connector remains blocked.
4. Confirm canonical folder location for domain layer: `apps/web/src/domain` vs `apps/web/lib/domain`.
