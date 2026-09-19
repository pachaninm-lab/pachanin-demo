# Session policy

The two limits on a session's life, the reasoning behind each, and where each
is enforced. ASVS V7.1.1 asks that both be documented and appropriate; V7.3.1
and V7.3.2 ask that each be enforced according to that reasoning rather than
being a number nobody reviewed.

Every number below is a constant in the source, named here so a reviewer can
check the document against the code rather than take its word.

| Limit | Value | Constant | Enforced in |
|---|---|---|---|
| Inactivity timeout | **1 hour** | `SESSION_IDLE_TIMEOUT_MS` | `auth.service.ts` and `product-session.service.ts`, both from the same constant |
| Inactivity timeout, MFA-bound roles | **15 minutes** | `PRIVILEGED_SESSION_IDLE_TIMEOUT_MS` | `auth.service.ts`, selected by `idleTimeoutMsForRole` from the role on the session row |
| Absolute maximum lifetime | **30 days** | `SESSION_TTL_MS` | set at session creation as `expires_at`, re-checked on every request |
| Access token lifetime | **15 minutes** | `ACCESS_TOKEN_TTL` | `access-token.ts`, signed into the token |
| Pending MFA challenge | **10 minutes** | `MFA_CHALLENGE_TTL_MS` | both session services |

## Why 1 hour, and 15 minutes for MFA-bound roles

**What it bounds.** An absolute cap does not bound idle exposure. Before this
limit existed, a session left on a shared terminal, a lost phone or a browser
nobody closed stayed valid for the whole thirty days. The timestamp needed to
bound it had been stored since the sessions table was created — every
authenticated request updates `last_seen_at`, throttled to one write a minute —
and nothing read it.

**This section replaced a weaker one, and the replacement is the point.** The
first version of this control used twelve hours, and argued for it here: this
platform is used by drivers, elevator operators and surveyors whose work is
interrupted by the job rather than by choice, so a shorter limit would be met by
keeping a tab awake rather than by better security. The owner rejected that
number, and the rejection was correct. The argument treated the session as the
only way to preserve work in progress. It is not. The answer to an interrupted
shift is to keep the state and let the person reauthenticate back into it — an
idle limit set by how inconvenient logging in feels is a limit chosen by the UX
budget rather than by risk. That reasoning is left visible rather than deleted,
because a policy document that quietly replaces its own justification is the
kind of record this programme keeps finding to be untrue.

**Why the MFA-bound tier gets less.** An idle session belonging to an `ADMIN`,
`COMPLIANCE_OFFICER` or `ARBITRATOR` carries authority over other people's
organizations, so the same minutes of exposure are worth more to whoever finds
the device. `GUEST` is different: it is the server-derived role for an approved
employee membership inside one organization, not anonymous access and not a
control-plane role. That membership is nevertheless required to complete TOTP
before activation, and the central `ROLES_REQUIRING_MFA` authority deliberately
gives it the same conservative fifteen-minute idle limit. This keeps the login,
access-token verification and idle-session policy aligned instead of letting a
new employee bypass the MFA lifecycle because the membership is not an
organization administrator.

Fifteen minutes also matches the MFA freshness window already used for
privileged operations, so the controls expire together for the cross-organization
roles rather than leaving a window where the session is still live but the
step-up is not.

**One authority for the shorter tier.** The tier is decided from the role on the
session context row being validated — not from `staffRoles`, not from a second
lookup — and the set is `ROLES_REQUIRING_MFA`, this platform's existing
definition of roles that cannot activate a session without MFA. A second role
list here would create two answers to the same login-policy question. A malformed
or absent role falls to the ordinary one-hour limit, never to no limit.

**Product sessions.** A product session carries a scope, not a platform role, so
the role-selected fifteen-minute tier does not apply there and is not faked.
Reaching for `staffRoles` to invent one would create the second authority this
policy just refused. Product sessions still require MFA through their own
scope-specific issuance path and use the ordinary one-hour inactivity timeout.

**What it is not doing alone.** Financial commands above a threshold already
require recently verified MFA regardless of how old the session is
(`assertRecentFinancialMfa`), and entering a control-plane or privileged
context requires a step-up. Neither is relaxed to compensate for the shorter
idle window. The idle limit bounds ambient exposure; it does not stand alone in
front of the operations that move money or change authority.

**Revising it.** Two constants, in one place, used by both session pathways. If
the operational answer is a different number, `SESSION_IDLE_TIMEOUT_MS` and
`PRIVILEGED_SESSION_IDLE_TIMEOUT_MS` are the lines to change and this section is
what has to change with them.

## Why 30 days absolute

**What it bounds.** The longest a session can live no matter how actively it is
used. It is set as `expires_at` at creation and re-checked on every request, so
it cannot be extended by activity — that is what separates it from the
inactivity timeout, which activity does reset.

**Why this length.** The re-authentication it forces is the point: it puts a
floor under how long a credential change, a role change or a device handover
can go unreflected in a live session. Thirty days is long for a session and
short for a credential, which is the balance being struck — and it is not the
only thing enforcing that floor. A session is invalidated immediately when the
account's credential version changes, when the membership stops being active,
when the organization stops being verified, or when the role becomes one the
platform does not admit. The absolute cap is the backstop for the cases none of
those catch.

**The honest limit of this justification.** Thirty days was in the code before
it was in a document. What is written here is the reasoning that supports it,
arrived at by reading what the surrounding controls already enforce — not a
record of a review that happened at the time. If a review reaches a different
number, this document is where that decision goes.

## What this policy does not cover

- **Concurrent sessions.** How many parallel sessions one account may hold, and
  what happens when that number is exceeded, is not defined and not enforced.
  V7.1.2 remains FAIL.
- **Federated session lifetime.** No identity provider is integrated, so there
  is no relying-party session to keep in step with one. V7.1.3 and V7.6.1 are
  recorded on that basis rather than on a policy stated here.
- **Key lifecycle.** Session secrets are covered by the cryptographic key usage
  record; when key material must be retired is a key management policy, and
  there is not one. V11.1.1 remains FAIL.
