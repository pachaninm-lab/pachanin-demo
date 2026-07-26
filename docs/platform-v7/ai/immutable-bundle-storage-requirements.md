# Owner package A — immutable model-bundle storage requirements

Status: **owner decision required.** Nothing here is provisioned. This document states what the
storage must do, how to create it, and the one question that must be answered before a provider
can be chosen.

Program: #2726. Blocks backlog items **B.06** (immutable upload with proven retention) and **B.07**
(clean restore with re-verified digests), which in turn block **C.01–C.05** (benchmark and model
admission) and **L.05** (restore acceptance).

---

## 1. What this storage is for

One purpose only: hold the model bundle — converted GGUF artifacts plus their manifests — so that a
model can be restored bit-for-bit on a rebuilt host, and so that no operator, credential or process
inside the platform can quietly alter or delete the bytes an admitted model was measured against.

That is why immutability is a hard requirement rather than a preference. A benchmark result and an
admission decision are only meaningful if the artifact they refer to cannot change afterwards. If
the bytes are mutable, every downstream attestation is an assertion about something that no longer
provably exists.

This storage is **not** for evidence retention, documents, user uploads or backups. Those have their
own contours and are out of scope here.

---

## 2. Provider-neutral contract

The platform speaks S3. Any provider that satisfies every mandatory control below is acceptable, and
since #3241 the verifier in `apps/tai/tai/model_bundle_s3_preflight.py` accepts any registered
provider profile rather than one. It checks these controls against a live endpoint and fails closed
on each, with one exception recorded in §2.4.

### 2.1 Mandatory controls

| # | Control | Required value | Why it is mandatory |
|---|---|---|---|
| A1 | Transport | HTTPS endpoint only | Credentials and bytes must not cross the network in the clear. |
| A2 | Bucket versioning | `Enabled` | Object Lock is defined per object version. Without versioning there is nothing to lock. |
| A3 | Object Lock | `Enabled` at bucket creation | Cannot be enabled on an existing bucket on most S3 implementations. Getting this wrong means recreating the bucket. |
| A4 | Default retention mode | `COMPLIANCE` | `GOVERNANCE` mode can be bypassed by a principal holding `s3:BypassGovernanceRetention`. That is a deletable bucket with extra steps, not an immutable one. |
| A5 | Default retention period | ≥ **90 days**, ≤ 365 days | Long enough to outlive a benchmark-to-admission cycle; bounded so storage cost stays predictable. |
| A6 | Public access | Private by default; anonymous `ListObjects` returns 401 or 403 | Model artifacts are not public. This is verified by an unauthenticated request, not by reading a setting. **The preflight checks the bucket listing only** — see §2.4. |
| A7 | Delete denial | Bucket policy denies `s3:DeleteObject` and `s3:DeleteObjectVersion` on the governed prefix, **for every principal including the bucket owner** | Object Lock protects a locked version. The policy closes the gap for anything not yet locked, and stops delete markers from hiding current objects. |
| A8 | Dedicated principal | A separate access key holding exactly the action set in §2.5 and nothing beyond it | The platform's own credentials must not be able to reach this bucket, and this bucket's credentials must not reach anything else. |
| A9 | Capacity | ≥ **120 GB** usable, provider-confirmed | See §3. |
| A10 | Region | Russian contour | Infrastructure policy. Non-negotiable. |

### 2.2 Controls that are optional, and why

`Bucket Encryption` (SSE-S3 / SSE-KMS) and `Public Access Block` are **not** mandatory. Several
S3-compatible Russian providers do not implement these two APIs, and the guarantees this bucket
actually needs — immutability and privacy — are delivered by A2–A7 without them. A provider that
does offer them should have them on; a provider that does not is not thereby disqualified.

This is the single most important thing to get right when comparing providers: **do not reject a
provider for missing Bucket Encryption; do reject one for missing Object Lock in COMPLIANCE mode.**

### 2.3 Exact secret names

These names are fixed. The workflows read them and fail closed if any is absent.

| Secret | Contents | Example shape |
|---|---|---|
| `TAI_BUNDLE_S3_ENDPOINT` | HTTPS endpoint URL | `https://s3.<provider>.ru` |
| `TAI_BUNDLE_S3_REGION` | Region identifier | `ru-1` |
| `TAI_BUNDLE_S3_BUCKET` | Bucket name | `tai-model-bundles` |
| `TAI_BUNDLE_S3_PREFIX` | Governed key prefix, **no trailing slash** | `bundles` |
| `TAI_BUNDLE_S3_ACCESS_KEY_ID` | Dedicated principal's key id | — |
| `TAI_BUNDLE_S3_SECRET_ACCESS_KEY` | Dedicated principal's secret | — |
| `TAI_BUNDLE_S3_PRINCIPAL_ID` | Principal identifier the policy names | — |
| `TAI_BUNDLE_S3_CAPACITY_BYTES` | Provider-confirmed capacity, decimal bytes | `120000000000` |

Store them as GitHub Actions repository secrets. Do not commit them, do not paste them into an
issue, and do not send them in a chat message — including to me.

---

### 2.4 One gap closed, one still open

Review of this package found both. One is now fixed in the verifier; the other turned out
to be harder than it looked and is still outstanding.

**Closed — the verifier is provider-neutral.** `apps/tai/tai/model_bundle_s3_preflight.py`
used to hold `_SELECTEL_PROFILE = "SELECTEL_S3_2026"` as a single constant and reject any
other value before examining a single control, so a conforming non-Selectel bucket failed
step 9 on the profile string alone. PR #3241 replaced that with a profile registry:
`SELECTEL_S3_2026` keeps its two waivers, `GENERIC_S3_COMPLETE` waives nothing, and every
mandatory control is checked identically for both. The workflow now reads the profile from
the requirements artifact rather than repeating it, and a test asserts no profile name
appears in the workflow at all. A declared entry in `unsupported_s3_apis` must now also
appear in the named profile, so "unsupported" can no longer be used to opt out of a control
by writing its name down.

To add a provider, add its name to `_PROVIDER_PROFILES` with the set of S3 APIs it genuinely
does not implement, and set `provider_profile` in the requirements artifact. Nothing else
changes.

**Still open — anonymous object reads are not verified.** A6 asks for private-by-default;
the preflight verifies `anonymous_list_probe` only. A bucket that denies anonymous
`ListObjects` while permitting public `GetObject` on a known key passes today, and that
bucket exposes model artifacts to anyone who learns or guesses a key.

The obvious fix does not work, which is why this is still open. An unauthenticated `GET`
against a fabricated key returns **403, not 404**, when the caller lacks `ListBucket` — S3
does that deliberately so contents cannot be enumerated by probing. A sentinel-key probe
therefore returns an accepted 403 on precisely the misconfigured bucket it was meant to
catch, which is worse than no check. It was written, found wrong in review, and removed
rather than shipped.

A correct probe must `GET` a key **known to exist**: discover one from the authenticated
`list-objects-v2` already run, then request it with no credentials and require 401 or 403.
It also has to decide what an empty bucket means — most usefully, that the check is not
applicable until the bundle is uploaded, which is exactly when the exposure starts to
matter. And it must land in all three producers of the shared observed schema at once —
`tai-bundle-s3-preflight.yml`, `tai-selectel-s3-provision.yml` and
`model-bundle-finalization-driver.v1.sh` — since requiring a command only one of them emits
fails the other two on otherwise valid runs.

Until that exists, treat A6 as verified for bucket listing and **unverified for object
reads**. Set the bucket private and confirm it by hand.

### 2.5 Complete least-privilege action set for the dedicated principal

"`PutObject`, `GetObject`, `ListBucket` and nothing else" is too narrow: the governed
preflight also reads bucket versioning, the Object Lock configuration, the bucket policy
and object versions. A principal without those returns 403 and the bucket fails preflight
despite being correctly built.

Object-level, on `arn:aws:s3:::<bucket>/<prefix>/*`:

- `s3:PutObject`
- `s3:GetObject`
- `s3:GetObjectVersion`
- `s3:GetObjectRetention`

Bucket-level, on `arn:aws:s3:::<bucket>`:

- `s3:ListBucket`
- `s3:ListBucketVersions`
- `s3:GetBucketVersioning`
- `s3:GetBucketObjectLockConfiguration`
- `s3:GetBucketPolicy`

Nothing beyond these nine. In particular **no** `s3:DeleteObject`, `s3:DeleteObjectVersion`,
`s3:PutObjectRetention`, `s3:PutBucketPolicy`, `s3:PutBucketVersioning` or
`s3:BypassGovernanceRetention`. The principal must be able to write artifacts and read back
enough to prove the controls hold — and must not be able to weaken any of them.

## 3. Capacity

Measured and derived, not guessed:

| Item | Bytes | Source |
|---|---|---|
| Qwen3-8B source weights, pinned revision | 30 896 839 600 | recorded in `model-bundle-s3-preflight-requirements.v1.json` |
| Qwen3-8B Q4_K_M GGUF | 5 027 784 032 | verified in the accepted conversion run `29810648430` |
| All planned GGUF artifacts (both models, both quantizations) | 48 995 504 288 | recorded in the same artifact |
| **Minimum provisioned capacity** | **120 000 000 000** | ≈ 2.4× the artifact total |

The headroom is not padding. Versioning plus a 90-day COMPLIANCE lock means a superseded artifact
cannot be deleted to make room — every re-conversion adds a version that stays for the full
retention period. A bucket sized to the artifacts alone fills up on the second conversion and
cannot be emptied.

---

## 4. REG.RU first — and the open question

Infrastructure policy puts REG.RU first, and this document does not deviate from that. The bucket
should be created at REG.RU **if and only if** REG.RU object storage satisfies A2, A3 and A4.

**I could not verify that from this environment, and I am not going to assert it either way.**

What was attempted, and what happened:

- `https://reg.ru/` — the session's egress proxy refused the connection (`CONNECT tunnel failed,
  response 403`).
- REG.RU support documentation for object storage — HTTP 403 through the same proxy.
- Web search for REG.RU-specific Object Lock support — returned material on VK Cloud, Selectel and
  general S3 semantics, and **nothing** documenting REG.RU's own support or lack of it.

A statement like "REG.RU supports Object Lock" or "REG.RU does not support Object Lock" written on
that basis would be a fabricated capability claim about a real vendor, and it would be load-bearing:
the bucket cannot be recreated with Object Lock after the fact, so a wrong answer here is not a
setting to change later, it is a migration.

### 4.1 The decision probe

This is a read-only check that answers the question factually in a few minutes. Run it against a
REG.RU account with object storage enabled, from any machine with `aws` CLI v2 installed.

```bash
# Fill these in from the REG.RU control panel.
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export EP=https://<regru-s3-endpoint>
export B=tai-object-lock-probe-$(date +%s)

# 1. The decisive test: can a bucket be created WITH Object Lock at all?
aws --endpoint-url "$EP" s3api create-bucket \
    --bucket "$B" --object-lock-enabled-for-bucket
echo "create-bucket exit: $?"

# 2. Is versioning implied and enabled?
aws --endpoint-url "$EP" s3api get-bucket-versioning --bucket "$B"

# 3. Can a COMPLIANCE default retention be set? This is the one that decides it.
aws --endpoint-url "$EP" s3api put-object-lock-configuration --bucket "$B" \
    --object-lock-configuration \
    'ObjectLockEnabled=Enabled,Rule={DefaultRetention={Mode=COMPLIANCE,Days=90}}'
echo "put-object-lock-configuration exit: $?"

# 4. Read it back — a provider that accepts the call but stores nothing fails here.
aws --endpoint-url "$EP" s3api get-object-lock-configuration --bucket "$B"

# 5. Prove the lock actually bites.
echo probe > /tmp/probe.txt
aws --endpoint-url "$EP" s3api put-object --bucket "$B" --key probe.txt --body /tmp/probe.txt
VID=$(aws --endpoint-url "$EP" s3api list-object-versions --bucket "$B" --prefix probe.txt \
      --query 'Versions[0].VersionId' --output text)
aws --endpoint-url "$EP" s3api delete-object --bucket "$B" --key probe.txt --version-id "$VID"
echo "delete of locked version exit: $?   # MUST be non-zero"
```

Report back only the **exit codes and the JSON responses** from steps 1, 3, 4 and 5. Those contain
no credentials. Do not send the access key or secret.

Decision rule:

- **Steps 1, 3 and 4 succeed and step 5 fails** → REG.RU satisfies the contract. Create the bucket
  there, per §5. No further decision needed.
- **Any of steps 1, 3 or 4 fails, or step 5 succeeds** → REG.RU cannot serve as immutable bundle
  storage. This is an owner decision, not an engineering one, and §6 sets it out.

Clean up the probe bucket afterwards only if step 5 failed as it should — a locked object will keep
the bucket alive until retention expires, which is itself confirmation that the control works.

---

## 5. Creating the bucket, once the provider is settled

Order matters. Steps 1 and 2 cannot be reordered or repeated on an existing bucket.

1. **Create the bucket with Object Lock enabled.** `--object-lock-enabled-for-bucket` at creation.
   There is no way to add this to an existing bucket; if it is missed, delete and recreate before
   anything is uploaded.
2. **Confirm versioning reports `Enabled`.** It should be implied by step 1. If it is not, enable it
   explicitly and re-check.
3. **Set the default retention** to `COMPLIANCE` for 90 days, and read the configuration back.
4. **Create a dedicated principal** — a new access key, not the account's root key — with a policy
   granting exactly `s3:PutObject`, `s3:GetObject`, `s3:GetObjectVersion`, `s3:ListBucket` and
   the full action set from §2.5, scoped to `arn:aws:s3:::<bucket>/<prefix>/*` plus the
   bucket-level actions on `arn:aws:s3:::<bucket>`.
5. **Attach a bucket policy denying deletion** to every principal:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "DenyAllDeletesOnGovernedPrefix",
         "Effect": "Deny",
         "Principal": "*",
         "Action": ["s3:DeleteObject", "s3:DeleteObjectVersion"],
         "Resource": "arn:aws:s3:::<bucket>/<prefix>/*"
       }
     ]
   }
   ```

6. **Verify privacy from outside.** With no credentials at all:
   `curl -sS -o /dev/null -w '%{http_code}\n' "$EP/<bucket>/"` must print `401` or `403`.
7. **Confirm capacity** with the provider and record the number in `TAI_BUNDLE_S3_CAPACITY_BYTES`.
   This is an operator-confirmed quota, not a measurement the platform can take.
8. **Register the eight secrets** listed in §2.3.
9. **Run the read-only preflight** — `/tai probe bundle-storage exact-main` on the governed issue.
   It verifies every control in §2.1 against the live endpoint and writes bounded evidence with no
   credential values in it. B.06 is not accepted until this passes.

---

## 6. If REG.RU cannot do it

Then the platform faces a genuine conflict between two rules it has been given: *Russian contour,
REG.RU priority*, and *immutable storage with proven retention*. That conflict is the owner's to
resolve, and there are exactly three honest options.

| Option | What it costs | What it preserves |
|---|---|---|
| **1. A different Russian S3 provider for this one bucket** | A second vendor relationship, scoped to model bundles only. The verifier accepts any registered profile since #3241, so this costs one registry entry. Everything else stays at REG.RU. | Both rules — Russian contour and real immutability. The contour requirement is about jurisdiction, and it is satisfied. |
| **2. Stay entirely on REG.RU without Object Lock** | B.06 and B.07 can never be accepted as written. C.01–C.05 stay blocked, so **no model can be admitted**, and L.10 production attestation is unreachable. | Single-vendor simplicity, at the cost of the program's stated goal. |
| **3. Self-hosted WORM on REG.RU compute** | Build and operate an immutability layer — MinIO with Object Lock on dedicated storage, or equivalent — including its own backup, key management and audit. Weeks of work, and the platform then owns the correctness of its own WORM implementation. | Single vendor and real immutability, paid for in operational surface. |

**Recommendation: option 1**, scoped narrowly. The infrastructure policy's purpose — keeping data
and jurisdiction inside the Russian contour — is fully served by any Russian provider, while option
2 forfeits the outcome the whole program is for and option 3 buys single-vendor tidiness at a price
that is out of proportion to one bucket holding two model files.

I am deliberately not naming which Russian provider to use. The prior work in this repository was
built against a Selectel profile, which is why `provider_profile: "SELECTEL_S3_2026"` still appears
in `model-bundle-s3-preflight-requirements.v1.json` — that is a historical artifact of one earlier
attempt, not a recommendation, and it should be re-derived from whichever provider the owner picks.
Any provider that passes the §4.1 probe satisfies the contract.

**What I need from you:** the probe output from §4.1, and — if REG.RU fails it — which of the three
options above to take.

---

## 7. What this package does not claim

- No bucket exists. No credentials exist. Nothing has been uploaded.
- No provider's capabilities are asserted beyond what §4 records as verified or unverified.
- B.06 and B.07 remain **BLOCKED**. Model admission remains `PENDING_ADMISSION`. Production
  operational status remains `NOT_ATTESTED`.
- The 120 GB figure is a provisioning requirement derived from measured artifact sizes, not a
  measurement of consumed storage.
- The preflight does not verify anonymous object reads. Stated in §2.4 with why the
  obvious probe is wrong, rather than implied to work.
