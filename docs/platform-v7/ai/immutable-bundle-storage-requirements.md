# Owner package A — immutable model-bundle storage requirements

Status: **REG.RU bucket and panel rules configured; live compatibility not yet accepted.**

Program: #2726. Blocks backlog items **B.06** (immutable upload with proven retention) and **B.07** (clean restore with re-verified digests), which block benchmark, admission and restore acceptance.

---

## 1. Purpose and boundary

This storage has one purpose: hold converted GGUF model bundles and their manifests so an accepted model can be restored bit-for-bit and measured against immutable object versions.

It is not the evidence store, document store, user-upload store or general backup contour. No model bundle is accepted merely because the bucket exists. Acceptance requires behavioral WORM, privacy, least-privilege, multipart and exact-version restore evidence.

---

## 2. Provider-neutral mandatory contract

The platform speaks S3. A provider is acceptable only when every mandatory outcome below is proved.

| # | Control | Required outcome |
|---|---|---|
| A1 | Transport | HTTPS endpoint with trusted CA verification; insecure HTTP does not expose a known object. |
| A2 | Versioning | `Enabled`. |
| A3 | Object Lock | `Enabled` and behaviorally enforced per version. |
| A4 | Retention | Default `COMPLIANCE`, 90–365 days; current target is 90 days. |
| A5 | Privacy | Anonymous list and GET of a known existing object return 401 or 403. |
| A6 | Dedicated finalizer | Exact least-privilege data-plane and listing permissions only. |
| A7 | Delete boundary | The finalizer cannot create delete markers or delete object versions in the governed prefix. COMPLIANCE independently prevents exact locked-version deletion by admin. |
| A8 | Principal discrimination | The matching finalizer is allowed and a distinct nonmatching control key is denied. |
| A9 | Multipart | Create, list, upload part, list parts, abort and confirmed disappearance work. |
| A10 | Restore | Exact version restores with matching SHA-256. |
| A11 | Capacity | At least 120,000,000,000 usable bytes; current confirmed quota is 200,000,000,000 bytes. |
| A12 | Region | Russian infrastructure contour. |

`Bucket Encryption` and AWS `Public Access Block` APIs remain optional compatibility features. Their absence does not waive HTTPS, anonymous privacy, COMPLIANCE Object Lock, finalizer delete denial or exact-version restore.

---

## 3. Exact REG.RU target

| Field | Value |
|---|---|
| Endpoint | `https://s3.regru.cloud` |
| Region | `us-east-1` |
| Bucket | `tai-model-bundles-prod-01` |
| Governed prefix | `tai/model-bundles/v1` |
| Quota | `200000000000` bytes |
| Admin key set | `owner` |
| Finalizer key set | `tai-bundle-finalizer-prod-01` |
| Nonmatching control key set | `tai-bundle-control-prod-01` |

Credential values and key-set UUIDs are local secrets/evidence-excluded data. They must not enter Git, issues, pull requests, logs, screenshots or chat. The control key set must not be attached to any bucket policy rule.

The protected workflow inputs remain:

- `TAI_BUNDLE_S3_ENDPOINT`
- `TAI_BUNDLE_S3_REGION`
- `TAI_BUNDLE_S3_BUCKET`
- `TAI_BUNDLE_S3_PREFIX`
- `TAI_BUNDLE_S3_ACCESS_KEY_ID`
- `TAI_BUNDLE_S3_SECRET_ACCESS_KEY`
- `TAI_BUNDLE_S3_CAPACITY_BYTES`

Do not register REG.RU values as repository secrets while the candidate profile is dormant.

---

## 4. Exact REG.RU panel authority

The source-controlled panel contract contains five rules for `tai-bundle-finalizer-prod-01`.

### TAI-01 — bucket metadata

Allow on `tai-model-bundles-prod-01`:

- `GetBucketLocation`
- `GetBucketVersioning`

`GetBucketPolicy` is not part of this rule. The live probe must fail until any excess action is removed.

### TAI-02 — governed-prefix listing

Allow on the bucket:

- `ListBucket`
- `ListBucketVersions`

Condition:

- key: `s3:prefix`
- operator: `StringLike`
- values: `tai/model-bundles/v1`, `tai/model-bundles/v1/*`

### TAI-03 — multipart listing

Allow on the bucket without `s3:prefix` condition:

- `ListBucketMultipartUploads`

### TAI-04 — object data plane

Allow on `tai-model-bundles-prod-01/tai/model-bundles/v1/*`:

- `AbortMultipartUpload`
- `GetObject`
- `GetObjectVersion`
- `ListMultipartUploadParts`
- `PutObject`

### TAI-05 — delete denial

Deny on the same governed object scope:

- `DeleteObject`
- `DeleteObjectVersion`

### Admin-only observations

The REG.RU panel does not expose `GetBucketObjectLockConfiguration` and `GetObjectRetention` for the finalizer rule set. The compatibility probe therefore performs these reads through `owner` and proves the finalizer is denied. `GetBucketPolicy` is also admin-only and is used only to validate and hash the five panel-rule semantics.

The finalizer must not receive:

- `BypassGovernanceRetention`
- `GetBucketPolicy`
- `GetObjectRetention`
- `PutBucketPolicy`
- `PutBucketVersioning`
- `PutBucketObjectLockConfiguration`
- `PutObjectRetention`
- `PutLifecycleConfiguration`
- `DeleteObject`
- `DeleteObjectVersion`

---

## 5. Capacity basis

| Item | Bytes |
|---|---:|
| Qwen3-8B source weights, pinned revision | 30,896,839,600 |
| Qwen3-8B Q4_K_M GGUF | 5,027,784,032 |
| All planned GGUF artifacts | 48,995,504,288 |
| Minimum provisioned capacity | 120,000,000,000 |
| Current REG.RU quota | 200,000,000,000 |

Versioning and 90-day COMPLIANCE retention mean superseded versions cannot be immediately removed. Headroom is mandatory, not optional padding.

---

## 6. Current evidence and remaining gap

Confirmed from the live account:

- REG.RU object storage is active;
- the private bucket exists;
- versioning reads back `Enabled`;
- Object Lock reads back `Enabled`;
- default retention reads back `COMPLIANCE`, 90 days;
- finalizer and distinct control key sets exist;
- the five panel rules are configured, subject to removal of the known excess `TAI-01` action before execution.

These facts do not yet prove live compatibility. The remaining dormant probe must prove:

1. exact five-rule policy read-back with no excess target `Allow`;
2. finalizer allowed and control denied;
3. finalizer control-plane and retention denial;
4. finalizer versionless and version deletion denial;
5. COMPLIANCE exact-version deletion rejection by admin;
6. multipart create/list/upload-part/list-parts/abort/disappearance;
7. 9 MiB streamed upload, nonempty version ID and 89–91 day retention deadline;
8. exact-version SHA-256 restore;
9. anonymous list and known-object GET rejection over HTTPS and HTTP.

No provider-issued low-level principal attestation is required. REG.RU binds panel rules directly to selected key sets; behavioral discrimination between finalizer and control is the principal proof. Raw policy is supplemental evidence only and is never retained.

---

## 7. Dormant local compatibility package

The implementation is bound to exact base `ca3060459976ee64963f4cd3dfc27b34c62527ab`. `REG_RU_S3_2026` remains `CANDIDATE_NOT_ACTIVE`.

Safety properties:

- no GitHub workflow or unattended execution;
- no repository secret registration;
- no bucket creation, deletion, policy mutation, versioning change or Object Lock change;
- credentials are read from a TTY with echo disabled;
- the report inode is privately reserved before credentials;
- exact policy is validated before the first successful write;
- exact owner confirmation is required before mutation;
- TLS verification cannot be disabled;
- only one 9,437,184-byte object may remain locked;
- the multipart part must be aborted and retain zero bytes;
- raw policy and credentials are deleted with the private temporary directory.

Success is narrowly named `VERIFIED_REG_RU_S3_PANEL_COMPATIBILITY`. It is not bundle-storage acceptance and does not authorize finalization.

---

## 8. Separate activation boundary

After a sanitized report is reviewed, a separate exact-scope change must:

1. register `REG_RU_S3_2026` in the active provider registry;
2. switch active requirements to the verified endpoint, region, bucket, prefix and capacity;
3. carry trusted CA and checksum settings into runner and model-host execution;
4. update active known-object privacy and multipart evidence producers;
5. update finalization authority and transitive exact pins;
6. register protected values only after reviewed exact-main acceptance.

Until then:

- `github_secret_registration_allowed=false`;
- `finalization_allowed=false`;
- bundle upload and clean restore remain `NOT_RUN`;
- benchmark remains `NOT_RUN`;
- model admission remains `NOT_DONE`;
- production remains `NOT_ATTESTED`;
- do not run `/tai finalize model-bundles exact-main`.
