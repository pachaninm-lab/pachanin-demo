# Session policy

The two limits on a session's life, the reasoning behind each, and where each
is enforced. ASVS V7.1.1 asks that both be documented and appropriate; V7.3.1
and V7.3.2 ask that each be enforced according to that reasoning rather than
being a number nobody reviewed.

Every number below is a constant in the source, named here so a reviewer can
check the document against the code rather than take its word.

| Limit | Value | Constant | Enforced in |
|---|---|---|---|
| Inactivity timeout | **12 hours** | `SESSION_IDLE_TIMEOUT_MS` | `auth.service.ts` and `product-session.service.ts`, both from the same constant |
| Absolute maximum lifetime | **30 days** | `SESSION_TTL_MS` | set at session creation as `expires_at`, re-checked on every request |
| Access token lifetime | **15 minutes** | `ACCESS_TOKEN_TTL` | `access-token.ts`, signed into the token |
| Pending MFA challenge | **10 minutes** | `MFA_CHALLENGE_TTL_MS` | both session services |

## Why 12 hours of inactivity

**What it bounds.** An absolute cap does not bound idle exposure. Before this
limit existed, a session left on a shared terminal, a lost phone or a browser
nobody closed stayed valid for the whole thirty days. The timestamp needed to
bound it had been stored since the sessions table was created — every
authenticated request updates `last_seen_at`, throttled to one write a minute —
and nothing read it.

**Why not shorter.** This platform is used by drivers, elevator operators,
surveyors and lab staff whose work is interrupted by the job rather than by
choice: a vehicle in transit, a queue at the weighbridge, a sample in the oven.
An idle limit that logs those users out mid-shift is not met by better
security; it is met by keeping a tab awake, which produces the same exposure
with the added cost that the control is now being worked around rather than
observed. Twelve hours clears the gaps that occur inside a working day.

**Why not longer.** Sixty times shorter than the absolute cap means an
abandoned session stops being useful the same day rather than the same month.
That is the property worth having: the window in which a device found or
borrowed still carries a live session is a shift, not a season.

**What it is not doing alone.** Financial commands above a threshold already
require recently verified MFA regardless of how old the session is
(`assertRecentFinancialMfa`), and entering a control-plane or privileged
context requires a step-up. The idle limit bounds ambient exposure; it does not
stand alone in front of the operations that move money or change authority.

**Revising it.** One constant, in one place, used by both session pathways. If
the operational answer is a different number, `SESSION_IDLE_TIMEOUT_MS` is the
line to change and this section is what has to change with it.

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
