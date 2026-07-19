# Agent Operating Instructions

## Purpose

Accelerate platform-v7 without losing engineering discipline. Agents must follow repository state, not chat memory.

## Source of truth

Read these files before any change:

- `docs/platform-v7/autopilot/autopilot-state.json`
- `docs/platform-v7/execution-queue.md`
- `docs/platform-v7/autopilot/progress.json`
- `docs/platform-v7/autopilot/prompts/current-codex-task.md`
- `docs/platform-v7/autopilot/prompts/current-review-task.md`
- `CANONICAL_DEPLOY.md`
- `docs/ops/active-hosting-contour.md`

## Production hosting authority

- Production for `процент-агро.рф` runs only on the project virtual server at REG.RU. The current recorded public IPv4 is `195.19.12.120`; DNS must be checked before operational access because an address can change.
- The active request path is `Internet → Caddy → Docker Compose web container → Next.js`; API and stateful services are managed by the server-side Compose contour.
- Netlify and Vercel are retired. Their projects, previews, statuses, URLs and integrations are never production evidence and must not be used as release gates.
- `main` is source authority, not deployment authority. A merge, green CI run or published GHCR image does not prove that production changed.
- A production change is complete only after the virtual server runs the intended image, the container OCI label `org.opencontainers.image.revision` matches the target Git commit, Caddy routes the domain to the healthy service, and live smoke checks pass on `https://процент-агро.рф`.
- Application-image updates and server-infrastructure updates are different operations. Application images are built from `main`; Compose/Caddy/environment changes require an explicit update on the virtual server.
- The repository root `docker-compose.yml` is for local development and must never be treated as the production Compose authority.
- Never commit or print SSH users, private keys, passwords, registry tokens, production `.env` values or the protected server working-directory path.
- If virtual-server access is unavailable, report only “code merged / image built”; do not report “deployed”, “published” or “live”.

## Hard rules

- Work only inside the current `allowedCurrentScope` from `autopilot-state.json`.
- One PR equals one narrow current step.
- Do not rewrite platform-v7 from scratch.
- Do not touch `apps/landing`.
- Do not touch platform-v7 UI, visual, theme, onboarding, adapters, server actions, AI gateway, DB/migrations or lockfiles unless the current step explicitly allows it.
- Do not commit secrets.
- Keep maturity wording at controlled-pilot / pre-integration unless live contracts, credentials, deployments and real transaction evidence are confirmed.

## Forbidden claims

Do not introduce these claims in UI, docs, PR body, tests or code comments:

- production-ready
- fully live
- fully integrated
- platform guarantees payment
- платформа гарантирует оплату
- платформа сама выпускает деньги
- банк подключён
- ФГИС подключён
- ЭДО подключён

## Engineering rules

- Use explicit boundaries.
- Use dependency injection.
- Use typed results.
- Keep changes reviewable.
- Add or update tests for every implementation step.
- Do not use hidden singleton runtime state.
- Do not use module-level persistence state unless the current step explicitly permits it. For PR 5.5, persistence state must live only inside an explicit adapter instance.
- Do not bypass RBAC, idempotency, audit or action-boundary rules.

## Required checks

Run the closest available checks and document results in PR body:

- `node scripts/p7-autopilot-dispatcher.mjs`
- `bash scripts/p7-autopilot-guard.sh`
- `node scripts/check-production-hosting-authority.mjs`
- `pnpm typecheck`
- `pnpm test`

## PR body minimum

Include:

- Scope
- Changed files
- Guards
- Checks
- Known limitations
- Virtual-server deployment state: `not required`, `pending`, or `verified`, with the target Git SHA when applicable

## Codex role

Codex writes implementation PRs only for the current allowed step.

## Claude role

Claude should be used as reviewer, architect and risk auditor. Claude should not write competing implementation PRs for the same current step.

## Review rule

Review the diff, not the agent report. If changed files exceed allowed scope, block merge.
