# TAI AP-13B.3j — REG.RU S3 compatibility probe v2

## Purpose

This package replaces the repeatedly patched v1 probe. It verifies the seven live REG.RU panel rules with one hidden credential entry per key set and one execution.

The package remains local and candidate-only. It does not register GitHub secrets, activate the provider, finalize model bundles, run benchmarks, admit a model or attest production readiness.

## Live panel contract

Finalizer rules:

1. `TAI-01-bucket-metadata` — allow `GetBucketLocation`, `GetBucketVersioning`.
2. `TAI-02-prefix-listing` — allow `ListBucket`, `ListBucketVersions` for `tai/model-bundles/v1` and `tai/model-bundles/v1/*`.
3. `TAI-03-multipart-listing` — allow `ListBucketMultipartUploads`.
4. `TAI-04-object-data-plane` — allow `AbortMultipartUpload`, `GetObject`, `GetObjectVersion`, `ListMultipartUploadParts`, `PutObject` on the governed prefix.
5. `TAI-05-delete-deny` — deny `DeleteObject`, `DeleteObjectVersion` on the governed prefix.

Control rules:

6. `TAI-06-control-bucket-deny` — deny bucket listing and multipart listing.
7. `TAI-07-control-object-deny` — deny object read, write, delete and multipart object operations.

REG.RU may expose non-sensitive bucket versioning metadata to the control key. Isolation is proved by explicit listing, write and known-object read denial.

## Error handling

AWS CLI 2.36.9 can crash while formatting a legitimate REG.RU `403` response. V2 never treats that formatter crash as evidence by itself. It repeats only the expected-denied request with `--debug`, keeps the raw trace in memory, and accepts the denial only when raw HTTP metadata contains `401`, `403`, `AccessDenied` or `Forbidden`. TLS, connection and 5xx failures remain fail-closed.

Credentials and raw debug traces are never written to the report, Git, issues or chat.

## Execution

Run from a clean exact worktree containing the reviewed v2 files:

```bash
install -d -m 700 "$HOME/.local/state/tai-reg-ru"

bash apps/tai/model-artifacts/reg-ru-s3-compatibility-probe.v2.sh \
  --authority apps/tai/model-artifacts/reg-ru-s3-compatibility-authority.v2.json \
  --output "$HOME/.local/state/tai-reg-ru/reg-ru-panel-compatibility-v2-$(date -u +%Y%m%dT%H%M%SZ).json"
```

The probe asks once for:

- `owner` Access Key ID and Secret Access Key;
- `tai-bundle-finalizer-prod-01` Access Key ID and Secret Access Key;
- `tai-bundle-control-prod-01` Access Key ID and Secret Access Key.

Immediately before the first new data-plane mutation it requires:

```text
I AUTHORIZE REG.RU S3 PANEL COMPATIBILITY PROBE tai-model-bundles-prod-01/tai/model-bundles/v1 MAX_LOCKED_BYTES=9437184
```

A successful fresh run retains exactly one 9 MiB object under 90-day COMPLIANCE retention and aborts the multipart upload. If a prior confirmed run uploaded that exact deterministic stream object but disconnected before report completion, v2 resumes the single object rather than creating a second locked object.

## Success boundary

Success status is `VERIFIED_REG_RU_S3_PANEL_COMPATIBILITY_V2`.

Even after success:

- `github_secret_registration_allowed=false`;
- `finalization_allowed=false`;
- bundle upload and clean restore remain `NOT_RUN`;
- benchmark remains `NOT_RUN`;
- model admission remains `NOT_DONE`;
- production remains `NOT_ATTESTED`.
