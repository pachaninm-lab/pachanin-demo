# TAI AP-13B.3j/3k — REG.RU S3 compatibility verifier v2

## Boundary

This verifier is the replacement for the defective AWS CLI 2.36.9 probe. It uses `boto3` and `botocore` directly and classifies authorization denials only from `botocore.exceptions.ClientError`, `Error.Code`, and `ResponseMetadata.HTTPStatusCode`.

The target is fixed:

- endpoint: `https://s3.regru.cloud`;
- SigV4 signing region: `us-east-1`;
- bucket: `tai-model-bundles-prod-01`;
- governed prefix: `tai/model-bundles/v1`;
- finalizer key set: `tai-bundle-finalizer-prod-01`;
- control key set: `tai-bundle-control-prod-01`;
- admin key set: `owner`.

`REG_RU_S3_2026` remains `CANDIDATE_NOT_ACTIVE`. A successful verifier report does not authorize finalization, model-bundle upload, clean restore, benchmark, model admission, deployment, production attestation, GitHub secret registration, or an active provider-profile switch.

## REG.RU bucket-location semantics

REG.RU documentation instructs clients to leave the region at its default or empty value, or to determine the bucket region automatically. Therefore the value returned by `GetBucketLocation` is provider metadata and is not required to equal the technical SigV4 signing region `us-east-1`.

The verifier:

- keeps the signing region pinned to `us-east-1`;
- accepts an absent or empty `LocationConstraint`;
- accepts a bounded provider region token containing only letters, digits, `.`, `_`, `:`, or `-`;
- records the provider value as a sanitized observation;
- fails closed on non-string, control-character, whitespace-bearing, oversized, or otherwise malformed values.

The AP-13B.3k adapter changes only this provider-specific interpretation. All v2 authority, policy, authorization, Object Lock, multipart, restore, WORM, sanitation, credential and mutation boundaries remain unchanged.

## Exact authority

The verifier requires the committed authority at:

`apps/tai/model-artifacts/reg-ru-s3-compatibility-authority.v2.json`

It fails closed unless the authority contains the exact seven configured REG.RU panel rules:

1. `TAI-01-bucket-metadata` — finalizer allow for `GetBucketLocation`, `GetBucketVersioning`.
2. `TAI-02-prefix-listing` — finalizer allow for governed-prefix `ListBucket`, `ListBucketVersions`.
3. `TAI-03-multipart-listing` — finalizer allow for `ListBucketMultipartUploads`.
4. `TAI-04-object-data-plane` — finalizer allow for governed object read, put, multipart-parts list, and abort.
5. `TAI-05-delete-deny` — finalizer explicit deny for object and version deletion.
6. `TAI-06-control-bucket-deny` — control explicit deny for bucket, version, and multipart listing.
7. `TAI-07-control-object-deny` — control explicit deny for put, get, version get, multipart-parts list, abort, and deletion.

The admin reads the live bucket policy once. The verifier validates the exact seven target-rule semantics locally, retains only its SHA-256, and never retains the raw policy.

## Dependency and credential handling

Run from the repository root in an interactive terminal.

The wrapper performs all local checks before requesting credentials. It uses system `boto3==1.43.18` and `botocore==1.43.18` when already present; otherwise it installs those exact versions into an ephemeral private environment that is deleted when the process exits. AWS CLI is not invoked.

The verifier then prompts exactly once for six hidden values:

- admin Access Key ID and Secret Access Key;
- finalizer Access Key ID and Secret Access Key;
- control Access Key ID and Secret Access Key.

Do not paste credentials into the command, environment files, Git, GitHub, chat, screenshots, shell history, or the report. The three Access Key IDs must be distinct.

## Single final command

Use only the command published after the AP-13B.3k PR is merged and the checked-out repository contains the accepted exact files. Do not reuse a command containing the pre-3k wrapper hash.

The report path must be unique, absolute, private, and must not already exist. The verifier reserves it as a single-link `0600` file before credential input.

## Mutation confirmation

All dependency checks, authority validation, output reservation, admin readback, finalizer read checks, and read-only deny checks occur before the mutation phase.

Immediately before any operation that could successfully mutate S3, the verifier requires this exact phrase:

```text
I AUTHORIZE REG.RU S3 PANEL COMPATIBILITY PROBE tai-model-bundles-prod-01/tai/model-bundles/v1 MAX_LOCKED_BYTES=9437184
```

Any mismatch stops the run without the governed data-plane mutation phase.

## What the verifier proves

Before mutation it proves:

- the endpoint, signing region, bucket, prefix, capacity statement, authority, and seven panel rules are exact;
- the REG.RU bucket-location response is syntactically safe and recorded without conflation with the signing region;
- versioning is enabled;
- Object Lock is enabled;
- default retention is `COMPLIANCE` for 90 days;
- the finalizer can read required bucket metadata and governed-prefix listings;
- the control key is denied bucket, version, and multipart listings;
- the finalizer is denied live bucket-policy read;
- control bucket metadata visibility, if present, is recorded but is not treated as object or listing authority.

After exact confirmation it proves:

- finalizer control-plane PUT operations are denied using semantic no-op payloads only;
- the control key cannot create a multipart upload;
- the finalizer can create and list one multipart upload, upload one 5 MiB part, list parts, and abort it;
- the control key cannot list parts or abort the finalizer multipart upload;
- the aborted multipart upload retains zero bytes;
- exactly one deterministic 9,437,184-byte stream object is uploaded, or the exact single object from an interrupted earlier v2 run is resumed;
- no second stream version or delete marker exists;
- the exact version has a `COMPLIANCE` deadline between 89 and 91 days;
- the finalizer cannot read or change object retention;
- finalizer versionless and exact-version deletion are denied;
- admin exact-version deletion is rejected by COMPLIANCE Object Lock;
- the exact version restores through the finalizer and matches the deterministic source SHA-256;
- the restored version remains current;
- the control key cannot read the known object;
- the control key cannot put the known object; `If-None-Match: *` prevents mutation even if the deny were absent;
- unsigned anonymous list and known-object GET are rejected;
- successful retained mutation is bounded to one 9,437,184-byte object, with one fully aborted multipart upload.

A cleanup trap aborts any open multipart upload and removes an unexpected delete marker when possible. Cleanup failure is fail-closed.

## Result

Success is:

`VERIFIED_REG_RU_S3_PANEL_COMPATIBILITY_V2`

The bounded report contains only sanitized observations, denial code/status classifications, hashes, SDK versions, and candidate-state fields. It does not contain credentials, raw bucket policy, raw request IDs, or a raw version ID.

Even on success the report must state:

- `profile_state=CANDIDATE_NOT_ACTIVE`;
- `github_secret_registration_allowed=false`;
- `finalization_allowed=false`;
- `bundle_upload_status=NOT_RUN`;
- `bundle_restore_status=NOT_RUN`;
- `benchmark_status=NOT_RUN`;
- `model_admission_status=NOT_DONE`;
- `production_operational_status=NOT_ATTESTED`.

Do not run `/tai finalize model-bundles exact-main` from this verifier package. Activation and finalization require separate reviewed authority changes after the sanitized report is accepted.
