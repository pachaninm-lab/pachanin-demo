# Security event catalogue

OWASP ASVS 5.0 V16.3.3 asks for two things: that the application logs the
security events **defined in the documentation**, and that it logs **attempts to
bypass the security controls** — naming input validation, business logic and
anti-automation as the examples. This file is that definition.

It is not a wish list. `scripts/security/verify-security-event-catalogue.mjs`
fails the build when this file and `apps/api/src/common/security/security-events.ts`
disagree in either direction, and when a documented event has no call site that
actually emits it. An event described here but emitted nowhere is the failure
this catalogue exists to prevent, not a plan.

## Where these go, and why not the audit trail

Bypass attempts are written to the **application log**, one structured JSON line
per event, at `warn`.

They deliberately do not go to `AuditService`. That service writes a
hash-chained row describing a business action and requires an actor, a role and
usually a deal. The requests recorded here are frequently unauthenticated, carry
none of that, and arrive in volume precisely when someone is probing — letting an
anonymous caller append to the tamper-evident chain at will would weaken the
chain rather than strengthen the record.

`warn` is chosen because production narrows the logger to `fatal`, `error`,
`warn` and `log` (ASVS V13.4.2). An event written at `debug` would exist only on
a developer's machine, which is the one place these do not matter.

## What an event may contain

Every field is chosen by this codebase, never by the caller. A rejected request
is interesting precisely because its contents are hostile, so echoing the
payload, the header or the framework's validation message into the log would put
attacker-chosen text into the record that is meant to be evidence *about* the
attacker.

| Field | Source | Notes |
| --- | --- | --- |
| `event` | this catalogue | one of the names below |
| `control` | the class that refused | `RateLimitGuard`, `SecurityLoggingValidationPipe`, `RolesGuard` |
| `reason` | a fixed code | never a message from the request or the framework |
| `method` | the request method | |
| `route` | the **route table** | the template `/deals/:id`, never the requested URL |
| `subject` | the session | authenticated user id, or `anonymous` |
| `fields` | declared names | property or role **names**, never values |
| `count` | a counter | number of violations, or the bound that was hit |

`fields` is filtered rather than trusted, because for an endpoint whose body is
typed as a plain object the rejected property name is itself the caller's. A
name carrying a newline would forge a second log line — the log-injection version
of the bypass being recorded. Names are capped at 20 per event and 64 characters
each, and anything outside `[A-Za-z_$][\w$.-]*` is dropped.

## The events

### `security.anti_automation.rejected`

- **Control**: `RateLimitGuard`
- **Emitted when**: a request is refused by a rate-limit bound and the caller
  receives 429.
- **Why**: the 429 reaches the caller, who already knew. Without this it reached
  nobody else, so a sustained probe was indistinguishable from ordinary traffic.
- **Reason codes**: `RATE_LIMITED`

### `security.input_validation.rejected`

- **Control**: `SecurityLoggingValidationPipe`, the subclass that carries the
  global `ValidationPipe` configuration
- **Emitted when**: a request body fails positive validation against its declared
  constraints and the caller receives 400.
- **Why**: an attempt to push a value past a declared constraint is an attempt to
  bypass input validation. The global pipe previously carried no
  `exceptionFactory`, so a rejected payload produced a 400 and no record.
- **Reason codes**: `CONSTRAINT_VIOLATION`
- **Note**: the 400 response body is unchanged. The pipe wraps Nest's own
  exception factory and returns its result, so the response remains a list of
  messages rather than the raw `ValidationError` objects — which carry `value`
  and `target`, the rejected value and the whole submitted object.

### `security.authorization.rejected`

- **Control**: `RolesGuard`
- **Emitted when**: an authenticated caller reaches a route their role may not
  reach and receives 403.
- **Why**: this is the business-logic bypass the requirement names. The role is
  recorded because it is read from the session, not from the request.
- **Reason codes**: `ROLE_NOT_PERMITTED`

## What this catalogue does not cover

- **Authentication** successes and failures, which are recorded separately and
  are credited under V16.3.1 and V16.3.2.
- **Log storage, retention, access control and formats across every layer** of
  the stack. That is the inventory ASVS V16.1.1 asks for, and it does not exist;
  V16.1.1 remains FAIL. This file defines a set of security events and binds it
  to the code that emits them, which is what V16.3.3 asks for, and claims nothing
  beyond that.
