# Session policy

The limits on a session's life and on how many an account may hold, the
reasoning behind each, and where each is enforced. ASVS V7.1.1 asks that the
lifetime limits be documented and appropriate; V7.3.1 and V7.3.2 ask that each
be enforced according to that reasoning rather than being a number nobody
reviewed; V7.1.2 asks for the concurrency limit and for what happens when it is
reached.

Every number below is a constant in the source, named here so a reviewer can
check the document against the code rather than take its word.

| Limit | Value | Constant | Enforced in |
|---|---|---|---|
| Inactivity timeout | **1 hour** | `SESSION_IDLE_TIMEOUT_MS` | `auth.service.ts` and `product-session.service.ts`, both from the same constant |
| Inactivity timeout, MFA-bound roles | **15 minutes** | `PRIVILEGED_SESSION_IDLE_TIMEOUT_MS` | `auth.service.ts`, selected by `idleTimeoutMsForRole` from the role on the session row |
| Absolute maximum lifetime | **30 days** | `SESSION_TTL_MS` | set at session creation as `expires_at`, re-checked on every request |
| Access token lifetime | **15 minutes** | `ACCESS_TOKEN_TTL` | `access-token.ts`, signed into the token |
| Pending MFA challenge | **10 minutes** | `MFA_CHALLENGE_TTL_MS` | both session services |
| Concurrent platform sessions | **5** | `MAX_CONCURRENT_SESSIONS` | `auth.service.ts` at login, via `revokeSessionsBeyondLimit` |
| Concurrent platform sessions, MFA-bound roles | **3** | `MAX_CONCURRENT_SESSIONS_PRIVILEGED` | same, selected by `concurrentSessionLimitForRole` |

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

## How many at once, and what happens at the limit

**What it bounds.** Not an attacker who has the password — it bounds how much
simultaneous access any one credential can be spread across, and it makes the
displacement visible. Before this, an account could hold unlimited parallel
platform sessions; `organization-team.service.ts` surfaced an
`activeSessionCount` for display, which counted sessions without bounding them.

**Five, and three for the MFA-bound roles.** Five is deliberately generous
against real use here — a phone in a truck cab, a desktop in an office, a
tablet, one spare — and still far below what an account accumulates when nothing
bounds it. The shorter tier is selected by `ROLES_REQUIRING_MFA`, the same
authority that selects the shorter idle timeout above, for the same reason given
there: a second, different notion of "privileged" would create two answers to
one question. A malformed or absent role falls to the ordinary limit, never to
no limit.

Both are overridable per environment so an operator can retune without a deploy.
A value that is not a positive integer is **ignored, not obeyed** — a typo must
not silently remove the bound, and `0` read literally would revoke every session
the account has.

**At the limit, the oldest session ends and the new login succeeds.** The
alternative — refusing the new session — was rejected, and the reason is the one
that matters: if reaching the limit refused new logins, anyone able to open
sessions against an account could fill its budget and lock the real owner out. A
bound meant to contain an attacker would become a denial of service against the
account it protects. Ending the oldest cannot be used that way.

Four details are load-bearing:

- **Oldest by `created_at`, not `last_seen_at`.** The question is which session
  has existed longest, not which has been idle longest. Ordering by idleness
  would let an attacker keep a stolen session alive by touching it and have the
  owner's real sessions evicted instead — the precise inversion of the control.
- **Applied after the new session is created**, so the count includes it and the
  newest session is the one kept. Applied before, the account would sit one over
  the limit until the next login.
- **Scoped to `PLATFORM`.** `auth.sessions` holds more than one kind of session;
  a platform login must not evict a Gekta product session, which has its own
  scope and is not counted here.
- **Refresh tokens of evicted sessions are revoked in the same transaction**, and
  the eviction is written to the audit trail as `auth.session.evicted`. A revoked
  session whose refresh token still works is not revoked, and a session
  disappearing silently is indistinguishable, to its owner, from one being stolen.

**Revising it.** Two constants, one function, one call site. If the operational
answer is a different number, `MAX_CONCURRENT_SESSIONS` and
`MAX_CONCURRENT_SESSIONS_PRIVILEGED` are the lines to change and this section is
what has to change with them.

## What this policy does not cover

- **Product session concurrency.** Gekta product sessions are a separate scope
  with no limit of their own. If one is wanted it is a separate decision with a
  separate number.
- **Staff access grants**, which are time-bound by the staff access control
  plane rather than counted here.
- **Federated session lifetime.** No identity provider is integrated, so there
  is no relying-party session to keep in step with one. V7.1.3 and V7.6.1 are
  recorded on that basis rather than on a policy stated here.
- **Key lifecycle.** Session secrets are covered by the cryptographic key usage
  record; when key material must be retired is a key management policy, and
  there is not one. V11.1.1 remains FAIL.
