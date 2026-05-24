# Review current task — PR 5.5 Mock Persistence Adapter

Maturity: controlled-pilot / pre-integration.
Review the diff, not the agent report.
Human review and green checks are required before merge.

## Required scope checks

Allowed files only:

- apps/web/lib/platform-v7/runtime/mock-persistence-adapter.ts
- apps/web/tests/unit/platformV7RuntimeMockPersistenceAdapter.test.ts

Reject if the PR changes:

- apps/landing
- apps/web/app/platform-v7
- apps/web/components/platform-v7
- apps/web/components/v7r
- apps/web/lib/platform-v7/adapters
- apps/web/lib/platform-v7/ai
- apps/web/app/api
- package-lock.json

## Architecture checks

Confirm:

- adapter state lives only inside explicit store instance
- no module-level Map or Set
- no global arrays
- no hidden singleton store
- repositories implement persistence ports
- unitOfWork exposes transactional ports
- expectedVersion conflict is enforced
- idempotency reserve works
- duplicate result replay works
- duplicate bank event protection works
- audit append and appendMany work
- separate store instances do not share state

## Tests required

- isolated stores from separate seeds
- load/save MoneyTree
- expectedVersion conflict
- Document Matrix load/save
- Bank Basis load/save
- idempotency result replay
- duplicate bank event
- audit append/appendMany
- unitOfWork transaction
- no shared state between instances
- source scan for hidden global persistence

## Required output

Return:

BLOCKERS
- ...

REQUIRED FIXES
- ...

OPTIONAL IMPROVEMENTS
- ...

MERGEABLE: yes/no
