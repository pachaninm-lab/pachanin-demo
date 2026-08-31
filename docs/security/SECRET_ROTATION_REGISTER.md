# Secret Rotation Register

Status: **ACTIVE_EXPOSED_SECRETS = 0**, within the coverage stated below.

Source SHA: `71c712ac1dc4bb1c902bd8cfefb2ee88b8e95d3c`
Scanner: `scripts/security/scan-secret-history.mjs`
Allowlist: [`secret-scan-allowlist.json`](./secret-scan-allowlist.json)

Reproduce:

```
node scripts/security/scan-secret-history.mjs            # working tree
node scripts/security/scan-secret-history.mjs --history  # every blob, ~7s
```

The scanner never prints a secret. Findings carry class, location and a
truncated SHA-256 fingerprint only, so two runs can be compared without
republishing the value.

## Result

| Scope | Objects | Findings | Allowlisted |
|---|---:|---:|---:|
| Working tree | 6 183 | **0** | 0 |
| Full history | 25 976 blobs | **0** | 1 |

History analysed at full depth — 23 235 commits. The clone was unshallowed
first; on a shallow clone this scan would have silently missed most of history.

## Findings investigated

Every candidate was inspected and none was a credential.

| Signal | Hits | What it actually is |
|---|---:|---|
| `BEGIN RSA/OPENSSH/EC PRIVATE KEY` | 10 commits | A shell `case` arm validating the *format* of a key supplied from GitHub Secrets. No key material follows the header. |
| `github_pat_` | 2 commits | A `sed` expression that **redacts** tokens to `[REDACTED]` in logs. Defensive code. |
| `AKIA` | 19 commits | The safety filter that blocks Gekta from emitting AWS or OpenAI keys in a response, and the request-route equivalent. Defensive code. |
| `BEGIN CERTIFICATE` | 10 commits | Certificate public halves and test fixtures. A certificate is not secret; the private key is, and none was found. |
| `ghp_`, `xoxb-`, `AIza`, DSA, PGP private | 0 | Absent. |
| Connection strings | 104 in tree | All target `localhost`, `127.0.0.1`, bare Docker service names, or domains reserved by RFC 2606 for documentation and testing (`.example`, `.example.com`, `.invalid`, `.test`, `.local`, `.internal`). CI configuration, not credentials. |

One historical blob is allowlisted: a synthetic value inside a test asserting
that telemetry **refuses** secret-like literals, sitting beside the obviously
fake `sk-proj-abcdefghijklmnop`. It is a test of the guard, not a credential,
and the file is no longer in the tree.

The allowlist is pinned by **blob SHA, never by path**. Changing the content
produces a new blob and the finding returns. An allowlist keyed on paths would
let a real secret be introduced into an excused file.

## Coverage limits

The programme forbids treating an absence of matches as absolute proof, so the
boundaries are stated explicitly.

**Detected:** credentials with a recognisable structure — AWS access key IDs,
GitHub tokens and fine-grained PATs, Slack bot tokens, Google API keys, OpenAI
keys, JWTs, private key material with a base64 body, and connection strings
pointing at a routable host.

**Not detected:**

- an arbitrary password with no distinguishing shape;
- a credential aimed at a host this scanner treats as non-routable, if that
  host is in fact reachable in some environment;
- a credential inside a binary or compressed object;
- a secret in a base64 or otherwise encoded payload;
- a token from a provider whose format is not listed above;
- anything that only ever existed outside Git — CI secrets, server-side `.env`
  files, deployment keys held on the host.

`ACTIVE_EXPOSED_SECRETS = 0` therefore means *no credential of a detected class
is present*, not *no credential has ever existed*.

## Rotation procedure

If a future run reports a finding:

1. Treat it as **COMPROMISED_UNTIL_ROTATED** from the moment it entered Git.
   Public exposure is not required — it was in a repository that is itself
   public today.
2. Rotate the credential at its source first. Removing it from Git changes
   nothing about the exposure.
3. Revoke the old value and confirm the revocation independently.
4. Record here: class, fingerprint, blob reference, rotation date and how
   revocation was verified. **Never the value.**
5. Only then consider whether the object should be removed from history.

**History rewriting does not undo compromise.** It needs its own reviewed plan,
a backup and a reference map, and the credential is rotated regardless. Removal
without rotation is theatre.

## Open items

- No credential of a detected class is present, so there is nothing to rotate
  today; the register has no rotation entries.
- The scanner runs against the working tree in CI. The full-history pass is
  on demand — it takes about seven seconds, so it is cheap to run before any
  release or repository-visibility change.
- Secrets held outside Git (GitHub Actions secrets, REG.RU host material) are
  outside this scanner's reach and need their own inventory and rotation
  schedule. That inventory does not exist yet.
