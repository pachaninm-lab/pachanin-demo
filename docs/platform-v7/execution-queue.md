# platform-v7 execution queue

CURRENT: VP-3.44 Runtime Persistence Trusted Transaction Binding.

GOAL: Выполнить authenticated runtime persistence полностью внутри transaction-local RLS boundary, чтобы pre-read, outbox, audit, snapshot и transaction-attempt использовали один trusted Prisma transaction client.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/execution-queue.md
- apps/api/src/common/prisma/rls-transaction.service.ts
- apps/api/src/common/prisma/rls-transaction.service.spec.ts
- apps/api/src/modules/runtime-persistence/runtime-persistence-command.service.ts
- apps/api/src/modules/runtime-persistence/runtime-persistence-command.service.spec.ts
- apps/api/src/modules/runtime-persistence/runtime-persistence.service.ts
- apps/api/src/modules/runtime-persistence/runtime-persistence.service.spec.ts
- apps/api/src/modules/runtime-persistence/runtime-persistence.repository.ts
- apps/api/src/modules/runtime-persistence/prisma-runtime-persistence.repository.ts
- apps/api/src/modules/runtime-persistence/prisma-runtime-persistence.repository.spec.ts
- apps/api/src/modules/runtime-persistence/runtime-persistence.module.ts

CURRENT CRITERIA:
- authenticated command enters through `RlsTransactionService`;
- existing-record lookup occurs on the trusted transaction client;
- outbox, audit, snapshot and attempt writes share that exact client;
- repository opens no nested transaction inside the trusted callback;
- concurrent P2002 recovery re-enters a new trusted transaction before classification;
- RLS initialization failure executes no persistence read or write;
- errors do not leak sensitive database details;
- failed receipts remain failed;
- no controller, web bridge or user-driven bank confirmation is introduced.

DONE:
- #2241 VP-3.33 Runtime Persistence Prisma Schema and Migration Implementation
- #2245 VP-3.37 Runtime Persistence Postgres Repository Adapter Implementation
- #2250 VP-3.41 Runtime Persistence Internal Service Wiring Implementation
- #2252 VP-3.42 Runtime Persistence Authenticated Internal Command Boundary
- #2254 VP-3.43 Transaction-Local Trusted RLS Context

LOCKED:
- production migration execution;
- production RLS policy application;
- persistent identity/session/revocation/MFA files;
- controller/API/web wiring;
- bank reserve/release confirmation from user commands;
- live bank/FGIS/EDO integrations.

NEXT:
- Layer: VP-3.45 Physical Table RLS Policy Alignment and Rehearsal.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/execution-queue.md
  - infra/sql/production-rls-policies.sql
  - apps/api/prisma/migrations/**
  - apps/api/src/common/prisma/rls-transaction.service.spec.ts
  - scripts/platform-v7-rls-*.mjs
  - scripts/platform-v7-rls-*.sh
- Success criteria:
  - RLS policies reference canonical physical PostgreSQL table names from Prisma mappings;
  - tenant, organization, role and user policies are explicit per protected table;
  - policy SQL is idempotent and fail-closed;
  - non-production apply and rollback rehearsal scripts exist;
  - no production database is modified by CI;
  - migration and policy drift is detected automatically;
  - production-enabled claims remain forbidden until controlled application evidence exists.
- Readiness remains 85% honest architectural readiness.

AFTER NEXT:
- Persistent identity/session/revocation/MFA source of truth after blocker #2115.
- Authenticated DB-backed runtime action bridge without direct bank confirmation.
- Concurrency, retry, recovery, load, restore and security acceptance gates.
