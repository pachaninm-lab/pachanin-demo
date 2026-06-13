# Dual hosting operating rules

`main` is the single source of truth.

Hosting targets:
- Vercel: primary host.
- Netlify: reserve host.

Rules:
1. Netlify is not a replacement for Vercel.
2. Vercel must not be deleted, disconnected, or demoted by a routine platform PR.
3. Claude/Codex/assistant work must merge through `main`.
4. Product PRs must not silently change hosting behavior.
5. Hosting PRs must not change platform UI, business logic, routes, API, DB, live integrations, apps/landing, or lockfiles unless explicitly scoped.
6. If one host fails and the other works, treat it as hosting/runtime divergence first.
7. Do not rewrite product code until logs prove product code is the cause.

Post-merge route check:
- Vercel: `https://pachanin-web.vercel.app/platform-v7/`
- Netlify: `https://gleaming-mandazi-bb9856.netlify.app/platform-v7/`

Recommended routes:
- `/platform-v7/`
- `/platform-v7/deals`
- `/platform-v7/bank`
- `/platform-v7/logistics`
- `/platform-v7/control-tower`
