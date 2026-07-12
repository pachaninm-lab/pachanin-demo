# platform-v7 Industrial Integration Readiness queue

CURRENT: IR-10.1 Documents PostgreSQL Authority

GOVERNING SPECIFICATION:
- `docs/platform-v7/autopilot/industrial-integration-readiness-v1.0.md`
- target gate: Industrial Integration-Ready;
- current gate: NO-GO;
- exact baseline: `66bf4655eede522ca3f3963d6d7aaa5cee9c50a5` on `main`.

BASELINE PROVEN:
- persistent identity, session rotation/revocation, MFA and one-time backup codes are merged with isolated PostgreSQL evidence (#2276, #2280, #2282, #2283);
- separate restricted auth and deal PostgreSQL principals are merged (#2287);
- canonical Deal command execution, idempotency, optimistic concurrency, bank-callback authority, transactional audit/outbox creation and isolated recovery evidence are merged (#2260, #2270, #2274, #2378, #2406);
- durable PostgreSQL outbox worker mechanics exist with leases and `FOR UPDATE SKIP LOCKED`, but IR-20 remains open because the legacy process-memory relay still starts;
- PostgreSQL bank reconciliation, immutable mismatch evidence and callback-key rotation/revocation are merged (#2379);
- ordinary Deal routes are PostgreSQL-authoritative and legacy free-form transitions fail closed (#2407);
- CI-scale correctness and isolated backup/restore are evidence only; they do not prove production capacity, HA or provider DR.

CURRENT GOAL:
- make Documents PostgreSQL-authoritative by construction;
- remove RuntimeCore and optional Prisma injection from the production Documents graph;
- preserve an explicit memory adapter only for test/development;
- enforce server-derived tenant, actor, role, deal and immutable-state authority through trusted RLS transactions;
- persist document workflow changes, audit and outbox atomically;
- prove restart, multi-instance, idempotency, concurrency and cross-tenant denial;
- keep object-storage retention and cryptographic provider activation outside this PR for IR-40 and IR-41;
- introduce no live EDO or signature claim.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/autopilot/industrial-integration-readiness-v1.0.md
- docs/platform-v7/execution-queue.md
- apps/api/src/common/config/industrial-mode.ts
- apps/api/src/modules/documents/**
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260713*_documents_postgresql_authority/**
- apps/api/test/industrial/document-postgresql-authority.e2e-spec.ts
- apps/api/test/industrial/deal-command-no-fake-live.e2e-spec.ts
- apps/api/test/one-deal/document-postgresql-authority.e2e-spec.ts
- infra/sql/postgresql-document-authority-policies.sql
- scripts/platform-v7-forward-only-migration-check.mjs
- scripts/platform-v7-one-deal-e2e.sh
- .github/workflows/ci.yml

CURRENT CRITERIA:
- production bootstrap fails before traffic when the Documents repository mode is missing, memory or unknown;
- production DocumentsModule contains no RuntimeCore provider, optional Prisma dependency or silent fallback;
- reads and writes run with a trusted server-derived RLS context;
- cross-tenant read/write and client-authored tenant, actor, role, deal status or evidence state are denied;
- upload metadata, sign-state transition and package generation survive restart and instance change;
- confirmed evidence is immutable; corrections create linked versions;
- document mutation, audit and outbox commit or roll back as one transaction;
- no synthetic file body, mock signature success or fake EDO success exists in the authoritative path;
- empty/baseline migrations, drift, RLS, restart, concurrency, idempotency and exact-head CI gates pass.

LOCKED:
- IR-10.2 Logistics PostgreSQL Authority;
- IR-10.3 Labs PostgreSQL Authority;
- IR-10.4 Settlement PostgreSQL Authority;
- IR-10.5 Disputes PostgreSQL Authority;
- IR-20 Canonical Durable Outbox;
- IR-21 Durable Integration Inbox;
- IR-22 Persistent Partner API and Outbound Webhooks;
- IR-30 Canonical Deal and Payment Basis;
- IR-31 Normalized Logistics and Acceptance;
- IR-32 Lab, Documents and Disputes State Machines;
- IR-40 Evidence Object Storage;
- IR-41 Signature Verification;
- IR-50 Adapter Conformance;
- IR-51 ESIA/SMEV;
- IR-52 FGIS Grain;
- IR-53 EDO and signature provider mapping;
- IR-54 Bank adapter;
- IR-55 GPS/telematics;
- IR-60 Role cabinets on authoritative data;
- IR-61 Offline, RU/EN/ZH and accessibility;
- IR-70 Production configuration and infrastructure profile;
- IR-71 Observability, SLO and operations;
- IR-72 Production-scale load, HA and DR;
- IR-80 Security and compliance evidence;
- IR-90 end-to-end acceptance and evidence pack.

NEXT:
- Layer: IR-10.2 Logistics PostgreSQL Authority
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/autopilot/progress.json
  - docs/platform-v7/autopilot/prompts/current-codex-task.md
  - docs/platform-v7/autopilot/prompts/current-review-task.md
  - docs/platform-v7/execution-queue.md
  - apps/api/src/common/config/industrial-mode.ts
  - apps/api/src/modules/logistics/**
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/20260713*_logistics_postgresql_authority/**
  - apps/api/test/industrial/logistics-postgresql-authority.e2e-spec.ts
  - apps/api/test/one-deal/logistics-postgresql-authority.e2e-spec.ts
  - infra/sql/postgresql-logistics-authority-policies.sql
  - scripts/platform-v7-forward-only-migration-check.mjs
  - scripts/platform-v7-one-deal-e2e.sh
  - .github/workflows/ci.yml
- Success criteria:
  - production LogisticsModule binds a complete Prisma repository with no RuntimeCore or optional-Prisma path;
  - tenant, actor, role, Deal, carrier, driver, vehicle, route and admission authority are server-derived under trusted RLS;
  - shipment commands, audit and outbox commit or roll back atomically;
  - restart, multi-instance, idempotency, optimistic-concurrency and cross-tenant tests pass;
  - empty/baseline migrations, drift, RLS and exact-head CI are green.
- Readiness remains NO-GO.

TRANSITION RULE:
- one narrow PR at a time in dependency order;
- no auto-merge;
- advance only after exact-head checks and diff review;
- update state, queue, progress and prompts after merge before opening the next work package;
- mock, simulator and CI-scale evidence must remain explicitly labelled and cannot be used as live or production acceptance.

READINESS:
Industrial Integration-Ready remains NO-GO until every mandatory gate in IR-90 has commit- and deployment-linked evidence.
