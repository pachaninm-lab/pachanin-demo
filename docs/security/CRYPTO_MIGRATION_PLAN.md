# Cryptographic migration plan

Companion to `docs/security/cryptographic-inventory.json`, which is generated
from the tree, and `docs/security/cryptographic-key-usage.json`, which records
what each key is for. This one answers the remaining question: what happens when
an algorithm here has to be replaced.

It is held to the inventory by `scripts/security/verify-crypto-migration-plan.mjs`.
Every algorithm the inventory reports must appear below with a migration target
and a trigger, so an algorithm cannot enter the codebase without someone deciding
in advance how it would leave.

Not a schedule. Nothing below is committed to a date, because a migration plan
that invents dates it cannot keep is worse than one that states triggers
honestly.

## The position on post-quantum, stated first because it is the usual question

**This application performs no asymmetric cryptography.** The generated
inventory reports zero sites for signing, verification, key-pair generation and
key exchange — that is a measured count, not an assertion. Every algorithm below
is symmetric or a hash.

That matters for the shape of the exposure. The classic quantum break, Shor's
algorithm against RSA and elliptic curves, applies to key exchange and
public-key signatures. In this system those exist only in TLS at the edge, which
is hosting configuration and outside the application's custody — so the
post-quantum migration that matters most for this product is a **hosting**
migration, and this repository cannot perform it.

What applies to the algorithms here is Grover's algorithm, which weakens
symmetric primitives by roughly half their bit strength rather than breaking
them. AES-256 retains a 128-bit margin under it; SHA-256 retains 128-bit
preimage resistance. Neither needs replacing on quantum grounds today, and the
honest statement is that the trigger for both is a published practical advance,
not a calendar.

**Harvest-now-decrypt-later** is the one case where waiting is itself a
decision. It applies to data encrypted at rest that must stay confidential for
many years. The only such data here is under AES-256-GCM, whose 128-bit
post-quantum margin is adequate, so no re-encryption is planned. If a key length
below 256 bits is ever introduced, this paragraph stops being true and the
gate below will demand it be revisited.

---

## AES-256-GCM — symmetric encryption, 7 sites

**Protects** MFA secrets at rest, stored phone numbers, and auth-mail outbox
payloads.

**Why it stays** 256-bit key, authenticated mode, 128-bit post-quantum margin.

**Migration trigger** A practical attack on GCM's authentication under nonce
reuse in this codebase's usage pattern, or an approved-algorithm change by the
standard this programme tracks.

**Target** AES-256-GCM-SIV, which removes nonce-reuse fragility while keeping
the key size and the primitive.

**Cost** Re-encryption of everything at rest under the old key. The auth-mail
outbox already derives per-version keys from a versioned keyring, so it can be
migrated without downtime. The other two hold one unversioned key each, so they
would need a versioned envelope first — that is the work, not the cipher swap.

## SHA-256 — hashing, 78 sites

**Used for** content digests, fingerprints and correlation values.

**Why it stays** 128-bit post-quantum preimage resistance; no collision-sensitive
use was found where an adversary controls both inputs.

**Migration trigger** A practical preimage attack, or a use appearing where an
adversary controls both sides of a comparison.

**Target** SHA-384, chosen over SHA-512 because it resists length-extension.

**Cost** Any stored digest becomes unverifiable. Every site here recomputes from
the source rather than comparing to a stored value, except where noted under
HMAC below, so this is mostly a redeploy rather than a data migration.

## HMAC-SHA256 — message authentication, 22 sites

**Authenticates** opaque one-time credentials, webhook bodies from banks and EDO,
tool assertions, session and cabinet tokens, and pagination cursors.

**Why it stays** A MAC does not inherit its hash's collision weakness, and the
construction is unbroken.

**Migration trigger** A practical forgery against HMAC itself, not against SHA-256.

**Target** HMAC-SHA384, or KMAC if the codebase gains SHA-3.

**Cost** Every stored digest stops verifying. This is the expensive one: backup
codes, reset tokens, invitations and every other opaque credential are stored as
digests and cannot be re-derived, so migration means invalidating outstanding
credentials — the same class of decision recorded in #4777. A versioned digest
prefix already exists (`v1:`), so both schemes can be accepted during a window;
that is what makes this migration possible at all.

## HMAC-SHA1 — message authentication, 1 site

**Authenticates** nothing of the platform's own. It is the TOTP construction in
`auth-crypto.ts`.

**Why it stays** RFC 6238 specifies SHA-1, and every authenticator application
implements that. Using anything else would produce codes no user's device can
generate. The security argument is separate from SHA-1's collision weakness:
this is a MAC over a counter with a six-digit truncated output and a 30-second
lifetime, and collision resistance is not the property it relies on.

**Migration trigger** Authenticator applications broadly supporting SHA-256
TOTP. This is an ecosystem trigger, not a cryptographic one.

**Target** TOTP with SHA-256, advertised through the `algorithm` parameter of the
otpauth URI, which already derives from a single constant.

**Cost** Every enrolled factor must be re-enrolled, because the shared secret is
bound to the algorithm the device was provisioned with.

## HKDF-SHA256 — key derivation, 3 sites

**Derives** the opaque-token digest key and the auth-mail per-version keys from
master material, under purpose labels.

**Why it stays** It is the mechanism that keeps those contours separated, and it
is unbroken.

**Migration trigger** Follows SHA-256 above.

**Target** HKDF-SHA384.

**Cost** Every derived key changes, so everything under them stops verifying.
The `info` labels already carry a `:v1` suffix, so a second derivation can be
introduced alongside the first.

## scrypt — password hashing, 2 sites

**Protects** passwords, for accounts written or changed since #4684.

**Why it stays** Memory-hard, and its parameters were measured against the
bcrypt cost previously in use rather than copied from a document.

**Migration trigger** Argon2id becoming available without adding a dependency
this programme would have to license and provenance-check, or a practical attack
on scrypt.

**Target** Argon2id.

**Cost** None forced. The stored format carries an explicit scheme, version and
parameter marker, and verification upgrades a hash in place once the password is
presented — so a migration completes as users log in, with no forced reset.

## bcrypt — password hashing, legacy population

**Protects** passwords for accounts not touched since #4684.

**Why it is still here** Removing it locks out every account that has not logged
in since. That population cannot be re-hashed without the password.

**Migration trigger** None needed — it is already migrating. Each legacy hash is
replaced with scrypt the next time that user authenticates.

**Target** scrypt, then Argon2id with the rest.

**Cost** None, by construction. This is why V6.2.8 records a FAIL that is
shrinking rather than a defect that is static.

## CSPRNG — 31 sites

**Source** Node's `crypto.randomBytes` and WebCrypto's `getRandomValues`. No
`Math.random` was found generating any secret.

**Migration trigger** A flaw in the platform CSPRNG, which would be a runtime
upgrade rather than a code change.

**Target** The platform's replacement.

**Cost** None in this codebase.

## WebCrypto HMAC — 5 sites

**Used by** the web tier's cabinet session signing and verification.

**Why it stays** It is HMAC-SHA256 through a different API, and it moves with
the entry above.

**Migration trigger** Follows HMAC-SHA256.

**Target** Follows HMAC-SHA256.

**Cost** Cabinet sessions are capped at eight hours, so they age out rather than
needing migration.

---

## What this plan does not cover

- **Edge TLS.** Not in the application's custody; the post-quantum migration
  that matters most for this product happens there and this repository cannot
  perform it.
- **Key lifecycle.** What a crypto-period is, who may hold a key and when it
  must be retired is a key management policy, and there is not one.
  V11.1.1 remains FAIL. A migration plan says what replaces an algorithm; it
  does not say when a key must be rotated.
- **Dates.** Every entry above states a trigger, because a plan built on
  invented dates would be a worse record than one built on conditions.
