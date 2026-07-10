# One Deal Foundation — acceptance boundaries

This branch introduces one canonical test deal execution path. It does not claim full production readiness.

## Enforced invariants

- One canonical deal ID for every role: `DEAL-INDUSTRIAL-001`.
- User actions are commands, never client-supplied target states.
- The canonical command service requires a trusted user, session, organization and tenant context.
- Deal reads and command writes run inside transaction-local PostgreSQL RLS context.
- Command writes use Serializable isolation, optimistic version checks and deterministic idempotency fingerprints.
- Bank reserve/release confirmations are accepted only from the verified `BANK_CALLBACK` system actor.
- Human users cannot confirm bank money movement.
- The UI never fabricates bank references or successful canonical backend responses.
- SURVEYOR is a first-class backend role and owns the independent inspection step.
- The legacy deal controller retains its existing allowlist.
- The test seed is explicit, idempotent and forbidden in production without a second explicit allow flag.

## Still blocking production exploitation

- Persistent identity, refresh-token families, distributed revocation and production MFA.
- Applied and verified production database migrations and RLS policies.
- Real bank, FGIS, EDO and signature-provider contracts.
- Replay-safe partner key rotation and raw-body callback verification.
- Durable outbox workers and reconciliation acceptance.
- Load, disaster recovery, restore, accessibility and operational acceptance.
