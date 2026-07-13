# IR-10.3 exact runtime fix

Canonical PR: #2426

Apply only to `agent/ir-10-3-labs-postgresql-authority-v2` from its current head.

1. In `apps/api/test/industrial/harness.ts`, make `createInstance()` the single canonical constructor: register the returned `ServiceInstance` in `activeInstances` before returning it. Keep `createRememberedInstance()` only as a compatibility alias that calls `createInstance()`; remove the split `originalCreateInstance`/`rememberInstance` path.
2. Instantiate `LabEvidenceUploadService` with the controlled object adapter and expose it on `ServiceInstance`.
3. Replace every post-insert `dealDocument.metadata` mutation in the harness with initial immutable purpose binding through `LabEvidenceUploadService`:
   - provisioning evidence uses `requestForProvisioning`;
   - collection/custody/test/protocol evidence uses `requestForSample`;
   - generic logistics evidence stays on `StorageService` without authority metadata because `app_logistics_evidence_valid` only requires verified immutable Deal evidence.
4. Do not weaken the document authority trigger, do not add a pending-metadata update migration, do not use `session_replication_role`, disabled triggers or direct finalized fixtures.
5. Run exact PostgreSQL industrial core, one-deal, Labs E2E, Node CI and drift checks. Fix the next deterministic runtime failure only after preserving all authority invariants.
