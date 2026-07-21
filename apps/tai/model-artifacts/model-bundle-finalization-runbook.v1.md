# TAI AP-13B.3h — immutable model-bundle finalization

## Status boundary

This authority finalizes the already completed governed conversion run into two independently restorable immutable model bundles. It does not benchmark, admit, activate or deploy a model. `production_operational_status` remains `NOT_ATTESTED`.

## Exact input

- conversion exact-main: `8bd494dc4954baaf699cffa243951392ff451ebb`;
- conversion workflow run: `29810648430`, attempt `1`;
- conversion root: `/srv/tai-models/conversion-runs/8bd494dc4954baaf699cffa243951392ff451ebb/29810648430-1`;
- required conversion state: `COMPLETE`;
- required conversion result: `CONVERSION_AND_QUANTIZATION_COMPLETE_PENDING_BUNDLE_RESTORE`;
- models: exact Qwen3-8B and Mistral-7B-Instruct-v0.3 revisions already accepted by human legal review.

The finalization workflow must not download sources, rerun conversion or rerun quantization.

## Protected inputs

Store values only as GitHub repository secrets:

- `TAI_MODEL_HOST`
- `TAI_MODEL_SSH_USER` — must be `tai-model`
- `TAI_MODEL_SSH_PORT`
- `TAI_MODEL_SSH_KEY`
- `TAI_BUNDLE_S3_ENDPOINT`
- `TAI_BUNDLE_S3_REGION`
- `TAI_BUNDLE_S3_BUCKET`
- `TAI_BUNDLE_S3_ACCESS_KEY_ID`
- `TAI_BUNDLE_S3_SECRET_ACCESS_KEY`
- `TAI_BUNDLE_S3_PREFIX` — recommended `tai/model-bundles/v1`
- `TAI_BUNDLE_S3_CAPACITY_BYTES` — recommended `200000000000`
- `TAI_BUNDLE_S3_PRINCIPAL_ID`

Never place credential values in Git, issue comments, pull requests, logs or chat.

## Preflight

Before any S3 mutation, the workflow must prove:

1. all protected inputs exist;
2. exact-main TAI Release Acceptance is accepted;
3. the external endpoint is HTTPS and non-local;
4. bucket versioning is `Enabled`;
5. Object Lock is `Enabled`;
6. default retention is `COMPLIANCE` for 90 days;
7. anonymous bucket listing is denied;
8. deletion of objects and versions is denied under the governed prefix;
9. confirmed external capacity is at least 120 GB.

A failed or missing condition results in `FAILED_CLOSED` before archive upload.

## Execution

Owner command in issue `#2961`:

```text
/tai finalize model-bundles exact-main
```

For each model, one at a time, the workflow:

1. assembles an original payload root using hard links on the dedicated model filesystem, avoiding duplication of multi-gigabyte files;
2. binds exact source, human legal, accepted llama.cpp, conversion and quantization evidence;
3. creates a canonical payload index that excludes itself and all post-seal storage records;
4. produces a deterministic tar stream once to measure SHA-256 and byte length, retaining no local archive;
5. derives the S3 key from the measured archive SHA-256;
6. produces the same deterministic stream a second time directly into multipart S3 upload;
7. records exact `VersionId`, ETag, content length and COMPLIANCE retention;
8. downloads that exact object version through a FIFO into a clean extractor, retaining no downloaded archive file;
9. rejects path traversal, links, duplicate members, undeclared members, size drift and SHA-256 drift;
10. verifies the clean restore against the original payload and exact authority;
11. saves only bounded metadata evidence, then removes temporary hard links and restored bytes.

Accepted S3 objects and versions are never deleted by this workflow.

## Expected result

Both bundles must report:

- external verification: `VERIFIED`;
- immutable content-addressed locator with exact `VersionId`;
- archive SHA-256 and byte length matched on upload and restore;
- Object Lock mode: `COMPLIANCE`;
- local bundle archive retained: `false`;
- benchmark: `NOT_RUN`;
- model admission: `NOT_DONE`;
- production operational status: `NOT_ATTESTED`.

The bounded workflow artifact is not model storage. It contains metadata and verification records only.

## Subsequent acceptance

After a real successful run:

1. create a separate acceptance PR containing only bounded locator and verification metadata;
2. verify exact-head and exact-main gates;
3. close `#2954` and `#2961` only after both model acceptance records are merged;
4. proceed to AP-13C benchmark authority without claiming admission or production readiness.
