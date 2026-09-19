# Selectel S3 provisioning for immutable TAI model bundles

## Purpose

This runbook provisions the external object-storage boundary required by AP-13B.3. It does not upload model bundles and does not change model admission or production readiness.

The accepted provider profile is `SELECTEL_S3_2026`.

## Human account prerequisites

The account owner must complete these actions in the Selectel Control Panel:

1. Maintain a funded Selectel account and a project with S3 available.
2. Create a dedicated service user with project-scoped `s3.admin` while provisioning.
3. Issue a dedicated S3 key for that project.
4. Copy the service-user identifier shown in IAM.
5. Store the following values as GitHub repository secrets:

```text
TAI_BUNDLE_S3_ENDPOINT
TAI_BUNDLE_S3_REGION
TAI_BUNDLE_S3_BUCKET
TAI_BUNDLE_S3_ACCESS_KEY_ID
TAI_BUNDLE_S3_SECRET_ACCESS_KEY
TAI_BUNDLE_S3_PREFIX
TAI_BUNDLE_S3_CAPACITY_BYTES
TAI_BUNDLE_S3_PRINCIPAL_ID
```

Do not paste credential values into issues, pull requests, logs, chat, source files, or workflow inputs.

Recommended non-secret values:

```text
TAI_BUNDLE_S3_PREFIX=tai/model-bundles/v1
TAI_BUNDLE_S3_CAPACITY_BYTES=200000000000
```

The bucket name must be globally unique in the selected pool and contain only lowercase Latin letters, digits, dots, and hyphens.

## Automated provisioning

After the secrets exist, post this owner-only command in issue `#2958`:

```text
/tai provision selectel-bundle-storage exact-main
```

The workflow:

1. verifies the exact checked-out `main`;
2. validates the committed provisioning authority;
3. validates the HTTPS endpoint, bucket, prefix, provider profile, capacity, and service-user identifier;
4. creates the bucket only if it is absent;
5. enables versioning;
6. enables Object Lock;
7. configures default `COMPLIANCE` retention for 90 days;
8. installs a bucket policy that:
   - allows only the declared service-user identifier the required bucket and object actions;
   - denies `DeleteObject` and `DeleteObjectVersion` for every principal under the governed prefix;
   - denies non-TLS access;
9. performs an anonymous bucket-list probe and requires denial;
10. uploads one bounded 4 KiB smoke object under default retention;
11. captures the immutable `VersionId`, downloads that exact version into a clean temporary path, and verifies SHA-256;
12. checks the object retention;
13. leaves the smoke object locked and does not delete it;
14. publishes bounded metadata only.

## Selectel compatibility boundary

The Selectel S3 API supports bucket CRUD, bucket policies, versioning, Object Lock configuration, object versions, and multipart upload.

The Selectel S3 API does not expose Amazon S3 `Public Access Block` or `Bucket Encryption`. The TAI authority therefore:

- proves privacy through Selectel private-by-default behavior plus an unauthenticated list denial;
- does not call unsupported APIs;
- relies on HTTPS for transport security;
- requires Object Lock `COMPLIANCE` and a global deletion deny;
- keeps any later archive-encryption decision separate from provider bucket encryption.

## Fail-closed behavior

Provisioning stops without model upload when:

- a required secret is absent;
- the endpoint is not a safe HTTPS root;
- the bucket or prefix is invalid;
- the confirmed capacity is below 120,000,000,000 bytes;
- bucket creation or any control-plane call fails;
- versioning or Object Lock is not enabled;
- default retention is not `COMPLIANCE` for at least 90 days;
- the installed policy does not contain the exact service-user allow and global deletion deny;
- anonymous listing is not denied;
- the smoke object lacks an immutable version ID;
- clean restore SHA-256 differs;
- retention verification fails.

## Maturity boundary

Successful provisioning means only:

```text
external bundle storage: READY_FOR_BUNDLE_UPLOAD
bundle upload: NOT_RUN
clean restore: NOT_RUN
benchmark: NOT_RUN
model admission: NOT_DONE
production operational status: NOT_ATTESTED
```
