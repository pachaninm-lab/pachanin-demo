# P0 First Customer Access — gap audit

Issue #3563 · PR #3564 · branch `p0/first-customer-access-foundation-3563`
Audited head: `bdfd8fd8b` · base: `bea9a2e71` · behind_by 0

## How to read this

Each requirement is traced to code, a PostgreSQL object, an API route, a UI
surface, and a test. The last two columns are deliberately separate:

- **Test** is what a suite asserts on this branch.
- **Production evidence** is what has been observed on the deployed REG.RU
  instance at a known revision.

**Production evidence is empty for every row in this document.** Nothing here
has been deployed or exercised against production. The environment running this
audit holds no REG.RU or SSH credentials (`env` matches none; `~/.ssh` is
empty) and `workflow_dispatch` returns `403 Resource not accessible by
integration`. Deployment, live E2E and the clean-room test therefore remain
open and are not claimed. A `PASS` below means "implemented and proved by an
automated test", never "verified in production".

Verdicts: **PASS** implemented and covered · **PARTIAL** implemented, coverage
or enforcement incomplete · **FAIL** requirement not met · **N/A** not
applicable to this slice.

## 1. Registration, verification, admission, activation

| # | Requirement | Code | DB object | API | UI | Test | Prod evidence | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1.1 | Public registration creates an organization atomically | `registration-application.service.ts` | `auth.registration_applications` | `POST /auth/register` | `/platform-v7/register` | `registration-decision.service.spec.ts`, `platformV7FirstCustomerRegistrationBoundary.test.ts` | none | PASS |
| 1.2 | Existing INN becomes a controlled join request, not a second org | `registration-application.service.ts` | `auth.registration_applications`, `public.organizations.inn` unique | `POST /auth/register` | `/platform-v7/register` | `registration-decision.service.spec.ts` | none | PASS |
| 1.3 | Email verification is required and single-use | `registration-token.ts` | `auth.registration_email_challenges` | `POST /auth/registration/email/verify` | `/platform-v7/register` | `registration-token.spec.ts` | none | PASS |
| 1.4 | Registration is enumeration-safe | migration `20260731201200_p0_registration_enumeration_guard` | `auth.registration_public_attempts` | `POST /auth/register` | — | `platformV7FirstCustomerRegistrationBoundary.test.ts` | none | PASS |
| 1.5 | Idempotent registration replay cannot fork state | migration `20260731201100_p0_registration_idempotency_payload` | `auth.registration_applications` | `POST /auth/register` | — | `registration-decision.service.spec.ts` | none | PASS |
| 1.6 | Reviewer admission with reasons, no self-approval | `registration-decision.service.ts` | `auth.registration_application_events` | `POST /auth/organization-join-requests/:id/decision` | `RegistrationReviewQueue.tsx` | `registration-decision.service.spec.ts` | none | PASS |
| 1.7 | Activation makes the membership usable | `auth.service.ts` `identityUsable` | `public.user_orgs.status`, `.activatedAt` | `POST /auth/login` | — | `persistent-auth.e2e-spec.ts` | none | PASS |
| 1.8 | Consent is recorded with a source hash | `consent-policy.ts` | migration `20260801134000_p0_consent_authority` | `POST /auth/register` | `/platform-v7/register` | `consent-policy.spec.ts` | none | PASS |
| 1.9 | Real outbound mail delivery | — | — | — | — | — | none | **FAIL — not verifiable here.** No mail transport is exercised; verification and invitation tokens are only asserted in-process. Requires production evidence. |

## 2. Role mapping

| # | Requirement | Code | DB object | API | UI | Test | Prod evidence | Verdict |
|---|---|---|---|---|---|---|---|---|
| 2.1 | seller→FARMER, buyer→BUYER, logistics→LOGISTICIAN, driver→DRIVER, elevator→ELEVATOR, lab→LAB, surveyor→SURVEYOR, bank→ACCOUNTING | `normalizeSurfaceRole`, `API_ROLE_TO_CABINET` | `public.user_orgs.role` | `POST /auth/login` | 12 cabinets | `surfaceRoleMappingParity.test.ts` (18 assertions) | none | PASS |
| 2.2 | The two mappings cannot drift apart | both tables above | — | — | — | `surfaceRoleMappingParity.test.ts` | none | PASS — added by this work after ADMIN drift made the operator cabinet unreachable |
| 2.3 | Unknown role never becomes a privileged cabinet | `normalizeSurfaceRole` returns `null` | — | — | — | `p0AuthFailClosed.test.ts` (rewritten to assert the property, negative-tested) | none | PASS |
| 2.4 | BANK_CALLBACK is never assigned to a human | `identityInvalidReason` rejects `Role.BANK_CALLBACK` | `public.user_orgs.role` | `POST /auth/login` | — | `surfaceRoleMappingParity.test.ts`, `auth.service.spec.ts` | none | PASS |
| 2.5 | Staff/privileged roles are not publicly registerable | `registration-application.service.ts` | — | `POST /auth/register` | — | `platformV7FirstCustomerRegistrationBoundary.test.ts` | none | PASS |

## 3. Login, session, MFA

| # | Requirement | Code | DB object | API | UI | Test | Prod evidence | Verdict |
|---|---|---|---|---|---|---|---|---|
| 3.1 | Password verified in PostgreSQL under row lock | `auth.service.ts login()` | `public.users.passwordHash` | `POST /auth/login` | `/platform-v7/login` | `persistent-auth.e2e-spec.ts` | none | PASS |
| 3.2 | Lockout and throttling | `ensureLoginThrottle` | `auth.login_throttles` | `POST /auth/login` | — | `persistent-auth.e2e-spec.ts` | none | PASS |
| 3.3 | Server-minted session + cabinet cookie carrying user/membership/org/tenant | `applyAuthenticatedSession` | `auth.sessions`, `auth.refresh_tokens` | `POST /api/auth/login` | — | `platformV7VerifiedSession.test.ts`; **live E2E** in `platform-v7-design-system-v8-acceptance.spec.ts` | none | PASS |
| 3.4 | No demo/passwordless fallback in production | `demo-login-policy.ts` | — | `/api/auth/demo*` (3 routes, all gated) | — | `demoLoginPolicy.test.ts` | none | PASS — flag cannot enable it under `NODE_ENV=production` |
| 3.5 | MFA required for privileged roles, TOTP + backup codes | `auth-crypto.ts`, `auth.service.ts` | `auth.credential_states`, `auth.mfa_challenges` | `POST /auth/mfa/verify` | `/platform-v7/login` | `auth.step-up.spec.ts`; **live E2E** performs real TOTP login | none | PASS |
| 3.6 | Step-up MFA for sensitive actions | `auth.step-up.spec.ts` subject | `auth.mfa_challenges` | `POST /auth/mfa/step-up/*` | — | `auth.step-up.spec.ts` | none | PASS |
| 3.7 | MFA login ticket is canonical AES-GCM, rejects alternate encodings | `mfa-login-ticket.ts` | — | `POST /api/auth/mfa-login` | — | `mfaPendingLoginTicket.test.ts` | none | PASS |
| 3.8 | CSRF enforced on unsafe methods | `server-request-security.ts` | — | all mutating routes | — | `platformV7LoginSecurityBoundary.test.ts` | none | PASS |
| 3.9 | Multi-membership selection is safe | `auth.membership-selection.spec.ts` subject | `auth.membership_selection_challenges` | `POST /auth/membership/select` | `/platform-v7/login` | `auth.membership-selection.spec.ts` | none | PASS |
| 3.10 | Session is never minted locally when the API is unreachable | `refresh/route.ts` | — | `POST /api/auth/refresh` | — | `p0AuthFailClosed.test.ts` | none | PASS |

## 4. Cabinets and server authority

| # | Requirement | Code | DB object | API | UI | Test | Prod evidence | Verdict |
|---|---|---|---|---|---|---|---|---|
| 4.1 | Without a session `/platform-v7/operator` redirects to login | `middleware.ts`, `layout.tsx` | — | — | `/platform-v7/operator` | **live E2E**, both Chromium projects | none | PASS |
| 4.2 | A valid operator gets 200 | `normalizeSurfaceRole` (ADMIN mapping restored) | `public.user_orgs.role` | `POST /api/auth/login` | `/platform-v7/operator` | **live E2E** | none | PASS — was unreachable before this work |
| 4.3 | FARMER is denied the operator cabinet | `server-cabinet-access.ts`, `cabinet-access-policy.ts` | — | — | — | **live E2E** | none | PASS |
| 4.4 | A forged cabinet cookie is rejected | `verifyHs256Jwt` | — | — | — | **live E2E** | none | PASS |
| 4.5 | Cabinet role is never taken from URL, query, localStorage or client state | `middleware.ts` (cabinet session is the only authority) | — | — | — | `platformV7ServerCabinetAccess.test.ts`, `platformV7ServerVerifiedShell.test.ts` | none | PASS |
| 4.6 | Session is revalidated against `/auth/me` for user/org/tenant/membership | `layout.tsx` `verifiedCabinetRole()` | `public.users`, `public.user_orgs`, `public.organizations` | `GET /auth/me` | — | `p0AuthFailClosed.test.ts` | none | PASS |
| 4.7 | 12 role shells across Chromium, Firefox, WebKit, Android Chromium, iPhone WebKit | shells under `apps/web/app/platform-v7/*` | — | — | 12 cabinets | **live E2E** — 9/9 on desktop-chromium and android-chromium locally | none | PARTIAL — Firefox and WebKit are not installable in this environment; they run in CI and are unproven until that job is green |
| 4.8 | Static CSS/JS/fonts/images/icons/manifest/service-worker/Next assets need no cabinet session | `middleware.ts` `isStaticFileRequest`, segment-boundary match | — | — | — | **live E2E** | none | PASS — fixed here; the public landing page's hero artwork previously redirected anonymous visitors to login |

## 5. Organization team

| # | Requirement | Code | DB object | API | UI | Test | Prod evidence | Verdict |
|---|---|---|---|---|---|---|---|---|
| 5.1 | Org-admin invitations, single-use hashed tokens, bounded TTL | `organization-invitation.service.ts` | `auth.organization_invitations` | `POST /auth/organization-invitations` | `/platform-v7/profile/team` | `organization-invitation.service.spec.ts` | none | PASS |
| 5.2 | Role ceilings on invitation and role change | `organization-role-policy.ts` | `public.user_orgs.role` | `POST /auth/organization-memberships/:id/role` | `/platform-v7/profile/team` | `organization-team.service.spec.ts`, `platformV7OrganizationTeamAuthority.test.ts` | none | PASS |
| 5.3 | Revoke ends access | `organization-team.service.ts` | `public.user_orgs.revokedAt` | `POST /auth/organization-memberships/:id/revoke` | `/platform-v7/profile/team` | `organization-team.service.spec.ts` | none | PASS |
| 5.4 | Membership commands are append-only audited | migration `20260801130000_p0_auth_state_integrity` | `auth.organization_membership_command_events` | — | — | `organization-team.service.spec.ts` | none | PASS |

## 6. Recovery

| # | Requirement | Code | DB object | API | UI | Test | Prod evidence | Verdict |
|---|---|---|---|---|---|---|---|---|
| 6.1 | Password reset, single-use hashed token, bounded TTL | `password-reset-token.ts` | `auth.password_reset_challenges` | `POST /auth/password-reset/*` | `/platform-v7/reset-password` | `password-reset-token.spec.ts`, `password-reset.service.spec.ts` | none | PASS |
| 6.2 | Reset revokes sessions and cannot be raced by an old password | `auth.service.ts` (user row locked through session creation) | `auth.sessions` | — | — | `persistent-auth.e2e-spec.ts` | none | PASS |
| 6.3 | Controlled MFA recovery with admin approval | `mfa-recovery` slice | `auth.mfa_recovery_challenges`, `auth.mfa_recovery_events` | `POST /auth/mfa-recovery/confirm` | `/platform-v7/mfa-recovery` | `mfa-recovery.e2e-spec.ts` | none | PASS |
| 6.4 | Backup codes are one-time | `generateBackupCodes`, `auth-crypto.ts` | `auth.credential_states.mfa_backup_hashes` | `POST /auth/mfa/verify` | — | `mfa-backup-code-one-time.e2e-spec.ts` | none | PASS |

## 7. Tenant isolation A vs B — the material gap

Verified by inspecting a PostgreSQL 16 database built from the complete
forward-only migration chain (the same chain production applies).

| # | Requirement | Observed | Verdict |
|---|---|---|---|
| 7.1 | Tenant-scoped business tables enforce RLS | 21 tables in `public` have RLS enabled; 18 of those are `FORCE`d | PASS |
| 7.2 | Identity tables enforce tenant isolation in PostgreSQL | `public.users` — no RLS, no policies. `public.user_orgs` — no RLS, no policies. `public.organizations` — **RLS not enabled**, yet one policy (`organizations_select`) is defined and therefore inert | **FAIL** |
| 7.3 | No policy is defined on a table without RLS | 7 inert policies found: `organizations_select`; `deal_participants_insert`; `outbox_entries` ×4; `integration_events_select`. Each reads as protection that is not in force | **FAIL** |
| 7.4 | RLS verified with a restricted runtime role, not a superuser | 3 `public` tables have RLS without `FORCE`, so the table owner bypasses them | PARTIAL |
| 7.5 | Cross-tenant read of A by B is denied | Not proved for identity data. Isolation of `users`/`user_orgs`/`organizations` currently rests on application query scoping alone, which the P0 specification does not accept as PostgreSQL tenant isolation | **FAIL — release blocker** |

### 7.2–7.5 are a release blocker, not an accepted gap

The P0 specification requires tenant isolation **in PostgreSQL**, with
cross-tenant negative tests and no access to another organization. Application
query scoping is not equivalent to that and does not satisfy it. These rows
therefore block the P0 security PASS: they are not deferred risk and must not
be described as merely audited.

The honest statement of today's posture: **tenant isolation for identity data
is enforced in application code, not in PostgreSQL.** Row 7.3 is the sharper
finding — seven policies exist that never execute, which is worse than no
policy, because reading the schema suggests a boundary that is not in force.

**Blocking condition.** Identity RLS must land before this PR is merged and
before any REG.RU deployment. Enabling it is a schema-authority change: the
login transaction has to read an identity *before* any tenant context exists,
so it needs a dedicated runtime identity role without BYPASSRLS, a separate
bootstrap/login authority path, a transaction-scoped tenant and user context,
FORCE RLS wherever the owner is not the runtime principal, policies on
`users`, `user_orgs` and `organizations`, removal of the seven inert policies,
and negative direct-SQL tests proving that tenant B cannot read tenant A —
before login, after login, with multi-membership, for admin/reviewer, and for
background and service principals.

That work is tracked as #3670. (#3618 is a different task — append-only hardening
of `public.audit_events` — and is not the identity-RLS blocker.)
Whether it lands inside this PR or as its own,
it is a hard prerequisite: **PR #3564 stays in draft, is not merged and is not
deployed until identity RLS is in force and this section reads PASS.** No
PRODUCTION_PASS may be claimed before then.

## 8. Prohibitions

| Prohibition | Status | Evidence |
|---|---|---|
| Demo registration/login fallback | Held | `demo-login-policy.ts`, all 3 demo routes gated, `demoLoginPolicy.test.ts` |
| Local session when the API is unavailable | Held | `p0AuthFailClosed.test.ts` |
| Role from email, URL, query, localStorage or client state | Held | `middleware.ts`; `platformV7ServerCabinetAccess.test.ts` |
| Client-selected tenant or effective role | Held | DTOs reject `tenantId`/`role`/`orgId`; layout revalidates against `/auth/me` |
| Public registration of staff/privileged roles | Held | `platformV7FirstCustomerRegistrationBoundary.test.ts` |
| Mock PostgreSQL | Held | acceptance job runs real PostgreSQL 16 and the real migration chain |
| Test cookies/JWT instead of real login | **Now held** | the acceptance matrix previously hand-minted `pc_v7_cabinet`; it now performs a real login incl. second factor |
| Bypassing email verification | Held | `registration-token.spec.ts` |
| Disabling RLS or required checks | Held | no migration disables RLS; forward-only gate blocks it |
| `continue-on-error` on critical gates | Held | asserted by `pcCrop10cApplicability.test.ts` |
| Extending a foreign PC-CROP scope with P0 files | Held | PC-CROP-10C manifest unchanged; applicability resolved instead |
| Fictitious legal organization | Held in production paths | acceptance fixtures use `@acceptance.invalid` addresses and checksum-valid but non-registered INNs, seeded only into an ephemeral CI database that the seeder refuses to run against a non-local host |
| Fictitious SMS | Held | no SMS transport in this slice |
| New paid service | Held | no new dependency or hosted service |
| Production PASS without exact SHA and live evidence | Held | this document claims none |

## 8.1 CodeQL: one high-severity alert, one real defect inside it

CodeQL raised one alert against this PR — *use of password hash with
insufficient computational effort*, one sink, the `createHmac` inside
`hashAuthMaterial` (`auth-crypto.ts`). On `main` no caller of that function has
a password-named source, so the alert does arrive with this branch. It carries
nine contributing flow paths, and they are not all the same thing.

| Flow source | Paths | What the value actually is | Verdict |
|---|---|---|---|
| `dto.password` → `passwordFingerprint` | 3 | a user-chosen password | **real defect, fixed** |
| `issuePasswordResetToken` | 5 | `randomBytes(18)` id + `randomBytes(32)` secret | false positive on the identifier name |
| `resetMembershipMfa` | 1 | `stableJson({membershipId, command, version, reason})`; the token beside it is `randomBytes(32)` | false positive on the identifier name |

The real one: `registration-application.service.ts` fed a user-chosen password
to the keyed hash written for high-entropy material. The plaintext never
reached the database and the stored credential was always `bcrypt(12)`, so it
was never a stored password hash — but the fingerprint is folded into
`request_hash`, which *is* stored, so the database plus `AUTH_TOKEN_PEPPER`
recovered the password at HMAC-SHA256 speed without paying the bcrypt cost.
The weakest link sets the cost. `hashPasswordFingerprint` now derives it with
scrypt at the RFC 7914 interactive parameters (N=2¹⁴, r=8, p=1, ~41 ms
measured), staying deterministic so an idempotent retry that swaps the
credential is still rejected. `auth-crypto.spec.ts` pins determinism,
separation, the cost floor and non-equality with the old keyed hash; restoring
the previous implementation fails two of its five tests.

The residue is the query's name-based source heuristic firing on 256-bit
random tokens. It is recorded here rather than closed: no exception was filed,
no severity downgraded, no suppression added, and the identifiers were **not**
renamed to stop the heuristic matching — renaming code to dodge a scanner is
suppression wearing a different hat. Closing the check therefore remains an
owner decision, and this row stays open until it is taken.

## 9. Environment concessions in the acceptance job

Disclosed rather than buried:

1. The API runs with `NODE_ENV=test`, matching the existing `ci.yml` auth job.
   Production startup requires separately provisioned PostgreSQL principals
   (`STORAGE_DATABASE_URL` and others). Real PostgreSQL, real migrations, real
   bcrypt, real TOTP and real RLS are all in force; the relaxed part is a
   startup assertion about infrastructure topology, not auth correctness.
2. `RATE_LIMIT_AUTH_LOGIN`, `RATE_LIMIT_AUTH_MFA_VERIFY` and
   `RATE_LIMIT_GENERAL` are raised for this ephemeral environment, because five
   browser projects legitimately sign in as twelve accounts from one runner
   address. The limiter stays enabled and its code path is unchanged.
3. MFA enrolment is pre-completed in the seed with a known TOTP secret, because
   the API discloses a generated secret only during enrolment. Each project's
   login is therefore an ordinary returning-user login with a real TOTP code.

## 10. Open items

| Item | Owner | Blocking |
|---|---|---|
| **Identity RLS on `users`, `user_orgs`, `organizations`; remove the 7 inert policies** | **#3670 — hard prerequisite for merge and deploy** | **7.2–7.5, and the P0 security PASS** |
| CodeQL alert: 6 remaining flow paths are the query's name heuristic on 256-bit random tokens, not passwords | owner — closing it must not be a rename, exception or suppression | 8.1 |
| Firefox and WebKit projects of the acceptance matrix | CI | 4.7 |
| Real mail delivery | production | 1.9 |
| REG.RU deployment of the merge SHA | owner — no credentials in this environment | 8–11 of the acceptance sequence |
| Live production E2E with a new user | owner | 9 |
| Second independent clean-room test | owner | 10 |
