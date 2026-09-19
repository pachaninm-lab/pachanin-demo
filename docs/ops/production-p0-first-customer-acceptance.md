# Production P0 first-customer acceptance

## Authority and result

This runbook proves the public P0 customer-registration path on the canonical REG.RU Docker Compose production contour. It does not deploy code and it never treats organization intake, a preview, a registry image, or a merged pull request as production proof.

Issue `#3072` remains the legacy historical authority. The active trigger for the bounded remaining registration continuation is this exact repository-owner comment on successor issue `#4637`:

```text
/production p0-first-customer current-main
```

The workflow requires the issue-comment author, Actions actor, and rerun triggering actor all to equal the repository owner. Evidence is written back to the validated triggering issue, #4637. The historical reviewer-membership repair command remains bound only to #3072 and is not part of the continuation authority. The pull-request contract has read-only repository permissions; only the owner-command production job receives `issues: write`, and neither checkout persists credentials. The workflow resolves GitHub `main` at the start and rechecks it before every public HTTP group, mailbox read, SSH read, issue comment, artifact publication, and terminal PASS. If `main` advances, the run fails. Before this command is used, `/production release current-main` must have completed successfully for the same exact SHA.

## Protected prerequisites

Mailbox and pinned SSH prerequisites are existing protected GitHub Actions secrets. Missing values fail closed before a customer is created. The reviewer password and TOTP never enter GitHub Actions.

Mailbox delivery and single-use verification:

- `PC_PROD_P0_MAILBOX_EMAIL_TEMPLATE` (or `PC_PROD_P0_EMAIL_TEMPLATE`): a deliverable controlled address containing either exactly one `{identity}` placeholder or exactly one `{run}` and one `{slot}` placeholder;
- `PC_PROD_P0_MAILBOX_IMAP_HOST`, `PC_PROD_P0_MAILBOX_IMAP_USER`, `PC_PROD_P0_MAILBOX_IMAP_PASSWORD` (the shorter `PC_PROD_P0_IMAP_*` aliases are also accepted);
- optional `PC_PROD_P0_MAILBOX_IMAP_PORT` or `PC_PROD_P0_IMAP_PORT` (default `993`), and `PC_PROD_P0_IMAP_FOLDER` (default `INBOX`).

The mailbox must preserve the generated alias in a recipient header. The workflow reads with IMAPS and `BODY.PEEK[]`; it neither deletes nor publishes the message.

The existing server-authoritative reviewer completes a human reviewer ceremony in the visible production browser. That reviewer must have a normal password, enrolled TOTP, an active `PLATFORM_OWNER` assignment and a fresh-MFA `CONTROL_PLANE` session whose permission ceiling includes `staff-request:approve`. The workflow never receives the reviewer email, password, TOTP secret, cookie, bearer token or staff-session capability. If any reviewer credential variable is supplied to the runner, it fails with `P0_REVIEWER_CREDENTIAL_INPUT_FORBIDDEN`.

The pinned REG.RU SSH prerequisites are the same protected values used by the exact-SHA release workflow: `PC_PROD_HOST`, `PC_PROD_SSH_USER`, `PC_PROD_SSH_PORT`, an accepted private-key slot, and `PC_PROD_SSH_HOST_FINGERPRINT`.

## Acceptance sequence

1. Confirm the running API and Web OCI revision labels and the configured migration image revision all equal exact current `main`, Web is healthy, public `/ready` reports the same revision, and PostgreSQL contains the bounded causal producer `auth.emit_registration_lifecycle_receipt(text,text)`.
2. Generate two unique run-scoped deliverable identities and distinct organization identifiers.
3. Submit both through `/api/auth/register` with CSRF and idempotency. HTTP `202` is accepted only because the Web BFF has received configured transactional-mail delivery acknowledgement; the response must not contain a verification token or status token.
4. Read each single-use link from the controlled mailbox and verify through `/api/auth/registration/verify`. Raw verification tokens remain only in a rootless runner temporary directory and are never placed in an issue comment or artifact.
5. The runner publishes only that two verified applications are waiting, with no application identifier or applicant data. In the production browser, the existing `PLATFORM_OWNER` performs the normal password + fresh-TOTP login, activates bounded `CONTROL_PLANE`, opens the registration queue and approves the two marked P0 applications. For a marked acceptance application, that same browser repeats the decision once with the same idempotency key. The API atomically records the decision and its encrypted `REGISTRATION_DECISION` mail intent in the same Serializable transaction. The auth-mail worker must reach durable `SENT`; only then may the BFF report delivered notification. The replay must report `replayed=true` with no `notificationDelivered`; the BFF emits only the bounded `P0_HUMAN_REVIEWER_CEREMONY` marker. The runner polls read-only application/event state and those exact Web-runtime markers for at most 30 minutes.
6. Log in as both customers, require first-time TOTP enrollment, complete MFA, resolve each server-side user/organization/tenant/membership context, and perform the permitted `GET /api/proxy/auth/organization-team` action.
7. Use authenticated tenant B to send the same Web BFF a valid command against tenant A's proven membership identifier and version. A malformed request, HTTP `401`, or a made-up identifier is not accepted as isolation evidence.
8. Through the pinned owner-only SSH boundary, execute Prisma reads from the exact running API container against its actual `AUTH_DATABASE_URL`. The transaction is switched to `READ ONLY` before its first query; `current_user` must be a known restricted auth principal with neither `SUPERUSER` nor `BYPASSRLS`, and `public.user_orgs` must have both RLS and FORCE enabled. With all five exact active-session GUCs set transaction-locally, tenant A must return `A=1` for its membership and tenant B must return `B=0` for that same known row.
9. Resolve the protected Compose authority from the live Web labels, require exactly one migration service and an exact-SHA migration image, and use that service's existing database endpoint without printing it. Inside the exact API image's Prisma client, begin another read-only transaction and assume only the `NOLOGIN`, `NOINHERIT`, `NOSUPERUSER`, `NOBYPASSRLS`, no-members role `pc_registration_receipt_authority`. Prove live that RLS is active and exposes no non-receipt outbox row to that role; the role has only its required reads and bounded outbox insert, no table- or column-level write privileges on registration/audit records or update/delete/truncate privilege on outbox; both exact outbox RLS policies remain bounded; the receipt function is owned by that role and remains `SECURITY DEFINER` with row security on, a fixed `pg_catalog, pg_temp` search path, and no `PUBLIC` execute grant; and both append-only audit triggers are enabled. Then read the exact activated application, APPROVED and ACTIVATED events, immutable approval audit, and named `auth.registration.lifecycle.receipt` outbox entry. Its idempotency key must be `registration-lifecycle:<applicationId>:<applicationVersion>`, and the application, actor, event, audit, correlation, and payload fields must match this exact run.
10. Log both customers out, prove their sessions are rejected, perform fresh password + TOTP re-login, repeat the permitted read, and log out again. The reviewer ends the bounded staff session in the visible production browser.

The PostgreSQL portion supports the production external PostgreSQL topology and does not require a Compose PostgreSQL container. Both database transactions are read-only. The migration database URL moves only over an in-memory NUL-delimited pipe into the exact API container; it is not a command argument, log field, result, or artifact. The workflow never uses SQL to create, approve, activate, repair, impersonate, or delete an identity, never runs a migration, and never calls the receipt producer. A missing producer returns `MISSING_P0_CAUSAL_OUTBOX_PRODUCER`; the workflow must never invent a substitute outbox row.

## Evidence and redaction

The 90-day checksummed artifact contains only a bounded JSON result, sanitized status markers, application/user/organization/tenant/membership identifiers, immutable audit IDs, and causal outbox IDs. Email addresses are represented only by truncated SHA-256 hashes. The triggering-authority comment is posted only after the artifact attempt and reports terminal `PASS` only when execution, redaction validation, exact-main guard, upload, and protected-credential cleanup have all succeeded; otherwise it reports `FAIL` and the bounded blocker.

Passwords, bearer/refresh credentials, raw verification/status tokens, TOTP setup secrets, backup codes, reviewer credentials, mailbox credentials, private keys, and protected server paths are never evidence and must never be printed. The workflow scans its bounded artifact before upload and fails if credential-shaped material is found.

Production P0 registration is accepted only when the workflow reports all of the following for one exact SHA:

- two mail-delivered and email-verified public BFF registrations;
- separate existing staff approval with recent MFA, plus an exact decision replay that returns `replayed=true` without `notificationDelivered`;
- two distinct server-resolved tenants and successful customer MFA/re-login;
- a permitted protected action and an authenticated cross-tenant BFF denial;
- paired PostgreSQL RLS evidence `A=1` and `B=0`;
- a no-members, write-bounded receipt authority, exact bounded RLS policies, a role-owned `SECURITY DEFINER` producer, and enabled append-only audit triggers;
- two exact causal audit/outbox receipts of type `auth.registration.lifecycle.receipt`.

Any missing protected mailbox/SSH prerequisite, reviewer-ceremony timeout or rejection, attempted reviewer credential input, main advancement, production revision mismatch, replay mismatch, generic unauthenticated denial, RLS mismatch, missing audit, or unrelated/missing outbox entry is a hard failure. There is never a partial PASS.
