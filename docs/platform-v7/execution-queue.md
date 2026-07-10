# platform-v7 execution queue

CURRENT: VP-3.43 Transaction-Local Trusted RLS Context.

GOAL: Удалить небезопасную pre-auth/session-level установку PostgreSQL RLS context и ввести одну fail-closed transaction boundary, которая принимает только trusted `RequestUser` после аутентификации.

CURRENT STATUS:
- VP-3.33 additive Prisma schema/migration merged in #2241.
- VP-3.37 API-side Postgres repository adapter merged in #2245.
- VP-3.41 internal runtime persistence service/module wiring merged in #2250.
- VP-3.42 authenticated internal command boundary merged in #2252.
- Draft #2251 remains merge-blocked by user-driven bank confirmations, synthetic bank references, cross-tenant visibility and unresolved conflicts.
- PR #2254 implements the transaction-local RLS primitive and removes the unsafe middleware.

IMPLEMENTED IN #2254:
- `RlsTransactionService` derives userId, orgId, tenantId, role and sessionId only from trusted `RequestUser`.
- Missing user/session/org/tenant and `GUEST` fail before a database transaction is opened.
- RLS values are parameterized through `Prisma.sql`; `$executeRawUnsafe` is not used.
- `set_config(..., true)` scopes all values to the current transaction and prevents pooled-connection context leakage.
- RLS initialization failure propagates and prevents business work.
- Transaction max-wait, timeout and isolation level are explicit and bounded.
- `RlsTransactionService` is registered and exported by the global `PrismaModule`.
- The old Nest middleware is deleted because it ran before `AppAuthGuard`, read `organizationId` instead of `orgId`, used session-level context and swallowed all database errors.
- Unit tests cover trusted derivation, fail-closed validation, parameterization, transaction-local flags, callback binding, transaction options and error propagation.

STILL LOCKED:
- controller or external API endpoint;
- web/server-action bridge;
- bank reserve/release confirmation from user commands;
- production migration execution or RLS policy application;
- persistent identity/session/revocation/MFA implementation;
- UI/components;
- live bank/FGIS/EDO integrations.

GUARDRAILS:
- No HTTP request object enters the repository layer.
- No caller-supplied actor, role, tenant, organization or session identity.
- No context fallback when trusted identity is incomplete.
- No session-level PostgreSQL context outside the transaction callback.
- No unsafe interpolated SQL.
- No swallowed RLS initialization error.
- No synthetic bank confirmation or bank reference.

NEXT:
- Layer: VP-3.44 Runtime Persistence Trusted Transaction Binding.
- Goal: execute runtime snapshot, outbox, audit and transaction-attempt persistence inside the same `RlsTransactionService` callback.
- Required changes:
  - eliminate repository pre-read outside the trusted transaction;
  - add a transaction-client repository entry point without nested Prisma transactions;
  - preserve duplicate/conflict classification under concurrency;
  - prove that RLS setup failure leaves snapshot, outbox, audit and attempt unchanged;
  - preserve failed receipts as failed;
  - keep controller/web/money confirmation routes locked.

AFTER NEXT:
- Canonical physical-table RLS policy audit and controlled non-production application rehearsal.
- Persistent identity/session/revocation/MFA source of truth.
- Authenticated DB-backed runtime action bridge without direct bank confirmation.
- Concurrency, retry, recovery, load, restore and security acceptance gates.
