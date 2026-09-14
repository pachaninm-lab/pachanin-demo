# Browser security requirements and documented behaviour

ASVS V3.7.5 asks that the application behave **as documented** when the browser
does not provide a security feature it depends on. This is that document.

## What is required, and why

| Feature | Needed for | Detected as |
| --- | --- | --- |
| Secure context (HTTPS) | Web Crypto is `[SecureContext]`, and the session cookies are `Secure`. | `globalThis.isSecureContext === true` |
| `crypto.randomUUID` | Command ids and idempotency keys. The API deduplicates on these, so they must be unguessable and collision-free. | `typeof crypto.randomUUID === 'function'` |
| `crypto.subtle` | The SHA-256 digest a staff registration decision is bound to. | `crypto.subtle` is present |

`localhost` is a secure context by definition, so development over plain HTTP is
unaffected.

## The documented behaviour

**The affected action is refused, with a message naming the reason. No weaker
substitute is produced.**

Concretely:

* A surface that needs a feature at render time shows the notice from
  `BrowserSecurityGate` instead of its controls.
* A surface that needs one at submit time refuses that submit and shows
  `BROWSER_SECURITY_REFUSAL`. Nothing is sent.
* `secureRandomId()` throws `BrowserSecurityUnsupportedError` rather than
  returning a value; there is no fallback path that returns a weaker id.

## What this replaced

Two different undocumented behaviours existed before.

Some call sites fell back to `Date.now()` and `Math.random()` — the registration
idempotency key in `RegisterFormClient`, the deal command id in
`CanonicalDealWorkspace`, the invite key in `OrganizationTeamAdminClient`. That
turns an identifier the design assumes is unguessable into a predictable one,
and leaves nothing in the record to say the substitution happened: an operator
reading the audit trail cannot tell a strong key from a weak one.

Other call sites called the missing API directly — `OrganizationConnectForm`,
the two crop-platform command clients, and the staff `decisionMarker`. Those
raised a `TypeError` inside an event handler, which reaches the user as a
control that silently does nothing.

## Known gap

`app/platform-v7/register/RegisterFormClientPublic.tsx` still calls
`globalThis.crypto.randomUUID()` directly in a render-time ref, so in a
non-secure context that public registration page fails to render rather than
saying why. It is frozen by the immutability register in
`tests/unit/platformV7RootWorkEntry.test.ts`, which binds eight public surfaces
to an accepted parent by SHA-256. Applying the fix means re-hashing that
register, which is an owner decision. ASVS V3.7.5 is recorded as FAIL until then.

## Deliberately not covered

`GektaChatWorkspace` builds local message and conversation ids with a
non-cryptographic fallback, and that is intentional. They are React keys and
list identity: they never travel to the server as an idempotency or command
identifier, nothing authorizes on them, and some of those calls run while
parsing a response, where refusing would blank the chat rather than protect
anything. That file is also frozen by the immutability register, so the
`NOT-A-SECURITY-IDENTIFIER` marker cannot be written at the site; the claim is
recorded in `browser-security-exceptions.json`, where the guard reads it and a
reviewer can check the reasoning.

## Enforcement

`scripts/security/verify-browser-security-capabilities.mjs` fails the build if a
Web Crypto call acquires a `Math.random()` or `Date.now()` fallback without that
marker.
