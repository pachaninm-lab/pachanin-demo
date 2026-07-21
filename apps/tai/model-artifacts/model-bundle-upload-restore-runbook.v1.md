# TAI immutable model-bundle upload and clean restore

Authority: `model-bundle-upload-restore-authority.v1.json`  
Issue: `#2961`  
Owner command: `/tai finalize model-bundles exact-main`

## Purpose

Finalize the already completed governed conversion run `29810648430-1` into two independently restorable `tai.local-model-artifact-bundle.v2` records:

- `Qwen/Qwen3-8B@895c8d171bc03c30e113cd7a28c02494b5e068b7`;
- `mistralai/Mistral-7B-Instruct-v0.3@c170c708c41dac9275d15a8fff4eca08d52bab71`.

No source weights, GGUF, payload archive or credential value enters Git or a GitHub Actions artifact. Benchmark, model admission and runtime activation are outside this authority. Operational status remains `NOT_ATTESTED`.

## Preconditions

The command is accepted only when all conditions hold:

1. The trigger is an owner-authored comment in issue `#2961` on the exact current `main`.
2. Exact-main `TAI Release Acceptance` is successful.
3. The committed finalization authority is valid and still binds conversion run `29810648430-1`.
4. The bounded conversion artifact has the accepted API digest and its report binds five completed outputs with exact SHA-256 and sizes.
5. The exact source-metadata artifacts are unexpired and match their accepted API digests.
6. Human legal decisions remain `APPROVED` for both exact revisions.
7. The Selectel S3 read-only preflight returns `READY_FOR_BUNDLE_UPLOAD` with versioning, Object Lock, `COMPLIANCE` retention of at least 90 days, private access and global delete denial on the governed prefix.
8. Dedicated key-only model-host and `TAI_BUNDLE_S3_*` credentials are present. Production host credentials and password SSH are forbidden.

Any absent or inconsistent precondition produces `FAILED_CLOSED` before accepted bundle evidence is claimed.

## Execution

For each model, one at a time:

1. Assemble an original payload root using hard links to the immutable completed conversion run. No model byte is copied merely to build the bundle root.
2. Reconstruct exact remote-inventory, legal, toolchain, conversion and quantization evidence.
3. Produce a canonical payload index containing every payload file path, size and SHA-256. Storage sidecars and the archive itself are excluded from the payload index.
4. Generate a deterministic POSIX tar stream twice from the same exact payload list:
   - first pass calculates archive SHA-256 and size;
   - second pass performs multipart upload.
5. The multipart transport hashes the second stream before `CompleteMultipartUpload`. Any drift from the first SHA-256 or size aborts the incomplete multipart upload; no mismatched immutable object is accepted.
6. Store the object under a content-addressed key ending in `sha256/<archive-sha256>/bundle.tar`.
7. Require a non-empty `VersionId`, exact object size, `COMPLIANCE` Object Lock and a retention horizon of at least 90 days.
8. Download that exact `VersionId` as a stream into a new empty restore root. Reject path traversal, links, non-regular files, duplicates, unexpected members, missing members, size drift or digest drift.
9. Require the streamed archive SHA-256 and size to match the accepted first-pass values.
10. Write bounded upload and restore sidecars, then run `tai.model_bundle_storage_cli`. Acceptance requires `VERIFIED` and `reasons=[]`.
11. Remove temporary original/restore/transport roots. Accepted S3 objects and versions are never deleted.

## Evidence returned to GitHub

Only bounded metadata is returned:

- exact model identity and revision;
- payload-index digest;
- archive SHA-256 and size;
- endpoint host, region, bucket and object key;
- `VersionId` and ETag;
- retention expiry;
- immutable locator containing both `VersionId` and archive SHA-256;
- stream-extraction and storage-verification reports;
- finalization report and evidence manifest.

Each evidence file is limited to 10 MB and the aggregate bounded archive to 50 MB. Credential values, model bytes, source weights, GGUF and payload archives are prohibited.

## Expected blocked state before Selectel credentials

Until the Selectel project, dedicated service user, S3 key and repository secrets exist, the workflow must stop `FAILED_CLOSED`. It must not create a bucket, upload an object, claim a restore or raise maturity.

Required repository secrets:

- `TAI_BUNDLE_S3_ENDPOINT`
- `TAI_BUNDLE_S3_REGION`
- `TAI_BUNDLE_S3_BUCKET`
- `TAI_BUNDLE_S3_ACCESS_KEY_ID`
- `TAI_BUNDLE_S3_SECRET_ACCESS_KEY`
- `TAI_BUNDLE_S3_PREFIX`
- `TAI_BUNDLE_S3_CAPACITY_BYTES`
- `TAI_BUNDLE_S3_PRINCIPAL_ID`

The values must not be pasted into issues, pull requests, source files, logs or chat.

## Success boundary

A successful run means only:

- both immutable objects exist under exact version-bound locators;
- both clean restores were independently rehashed and verifier-accepted;
- bundle finalization status is `VERIFIED_BUNDLES_RESTORED`.

It does not mean benchmark completion, model admission, deployment, production readiness or operational attestation.
