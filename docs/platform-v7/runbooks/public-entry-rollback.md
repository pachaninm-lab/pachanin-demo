# Public entry deploy, smoke and rollback runbook

## Purpose

Restore the last verified public entry without changing the protected deal architecture, database state or external integrations.

## Preconditions

- exact accepted commit SHA recorded;
- previous verified production deploy identifier recorded;
- immutable preview available for the candidate;
- release tag exposed through `NEXT_PUBLIC_RELEASE`;
- auth API and mail-provider status known;
- operator has deployment rollback permission and audit trail.

## Pre-deploy gate

Do not promote when any item is missing:

1. required CI checks green on the exact head SHA;
2. no unresolved critical/high security review;
3. preview cold-start smoke passed;
4. RU/EN/ZH screenshots reviewed;
5. login password and MFA paths verified against the intended API environment;
6. password-reset delivery verified to a controlled mailbox;
7. rollback target tested and still available;
8. change owner and rollback operator named.

## Production smoke

Record timestamp, release SHA, browser/device, result and correlation ID where applicable.

1. Open `/platform-v7` from a cold browser session.
2. Confirm header, two hero CTAs and product-proof block.
3. Cycle RU → EN → ZH → RU.
4. Open `/platform-v7/login`; confirm no role picker and no role query authority.
5. Submit invalid credentials; confirm universal error and enabled retry.
6. Complete valid password → TOTP.
7. Repeat valid password → backup code using a controlled test account.
8. Log out; confirm server session revocation and return to the public entry.
9. Request password reset; confirm universal screen response and mail receipt.
10. Consume the link once; verify replay is rejected and prior sessions are revoked.
11. Open support and submit a controlled message.
12. Reload, navigate back and restore the tab from browser memory.
13. Check telemetry for the release tag, Web Vitals and absence of new blank-screen/chunk-load spikes.

## Automatic rollback triggers

Rollback immediately when any of the following is confirmed after release:

- public entry returns 5xx or a persistent blank screen;
- login success rate materially drops relative to the pre-release baseline;
- MFA completion fails for valid controlled accounts;
- session cookies are issued before required MFA;
- role or tenant can be influenced from URL/client state;
- reset tokens are exposed, reusable or fail to revoke sessions;
- critical WCAG regression blocks login or recovery;
- LCP/CLS materially exceeds the accepted budget across a representative sample;
- error/chunk-load rate exceeds the agreed alert threshold.

## Rollback execution

1. Freeze further production promotions.
2. Record incident start, current release SHA and observed evidence.
3. Re-promote the last verified deploy through the hosting provider’s immutable deploy rollback mechanism.
4. Do not create an emergency CSS/DOM patch in production.
5. Confirm DNS and CDN point to the rollback deploy.
6. Purge only the affected immutable/static assets when required; do not indiscriminately clear protected session storage.
7. Run the production smoke subset: landing, language, login error, controlled valid login, logout, recovery request.
8. Confirm telemetry release tag changed to the rollback SHA and error rate stabilised.
9. Notify accountable engineering/security/product owners with facts and correlation IDs.
10. Open a root-cause fix PR; never repair directly in `main`.

## Auth-specific rollback

The public UI stack and auth API stack are separate.

- Rolling back the UI must not roll back auth database migrations blindly.
- Rolling back the auth API requires compatibility analysis for session, refresh-family, MFA-challenge and password-reset records.
- Existing sessions must be either supported by the rollback version or explicitly revoked.
- Never restore a version that accepts client role authority or refresh-token replay.
- If email delivery fails but authentication remains safe, disable only password-reset issuance through configuration and show the universal temporary-unavailable state; do not route recovery to support.

## Data impact

The public route-isolation/UI PRs do not add business data migrations.

The password recovery implementation reuses persistent auth challenge/session tables. A rollback must preserve consumed reset challenges and revoked refresh families. Re-enabling them would be a security regression.

## Rollback verification record

```text
Incident ID:
Candidate release SHA:
Rollback release SHA:
Hosting deploy ID:
Start time:
Rollback complete time:
Operator:
Reason:
Smoke results:
Auth/session impact:
Telemetry result:
Remaining risk:
Follow-up PR:
```

## Status boundary

A written runbook is not a rehearsed rollback. The rollback acceptance criterion remains open until the procedure is executed against an immutable preview or staging environment and the evidence is attached to the release record.
