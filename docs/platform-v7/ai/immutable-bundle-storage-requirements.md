# Owner package A — immutable model-bundle storage requirements

Status: **REG.RU bucket configured; compatibility and principal semantics not yet accepted.**
The bucket exists and its configuration plane has been read back, but bundle finalization remains
blocked until the dormant compatibility package produces reviewed, bounded evidence.

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

This storage is **not** for evidence retention, documents, user uploads or general backups. Those
have their own contours and are out of scope here.

---

## 2. Provider-neutral contract

The platform speaks S3. Any provider that satisfies every mandatory control below is acceptable.
Since #3241, `apps/tai/tai/model_bundle_s3_preflight.py` has a provider-profile registry rather
than one hardcoded provider. A profile records only genuine API compatibility differences; it does
not waive a mandatory privacy, immutability or least-privilege outcome.

### 2.1 Mandatory controls

| # | Control | Required value | Why it is mandatory |
|---|---|---|---|
| A1 | Transport | HTTPS endpoint with trusted CA verification | Credentials and bytes must not cross the network in the clear. |
| A2 | Bucket versioning | `Enabled` | Object Lock is defined per object version. Without versioning there is nothing to lock. |
| A3 | Object Lock | `Enabled` | The provider must retain locked object versions. Configuration read-back alone is not behavioral proof. |
| A4 | Default retention mode | `COMPLIANCE` | `GOVERNANCE` can be bypassed by a privileged principal and is not the required WORM boundary. |
| A5 | Default retention period | ≥ **90 days**, ≤ 365 days | Long enough to outlive benchmark-to-admission; bounded for predictable cost. |
| A6 | Public access | Anonymous list and GET of a **known existing object** return 401 or 403 | A missing-key 403 does not prove object privacy. |
| A7 | Delete denial | Global deny for `s3:DeleteObject` and `s3:DeleteObjectVersion` on the governed prefix | Prevents delete markers and deletion by every principal, including setup/admin. |
| A8 | Dedicated principal | Provider-issued selector with exactly §2.5 permissions | A display name, Access Key ID or owner identity is not a policy selector. |
| A9 | Capacity | ≥ **120 GB** usable, provider-confirmed | See §3. |
| A10 | Region | Russian contour | Infrastructure policy. |

### 2.2 Controls that are optional, and why

`Bucket Encryption` (SSE-S3 / SSE-KMS) and `Public Access Block` are **not** mandatory. Several
S3-compatible Russian providers do not implement these APIs, and the required guarantees here —
immutability and privacy — are delivered by A2–A7. A provider that offers them should enable them;
their absence does not excuse missing Object Lock in COMPLIANCE mode, global delete denial or
anonymous known-object privacy.

### 2.3 Exact protected-input names

These names are fixed for the existing workflows:

| Protected input | Contents | REG.RU candidate value/status |
|---|---|---|
| `TAI_BUNDLE_S3_ENDPOINT` | HTTPS endpoint URL | `https://s3.regru.cloud` |
| `TAI_BUNDLE_S3_REGION` | Region identifier | `us-east-1` |
| `TAI_BUNDLE_S3_BUCKET` | Bucket name | `tai-model-bundles-prod-01` |
| `TAI_BUNDLE_S3_PREFIX` | Governed prefix, no trailing slash | `tai/model-bundles/v1` |
| `TAI_BUNDLE_S3_ACCESS_KEY_ID` | Dedicated principal key ID | local only; never evidence |
| `TAI_BUNDLE_S3_SECRET_ACCESS_KEY` | Matching secret | local only; never evidence |
| `TAI_BUNDLE_S3_PRINCIPAL_ID` | Provider-issued policy selector | **UNRESOLVED** |
| `TAI_BUNDLE_S3_CAPACITY_BYTES` | Provider-confirmed decimal bytes | `200000000000` |

Do **not** register the REG.RU values as GitHub repository secrets while the candidate profile is
dormant. Never commit credentials or paste them into an issue, pull request, log or chat.

### 2.4 Verifier history and the remaining active-path gap

**Closed in #3241 — provider neutrality.** The evaluator formerly rejected anything except
`SELECTEL_S3_2026` before examining controls. The profile registry now accepts registered profiles
and checks declared API waivers against the named profile.

**Still open in the active shared preflight — anonymous known-object GET.** The active preflight
checks anonymous listing only. A fabricated missing key is not a valid privacy sentinel because S3
may return 403 when the caller lacks `ListBucket`. A correct check must use an authenticated,
known-existing object and then GET that exact key anonymously.

The dormant REG.RU compatibility probe performs the correct known-object test on its uploaded
9 MiB stream. That result does not silently change the active shared schema: activation must update
all active observation producers together.

### 2.5 Complete least-privilege action set

The real finalizer uses multipart upload and exact-version restore. Its complete bucket-level set
on `arn:aws:s3:::<bucket>` is:

- `s3:GetBucketLocation`
- `s3:GetBucketObjectLockConfiguration`
- `s3:GetBucketPolicy`
- `s3:GetBucketVersioning`
- `s3:ListBucket`
- `s3:ListBucketMultipartUploads`
- `s3:ListBucketVersions`

Its complete object-level set on `arn:aws:s3:::<bucket>/<prefix>/*` is:

- `s3:AbortMultipartUpload`
- `s3:GetObject`
- `s3:GetObjectRetention`
- `s3:GetObjectVersion`
- `s3:ListMultipartUploadParts`
- `s3:PutObject`

The dedicated principal must not receive:

- `s3:BypassGovernanceRetention`
- `s3:DeleteObject`
- `s3:DeleteObjectVersion`
- `s3:PutBucketPolicy`
- `s3:PutBucketVersioning`
- `s3:PutBucketObjectLockConfiguration`
- `s3:PutObjectRetention`
- `s3:PutLifecycleConfiguration`

A bucket policy cannot reveal a broader identity grant. Provider-issued local evidence must bind
the exact finalizer selector, a distinct nonmatching control selector, the exact target and these
action sets. The bounded probe then behaviorally tests safe same-policy/configuration calls where
possible.

## 3. Capacity

Measured and derived, not guessed:

| Item | Bytes | Source |
|---|---:|---|
| Qwen3-8B source weights, pinned revision | 30 896 839 600 | recorded in `model-bundle-s3-preflight-requirements.v1.json` |
| Qwen3-8B Q4_K_M GGUF | 5 027 784 032 | accepted conversion evidence |
| All planned GGUF artifacts | 48 995 504 288 | same requirements authority |
| **Minimum provisioned capacity** | **120 000 000 000** | ≈ 2.4× artifact total |
| **Current operator-confirmed REG.RU quota** | **200 000 000 000** | account control plane |

The headroom is not padding. Versioning plus a 90-day COMPLIANCE lock means a superseded artifact
cannot be deleted to make room; every re-conversion adds a version that stays for the retention
period. A bucket sized only to the current artifacts can fill on a later conversion.

---

## 4. Current REG.RU evidence

The earlier version of this document correctly refused to invent a REG.RU capability claim when
no live account evidence was available. That uncertainty has been narrowed through the actual
account:

- service: active REG.RU object storage;
- endpoint: `https://s3.regru.cloud`;
- bucket: private `tai-model-bundles-prod-01`;
- quota: 200 GB;
- separate key set: `tai-bundle-finalizer-prod-01`;
- authenticated bucket access: succeeded;
- versioning read-back: `Enabled`;
- Object Lock read-back: `Enabled`;
- default retention read-back: `COMPLIANCE`, 90 days.

These facts prove only configuration-plane state. They do **not** yet prove:

- exact-version deletion is rejected because of COMPLIANCE rather than missing permission;
- global policy denial prevents a versionless delete marker;
- anonymous GET of a known existing object is denied;
- create/list/upload-part/list-parts/abort multipart compatibility;
- exact-version restore and SHA-256 equality;
- the provider's policy-principal selector and identity permission boundary;
- denial of policy, versioning, Object Lock, retention and lifecycle mutations.

The key-set display name, its Access Key ID, `owner` and the bucket-owner canonical ID must not be
guessed as the policy selector. REG.RU support or a REG.RU API must issue the selector semantics and
exact permission evidence.

---

## 5. Dormant compatibility appendix

The implementation package is bound to exact base
`8655c70900bc087875ce64e7b7f65775ee838b93` and
`REG_RU_S3_2026` remains `CANDIDATE_NOT_ACTIVE`.

It is deliberately local-only:

- no GitHub workflow references the script;
- no protected value is registered;
- committed principal status is `UNRESOLVED`;
- invalid/missing provider evidence stops before credential input and before S3 mutation;
- the exact report path is reserved as a private, non-symlink inode before credential input;
- credentials are read from a TTY with echo disabled and never enter argv or evidence;
- TLS uses `/etc/ssl/certs/ca-certificates.crt`; `--no-verify-ssl` is forbidden;
- the exact target-bearing mutation phrase is required immediately before the first write;
- the original policy is retained for rollback and unrelated statements are preserved;
- raw provider responses, payloads and credentials are deleted with the private temp directory.

One successful run intentionally leaves at most:

| Retained object | Bytes |
|---|---:|
| governed deterministic stream | 9 437 184 |
| independent WORM canary | 4 096 |
| **maximum retained locked bytes** | **9 441 280** |

The aborted multipart part retains zero payload bytes. COMPLIANCE means the two retained versions
cannot be cleaned up for 90 days, so the probe is not a harmless command to repeat.

The proof sequence covers:

1. exact target and private provider-issued attestation;
2. finalizer selector matches the finalizer, not setup/admin, while a provider-attested
   nonmatching selector does not match;
3. versioning, Object Lock and COMPLIANCE 90-day read-back;
4. exact final policy with global delete and insecure-transport denies;
5. denial of same-policy, versioning, Object Lock and object-retention mutations;
6. lifecycle same-configuration denial when lifecycle exists, otherwise explicit provider
   attestation;
7. multipart create/list/upload-part/list-parts/abort and disappearance;
8. 9 MiB streamed upload, nonempty `VersionId`, COMPLIANCE retention expiring 89–91 days from
   probe time and exact-version SHA-256 restore;
9. anonymous list plus HTTPS and insecure-HTTP GET of that exact known object all return 401 or
   403;
10. setup/admin versionless delete under the governed prefix is denied;
11. outside the prefix, delete-marker create/remove succeeds while locked data-version deletion
    fails with an authorization-class provider response, proving delete capability independently
    of WORM. TLS, DNS, timeout, CLI and provider 5xx failures never count as denial evidence.

Any cleanup failure to abort an open multipart upload makes the run failed-closed. The final policy
validator rejects every preserved `Allow` that can overlap the dedicated bucket or governed
subprefix, including wildcard, principal-list and `NotAction`/`NotPrincipal`/`NotResource`
constructs; unrelated statements for other buckets remain preserved.

Only a canonical sanitized report of at most 1 MiB persists. Success is narrowly named
`VERIFIED_REG_RU_S3_COMPATIBILITY`; it is not bundle storage acceptance.

---

## 6. Separate activation boundary

After the sanitized report is reviewed, a separate exact-scope activation change must:

1. add `REG_RU_S3_2026` to the active provider registry with zero unsupported-API waivers;
2. switch shared requirements to the exact endpoint, region, bucket, prefix, capacity and
   provider-issued principal hash;
3. add the trusted CA/checksum environment on both runner and model host;
4. remove functional Selectel assumptions and guard Selectel provisioning before its first AWS
   call;
5. add known-object privacy and multipart-compatible evidence to every active observation producer;
6. update finalization authority and the transitive CPU run-plan authority/Python pins;
7. register protected values only after exact-main review.

Until that activation merges, keep the active requirements on their existing profile and do not run
`/tai finalize model-bundles exact-main`.

---

## 7. What this package does not claim

- The REG.RU candidate is not an active provider profile.
- The committed principal remains `UNRESOLVED`.
- GitHub secret registration and model finalization are not authorized.
- B.06 and B.07 remain blocked pending reviewed compatibility and clean bundle restore evidence.
- Bundle upload/restore and benchmark remain `NOT_RUN`; model admission remains `NOT_DONE`;
  production operational status remains `NOT_ATTESTED`.
- The configuration screenshots/API read-back do not by themselves prove behavioral WORM,
  privacy, policy enforcement or least privilege.
