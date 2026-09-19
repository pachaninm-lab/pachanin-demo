# TAI AP-13B.3i — REG.RU S3 panel compatibility probe

## Boundary

This package verifies the exact REG.RU panel policy already configured for:

- bucket `tai-model-bundles-prod-01`;
- governed prefix `tai/model-bundles/v1`;
- matching key set `tai-bundle-finalizer-prod-01`;
- nonmatching key set `tai-bundle-control-prod-01`;
- setup/admin key set `owner`.

`REG_RU_S3_2026` remains `CANDIDATE_NOT_ACTIVE`. The probe does not register GitHub secrets, activate a provider profile, finalize or upload model bundles, run a benchmark, admit a model, change Gateway routing, deploy, or attest production readiness.

The previous provider-issued principal-attestation design is superseded. REG.RU binds panel rules directly to a selected key set. Principal discrimination is therefore proved behaviorally with three distinct credential pairs: admin, matching finalizer, and nonmatching control. The raw bucket policy is read only by admin, validated locally for the exact five panel-rule semantics, hashed, and discarded.

## Exact panel rules

Before execution, the bucket must contain exactly these effective target rules:

1. `TAI-01-bucket-metadata`: allow `GetBucketLocation`, `GetBucketVersioning` on the bucket.
2. `TAI-02-prefix-listing`: allow `ListBucket`, `ListBucketVersions` on the bucket with `s3:prefix StringLike` values `tai/model-bundles/v1` and `tai/model-bundles/v1/*`.
3. `TAI-03-multipart-listing`: allow `ListBucketMultipartUploads` on the bucket without a prefix condition.
4. `TAI-04-object-data-plane`: allow `AbortMultipartUpload`, `GetObject`, `GetObjectVersion`, `ListMultipartUploadParts`, `PutObject` on `tai-model-bundles-prod-01/tai/model-bundles/v1/*`.
5. `TAI-05-delete-deny`: deny `DeleteObject`, `DeleteObjectVersion` on the same governed object scope.

The control key set must not be attached to any bucket rule. `GetBucketObjectLockConfiguration`, `GetBucketPolicy`, and `GetObjectRetention` are admin-only observations because the REG.RU panel does not expose the first and third actions for the finalizer rule set. `TAI-01` must not include `GetBucketPolicy` when the live probe is run.

## Before execution

Use AWS CLI v2, Python 3.12+, `curl`, `sha256sum`, trusted system CA certificates, and three local credential pairs. Never put credential values in arguments, environment files, issues, pull requests, Git, chat, or screenshots. The script reads all six values from an interactive TTY with echo disabled.

Run only from the repository root. Create a private output directory first:

```bash
install -d -m 700 "$HOME/.local/state/tai-reg-ru"
```

Then run:

```bash
bash apps/tai/model-artifacts/reg-ru-s3-compatibility-probe.v1.sh \
  --authority apps/tai/model-artifacts/reg-ru-s3-compatibility-authority.v1.json \
  --output "$HOME/.local/state/tai-reg-ru/reg-ru-panel-compatibility-report.json"
```

The report path must be absolute, must not already exist, and must have an existing canonical `0700` parent directory owned by the current user. The probe reserves the report as a single-link `0600` regular file before credentials are requested.

Immediately before the first successful S3 write, the probe requires this exact phrase:

```text
I AUTHORIZE REG.RU S3 PANEL COMPATIBILITY PROBE tai-model-bundles-prod-01/tai/model-bundles/v1 MAX_LOCKED_BYTES=9437184
```

Do not use `--no-verify-ssl`. The probe fixes the CA bundle to `/etc/ssl/certs/ca-certificates.crt`, disables EC2 metadata lookup, disables the AWS pager, and fixes both AWS checksum modes to `when_required`.

## What the probe proves

Before mutation it validates the committed authority, reads and validates the exact panel policy, proves the finalizer can perform the required bucket/prefix reads, proves the control key is denied, and proves the finalizer cannot read or mutate the bucket policy, versioning, Object Lock, lifecycle, or retention controls.

After explicit confirmation it:

- creates, lists, uploads one 5 MiB part, lists parts, aborts, and proves multipart disappearance;
- streams one 9 MiB object into the governed prefix;
- verifies a version ID and a COMPLIANCE deadline between 89 and 91 days;
- proves the finalizer cannot read or write object retention;
- proves finalizer versionless and exact-version deletion are denied;
- independently proves admin exact-version deletion is rejected by COMPLIANCE Object Lock;
- restores the exact object version and verifies SHA-256;
- proves the nonmatching control key cannot read the known object;
- proves anonymous list and known-object GET are rejected over HTTPS and insecure HTTP.

A successful run intentionally retains one 9,437,184-byte object under 90-day COMPLIANCE retention. The aborted multipart upload must retain zero bytes. Do not rerun casually.

## Result

Only the sanitized report persists. It contains hashes and bounded observations, not raw policy or credential values. Success is `VERIFIED_REG_RU_S3_PANEL_COMPATIBILITY` and still means:

- `github_secret_registration_allowed=false`;
- `finalization_allowed=false`;
- bundle upload and clean restore remain `NOT_RUN`;
- benchmark remains `NOT_RUN`;
- model admission remains `NOT_DONE`;
- production remains `NOT_ATTESTED`.

Activation requires a separate reviewed PR that registers the verified provider profile, switches the active requirements, updates the finalizer authority and its transitive exact pins, and passes exact-main gates. Do not run `/tai finalize model-bundles exact-main` from this package.
