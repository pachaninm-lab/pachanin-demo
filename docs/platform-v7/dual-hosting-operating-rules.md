# Hosting operating rules

> Formerly "dual hosting". Both hosts named in the original document are gone:
> Vercel was decommissioned first, Netlify was removed on 2026-07-26. There is
> one production host. This doc is kept at its old path because dated audit and
> due-diligence records link to it.

`main` is the single source of truth.

Hosting target:

- **REG.RU virtual server: sole production host.** `процент-агро.рф`, IPv4
  `195.19.12.120`, Caddy edge, Docker Compose runtime, GHCR image registry.
- There is no secondary host. See `docs/ops/active-hosting-contour.md` for the
  authoritative contour and `CANONICAL_DEPLOY.md` for the release definition.

Retired providers:

- Netlify is retired. Its configuration, build plugin, deploy workflows and
  smoke targets were removed from this repository on 2026-07-26.
- Vercel is retired.
- Deploys, previews, commit statuses, check runs and URLs from retired providers
  are never production evidence and must never be used as release gates. If a
  check run from a retired provider still appears on a pull request, its
  integration is still installed at the provider or GitHub App level and must be
  disconnected there — no commit in this repository can remove it.

Rules:

1. Assistant (Claude/Codex) work must merge through `main`.
2. Product PRs must not silently change hosting behavior.
3. Hosting PRs must not change platform UI, business logic, routes, API, DB, live integrations, apps/landing, or lockfiles unless explicitly scoped.
4. Do not rewrite product code until logs prove product code is the cause.
5. A merge, a green CI run or a published GHCR image does not prove that
   production changed. Without evidence from the virtual server and the live
   domain, the correct state is **deployment pending**.

Post-merge route check:

- Production: `https://процент-агро.рф/platform-v7/`

Recommended routes:
- `/platform-v7/`
- `/platform-v7/deals`
- `/platform-v7/bank`
- `/platform-v7/logistics`
- `/platform-v7/control-tower`
