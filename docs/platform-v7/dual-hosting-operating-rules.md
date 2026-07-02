# Hosting operating rules

> Formerly "dual hosting". Vercel has been decommissioned — **Netlify is now the
> sole production host.** This doc is kept at its old path to avoid breaking links.

`main` is the single source of truth.

Hosting target:
- **Netlify: sole production host** (deployed via the Netlify Git integration on
  push to `main`; see `netlify.toml`).
- A secondary Netlify site exists as a non-fatal warning check only.

Rules:
1. Assistant (Claude/Codex) work must merge through `main`.
2. Product PRs must not silently change hosting behavior.
3. Hosting PRs must not change platform UI, business logic, routes, API, DB, live integrations, apps/landing, or lockfiles unless explicitly scoped.
4. Do not rewrite product code until logs prove product code is the cause.

Post-merge route check:
- Netlify (primary): `https://vermillion-kitsune-0e7b97.netlify.app/platform-v7/`
- Netlify (secondary, non-fatal): `https://gleaming-mandazi-bb9856.netlify.app/platform-v7/`

Recommended routes:
- `/platform-v7/`
- `/platform-v7/deals`
- `/platform-v7/bank`
- `/platform-v7/logistics`
- `/platform-v7/control-tower`
