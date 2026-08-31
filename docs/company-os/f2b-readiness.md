# Company OS F2B — read-only control-host readiness

Date: 2026-08-15
Authority: #4159
Production: REG.RU VPS
New recurring cost: 0 ₽

## Purpose

Before any DNS, Caddy, Compose, environment or application cutover for `control.процент-агро.рф`, run one bounded owner-only diagnostic that answers a single operational question: **is the existing production edge ready for a safe control-host cutover, or is an owner DNS action required first?**

The diagnostic is evidence-only. It cannot mutate production.

## Invocation

Authority issue: `#4159`.

Exact owner command:

`/company-os control-host-readiness`

The workflow additionally verifies repository owner actor/triggering actor and binds itself to exact current `main`.

## Public evidence

The runner observes, without mutation:

- A records for `control.процент-агро.рф`;
- AAAA presence;
- continued canonical A resolution of the primary domain;
- TLS certificate validity/name for the control host when the A record already reaches the canonical production VPS;
- HTTPS status when valid TLS is available.

No DNS value is invented or inferred from source configuration.

## Protected production evidence

Production SSH uses only protected repository secrets and requires:

- canonical production VPS identity;
- valid protected private key;
- exact pinned host fingerprint;
- root production principal;
- Docker and Docker Compose read access.

The diagnostic never prints private keys, host fingerprints, protected usernames, protected paths, Compose file paths or environment contents.

Remote inspection is read-only and reduces state to bounded markers:

- Caddy active/inactive;
- Caddy configuration validates or not;
- canonical control host already declared or not;
- Compose topology readable or not;
- web service present/running or not;
- immutable web image id;
- OCI source revision when available;
- `PC_CONTROL_HOST_ENABLED` only as `ENABLED`, `DISABLED_OR_ABSENT` or `UNKNOWN`.

It never performs Caddy reload/write, Compose up/down/restart, Docker image/container mutation, environment write or deployment.

## Classification

The result is exactly one of:

### `READY_FOR_EDGE_CUTOVER`

Control A record resolves only to the canonical VPS, no unverified AAAA route exists, pinned production access succeeds, Caddy/Compose baseline is healthy, web is running, and the application control-host feature remains disabled.

TLS/Caddy declaration for the *new* host may still be absent; those are expected F2B cutover operations after DNS readiness.

### `OWNER_DNS_ACTION_REQUIRED`

Used when:

- control A record is absent;
- control A record points elsewhere;
- an unverified AAAA record could route control traffic through a different edge.

No production edge mutation should proceed until that DNS state is corrected and the diagnostic is rerun.

### `BLOCKED_READINESS`

Used when protected production access cannot be proven, the current Caddy/Compose baseline is unhealthy/unreadable, the web service is not running, or the control-host feature is already unexpectedly enabled before edge acceptance.

## Acceptance boundary

A successful readiness workflow is not a production cutover. Its only authority is to determine the next safe F2B action.

Actual F2B completion still requires:

1. DNS readiness;
2. Caddy control-host declaration and valid certificate;
3. accepted exact-SHA application release;
4. production enablement of `PC_CONTROL_HOST_ENABLED=true` only after edge readiness;
5. live parent-host staff redirect/API fail-closed evidence;
6. host-only cookie isolation proof;
7. Origin/CSRF negative matrix;
8. ordinary external-user rejection;
9. staff capability-authorized landing;
10. revoked/expired access fail-closed;
11. browser/mobile smoke;
12. rollback evidence.

Merge, CI, diagnostic success and image publication alone are not production evidence.
