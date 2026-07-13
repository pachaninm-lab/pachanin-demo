# IR-10.3 next exact runtime failures

Canonical PR: #2426. Apply to the current head of `agent/ir-10-3-labs-postgresql-authority-v2` only.

## 1. PostgreSQL numeric binding

`LabAuthorityService.provision()` currently binds normalized decimal strings directly into `labs.methods.norm_min` / `norm_max`, causing PostgreSQL 42804. Keep the public decimal contract as a canonical string, but cast both bound values explicitly inside SQL (`CAST(... AS numeric)`), including null values. Do not change the columns to text and do not add an implicit/global cast.

## 2. One-deal canonical Labs lifecycle

The one-deal gate still executes legacy `DealCommandService.finalize_lab` without an active PostgreSQL sample. Update its isolated seed/runtime wiring so the same factual Deal reaches laboratory finalization through the production PostgreSQL authority path: purpose-bound immutable evidence, active laboratory/accreditation, authorized actors, sample admission, canonical sample state machine, tests, signed protocol evidence, then canonical `PostgresqlDealCommandService`/gateway finalization. Do not insert a finalized sample directly, do not bypass triggers, and do not weaken payload validation.

## 3. Verification

Run API typecheck, exact Labs PostgreSQL E2E, industrial core, load proof, one-deal exploitation, forward-only migration check and schema drift. Continue from the next deterministic failure. Remove this brief and its marker after applying it.
