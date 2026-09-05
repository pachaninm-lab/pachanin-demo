# Production P0 all-role registration matrix

This runbook closes issue #3785 only when the canonical REG.RU production system reports a real, exact-current-main result of **9/9**. A partial run, a demo identity, a client-selected role, a stale deployment, or a missing browser/relogin check is terminal failure rather than partial success.

## Command and prerequisite

Issue #3072 remains the legacy historical authority. The repository owner starts the bounded remaining matrix on successor issue #4637 with:

```text
/production p0-all-role-registration current-main
```

The workflow first resolves immutable current `main`, then downloads and validates a successful `Production P0 First-Customer Acceptance` artifact for that exact SHA. This prerequisite cannot be replaced by the matrix itself. The live API and Web OCI revisions must also equal the same SHA.

The protected `PC_PROD_HOST` must be one of the production domain's current IPv4 DNS answers, and its scanned SSH host key must match the protected pinned fingerprint. A historical hard-coded address is not accepted.

The reviewer decision rate window from the deep prerequisite is allowed to expire before new registrations begin. The runner checks that `main` has not moved throughout that wait and throughout every subsequent external action.

Registration remains fail-closed under the production IP rate limiter. Only an HTTP `429` response with the exact `RATE_LIMITED` contract and a bounded integer `retryAfterSeconds` is retried. The runner waits for that server-provided interval while continuously guarding exact `main`, keeps the same idempotency key, and permits at most four retries. Every malformed rate-limit response or any other non-`202` result is a terminal failure.

## Human reviewer ceremony

GitHub Actions receives no reviewer email, password, TOTP seed, one-time code, cookie, token or staff session. When the eight new-organization applications are ready, the workflow posts only an aggregate count and the non-personal legal-name marker to the validated triggering authority issue #4637.

The existing production PLATFORM_OWNER must use the ordinary production browser:

1. log in through the visible staff flow;
2. complete first TOTP enrollment or a fresh TOTP challenge;
3. enter the bounded `CONTROL_PLANE`;
4. open the registration queue;
5. approve the eight applications whose legal names begin with `Production P0 exact-run organization`.

For those marked applications, the deployed queue performs one deterministic idempotent replay in the same browser session. The server-side BFF marker must prove that the first notification was delivered and the replay notification was suppressed. Application IDs, applicant data and reviewer session material are never published.

## Why employee is approved by the seller administrator

The first eight workspaces create independent organizations. `employee` is deliberately registered with the verified seller INN and legal name, so the server classifies it as `JOIN_EXISTING_ORGANIZATION`.

Production tenant policy rejects a platform reviewer attempting to approve such a join with `ORGANIZATION_ADMIN_DECISION_REQUIRED`. The matrix therefore uses the run-scoped seller identity, after fresh MFA, to approve the employee through the ordinary organization-join Web BFF. This is the security-authoritative path; overriding it would weaken tenant isolation and is forbidden.

## Required role and cabinet matrix

| Registration workspace | Server role | Canonical cabinet |
|---|---|---|
| seller | FARMER | `/platform-v7/seller` |
| buyer | BUYER | `/platform-v7/buyer` |
| logistics | LOGISTICIAN | `/platform-v7/logistics` |
| driver | DRIVER | `/platform-v7/driver/field` |
| elevator | ELEVATOR | `/platform-v7/elevator` |
| lab | LAB | `/platform-v7/lab` |
| surveyor | SURVEYOR | `/platform-v7/surveyor` |
| bank | ACCOUNTING | `/platform-v7/bank` |
| employee | GUEST | `/platform-v7/profile` |

Every identity must:

1. register through the public production Web BFF;
2. receive and consume a real transactional verification email;
3. be activated by the correct server authority;
4. complete first TOTP enrollment;
5. open its canonical cabinet in live desktop Chromium;
6. read its protected `organization-team` resource in the same browser context;
7. log out and prove the old session is unauthenticated;
8. log in again with a visible TOTP challenge;
9. reopen the same canonical cabinet and protected read in live mobile Chromium.

The final topology must be exactly eight distinct organizations and tenants, nine distinct users and memberships, with employee sharing only the seller organization and tenant.

## Evidence and failure policy

The artifact contains hashes and aggregate assertions only. It must not contain raw email addresses, passwords, verification URLs or tokens, TOTP seeds or codes, backup codes, cookies, bearer tokens, reviewer material, SSH keys, or database URLs.

The terminal success markers are:

```text
P0_ALL_ROLE_REGISTRATION_COUNT=9/9
P0_ALL_ROLE_TOPOLOGY=8_ORGS_8_TENANTS_9_MEMBERSHIPS
P0_ALL_ROLE_DESKTOP_CHROMIUM=PASS
P0_ALL_ROLE_MOBILE_CHROMIUM=PASS
P0_ALL_ROLE_LOGOUT_RELOGIN=PASS
P0_ALL_ROLE_REGISTRATION=PASS
```

Any missing role, wrong cabinet, wrong tenant relation, failed mail delivery, reviewer timeout, organization-admin boundary violation, browser redirect, protected-read failure, logout survival, stale revision, rate-limit failure, or evidence leak fails the run. Production state is not rolled back merely to make the acceptance pass; failures are diagnosed and corrected through a new governed change.
