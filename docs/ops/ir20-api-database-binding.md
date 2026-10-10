# IR-20 API/database binding prerequisite

Base: `8f3617db114f45a5212eb8974fec7832d2f7bce5`, after accepted #5429.
IR-20 remains active. The isolated restore executor is merged, but its source
selection is expressly not proof of binding to the canonical API. The observed
REG.RU diagnostic `35440449136` also left deployment and rollback unproven.

## Narrow responsibility

`ir20-api-database-binding.py` is a read-only, dependency-injected primitive for
that missing binding. A protected caller supplies an intended source SHA, full
API/source container IDs, and the expected Compose project. The helper validates
those identities and the PostgreSQL 16/source configuration. It does not accept
a connection string or copy credentials outside the API container.

The helper starts the existing API image's installed Prisma client in a bounded
read-only transaction using its default database configuration. It sets a fresh
128-bit random transaction-local `application_name` and obtains the actual
backend PID. While that transaction is held, a separate read-only source socket
query must see exactly that marker and PID in `pg_stat_activity`, attached to the
source-selected database. Matching database names, Docker aliases or a copied
configuration alone cannot satisfy this challenge.

This proves the default API client and selected source SQL session reach the
same live database. It does not identify every module-specific connection. It
does not prove that the chosen API is the one served by the public domain.
The controller must establish canonical API identity separately, select the
connection appropriate to the affected flow, and preserve the production lock
from binding through backup. This primitive is not permission to substitute the
default API principal for the required `app_deal` or `app_outbox` principals.

After the source proof, the API read-only transaction must finish successfully
and acknowledge completion. Container configuration, image, process start,
restart count, mounts and network metadata must remain stable. Ordinary Docker
health-log refreshes are not classified as a recreate. Connection strings,
principals, database names, inspected configuration and the marker are never
part of public output. The marker may appear in existing server session logs;
it is not a credential and contains no customer information.

## Limits and authority

Docker is pinned to the local Unix daemon, with no shell interpolation or
inherited Docker context. A child command has bounded time and output. The API
process also has its own 15-second watchdog, a 12-second transaction bound and
a 10-second idle-transaction timeout, so killing the outer Docker client does
not leave an unbounded transaction. Loss of the control pipe, a missing marker,
ambiguous evidence, malformed metadata, failed completion or runtime change
prevents a successful report. The containing controller must still enforce its
own total deadline and serialize all release operations.

The only session effect is temporary `application_name`; there are no business
row changes, migrations, dumps, backups, container mutations, new grants or
persistent configuration changes. All production invocation, protected backup
policy, read-load admission, archive encryption/retention/off-host handling and
release/rollback responsibilities remain with a separately reviewed controller.
No production entry point is added by this PR.

The report explicitly retains:

- `canonical_api_identity=CALLER_REQUIRED_NOT_PROVEN`;
- `restore_authorized=false`, `deployment_authorized=false`;
- `backup_created=false`, `live_delivery=NOT_PERFORMED`.

`target_sha` records the caller's intended source SHA; it is not proof of current
main, image revision or release admission. A binding report is ephemeral and
must not be reused after a release/restart or outside the controller's lock.

## Verification

Run `python3 -B scripts/release/test-ir20-api-database-binding.py`.
The suite exercises successful and rejected injected runtime observations,
identity/nonce/PID mismatch, duplicate metadata, failed transaction completion,
runtime drift, redaction, actual subprocess output/time limits, and the actual
embedded Node control-pipe protocol with only Prisma replaced by a test double.

The local run on 2026-09-19 completed 25 tests successfully. This is synthetic
and real-process protocol evidence, **not real PostgreSQL, an actual API image,
independent review or REG.RU acceptance**. Real PostgreSQL challenge validation
and independent exact-head source review remain required before operational
admission. The new CI workflow has read-only contents/package permissions, no production
secrets or access, and no owner-command or manual-dispatch event. Its ephemeral
GITHUB_TOKEN is used only to read the existing digest-pinned PostgreSQL mirror.

An additional GitHub-hosted-only integration fixture runs the actual source
query against real PostgreSQL 16. It tests the positive backend challenge, a
wrong database in the same cluster and a same-named database in another cluster.
Its API-side transport is deliberately psql, not the production Prisma image;
the Node/Prisma protocol and live API image remain distinct acceptance layers.
No fixture result has been observed locally because Docker/PostgreSQL are not
available in this execution environment. The workflow must complete this test;
its existence or a synthetic unit PASS is not an integration PASS.

Current review and admission policy remains unchanged. A fresh independent
reviewer must inspect the complete exact-head diff and its limitations; the
implementation author's tests or self-audit are not that review. Full IR-20
closure still requires reviewed protected restore/release, immutable production
worker/broker topology, compatible migration/rollback, functional live outbox
acceptance and at least 30 minutes of observation.

Primary protocol references:
- PostgreSQL 16 application_name and visibility in pg_stat_activity:
  https://www.postgresql.org/docs/16/runtime-config-logging.html
- PostgreSQL 16 statistics/session view:
  https://www.postgresql.org/docs/16/monitoring-stats.html
- Prisma interactive transaction maxWait/timeout and commit/rollback behavior:
  https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions
