# TAI AP-13B.3l/3m — REG.RU S3 compatibility verifier v3

## Why v3 exists

The first accepted v2 run stopped before mutation with:

`FAILED_CLOSED:DENIAL_EXPECTED_BUT_ALLOWED:FINALIZER_GET_BUCKET_POLICY`

This is a real least-privilege defect, not a boto3 parsing problem. The finalizer key could read the bucket policy even though the original seven-rule authority did not explicitly allow it.

The REG.Cloud panel exposes `GetBucketPolicy` and the associated bucket-policy, lifecycle and versioning controls, so v3 requires one explicit finalizer deny rule for the exact actions available in the provider action selector.

The panel does not expose Object Lock configuration or object-retention policy actions. Those operations are therefore not replaced with broader categories and are not omitted from security acceptance: the verifier tests their denial behaviorally through boto3/botocore.

The failed v2 attempt occurred before the mutation confirmation. No multipart upload, retained object, object version or Object Lock retention was created.

## Unchanged target and safety boundary

- endpoint: `https://s3.regru.cloud`;
- SigV4 signing region: `us-east-1`;
- bucket: `tai-model-bundles-prod-01`;
- governed prefix: `tai/model-bundles/v1`;
- finalizer key set: `tai-bundle-finalizer-prod-01`;
- control key set: `tai-bundle-control-prod-01`;
- admin key set: `owner`;
- `REG_RU_S3_2026`: `CANDIDATE_NOT_ACTIVE`;
- GitHub secret registration: forbidden;
- finalization, bundle upload, clean restore, benchmark, admission, deployment and production attestation: forbidden.

AWS CLI is not used. Credentials are requested once, hidden, only after local checks and exact authority validation.

## Exact eight-rule authority

Rules 1–7 remain unchanged:

1. `TAI-01-bucket-metadata`;
2. `TAI-02-prefix-listing`;
3. `TAI-03-multipart-listing`;
4. `TAI-04-object-data-plane`;
5. `TAI-05-delete-deny`;
6. `TAI-06-control-bucket-deny`;
7. `TAI-07-control-object-deny`.

The only additional panel rule is:

### TAI-08-finalizer-bucket-control-deny

- type/effect: `Deny`;
- key set: `tai-bundle-finalizer-prod-01`;
- scope/resource: bucket `tai-model-bundles-prod-01`;
- condition: none;
- actions, exactly six:
  - `DeleteBucketPolicy`;
  - `GetBucketPolicy`;
  - `GetLifecycleConfiguration`;
  - `PutBucketPolicy`;
  - `PutBucketVersioning`;
  - `PutLifecycleConfiguration`.

Do not add `GetBucketLocation`, `GetBucketVersioning`, any `GetObject*` action or a broad category such as “All actions”.

Do not create `TAI-09`. The following operations are absent from the REG.Cloud policy selector and remain behavioral verifier assertions instead of panel-rule requirements:

- `GetBucketObjectLockConfiguration`;
- `PutBucketObjectLockConfiguration`;
- `BypassGovernanceRetention`;
- `GetObjectRetention`;
- `PutObjectRetention`.

The committed authority is:

`apps/tai/model-artifacts/reg-ru-s3-compatibility-authority.v3.json`

The verifier reads back the live policy and requires exactly eight target statements matching the source-controlled semantics. Any missing, additional or broadened target rule fails closed before mutation.

## Read-only phase

Before the confirmation phrase, v3 verifies:

- the exact target, eight policy rules and policy SHA-256;
- REG.RU bucket-location syntax without conflating it with the signing region;
- versioning, Object Lock and default `COMPLIANCE` 90-day retention;
- required finalizer allow operations;
- control-key explicit denials;
- finalizer denial for `GetBucketPolicy`;
- existing v3 probe-object bounds;
- output-path ownership, mode and single-link reservation.

## Mutation phase

Only after all read-only checks pass, the verifier requires the exact confirmation phrase and proves:

- finalizer bucket-policy, versioning and lifecycle mutations are denied by the explicit panel rule;
- finalizer Object Lock configuration mutation is denied behaviorally;
- finalizer object-retention read and mutation are denied behaviorally;
- control multipart creation/list-parts/abort is denied;
- finalizer multipart create/list/upload-part/list-parts/abort succeeds and retains zero bytes;
- exactly one deterministic 9,437,184-byte v3 object is uploaded or resumed;
- COMPLIANCE retention is 89–91 days;
- finalizer and admin deletion attempts are rejected;
- exact-version restore SHA-256 matches;
- control and anonymous object access is rejected.

The retained report excludes credentials, raw policy, request IDs and raw version IDs.

## Result

Success is:

`VERIFIED_REG_RU_S3_PANEL_COMPATIBILITY_V3`

Even on success:

- `profile_state=CANDIDATE_NOT_ACTIVE`;
- `github_secret_registration_allowed=false`;
- `finalization_allowed=false`;
- `bundle_upload_status=NOT_RUN`;
- `bundle_restore_status=NOT_RUN`;
- `benchmark_status=NOT_RUN`;
- `model_admission_status=NOT_DONE`;
- `production_operational_status=NOT_ATTESTED`.

Do not run v2 again. Do not run v3 until the AP-13B.3m correction PR is merged and a new exact-main command is published.
