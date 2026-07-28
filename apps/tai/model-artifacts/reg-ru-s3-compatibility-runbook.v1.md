# TAI AP-13B.3i — dormant REG.RU S3 compatibility probe

## Boundary

This package is a local, interactive compatibility experiment for exact base
`8655c70900bc087875ce64e7b7f65775ee838b93`. `REG_RU_S3_2026` remains
`CANDIDATE_NOT_ACTIVE`. It does not add a workflow, register GitHub secrets, switch the active
preflight profile, finalize model bundles, benchmark, admit, activate or deploy a model.

The committed principal state is `UNRESOLVED`. Do not run the probe until REG.RU support or a
REG.RU API has supplied both policy-principal selectors and an exact permission statement for:

- the dedicated `tai-bundle-finalizer-prod-01` key set;
- a distinct nonmatching control principal;
- the exact bucket `tai-model-bundles-prod-01` and prefix `tai/model-bundles/v1`;
- the exact allow and forbidden action lists in the authority.

`owner`, the key-set name, an Access Key ID and the bucket-owner canonical ID are not acceptable
substitutes. The local attestation and its referenced provider-evidence JSON must be absolute,
regular `0600` files, contain no credentials, and match the authority byte-for-byte at every
target and action boundary.

## Before execution

Use AWS CLI v2, Python 3.12+, `curl`, trusted system CA certificates and two local credential
pairs: setup/admin and the dedicated finalizer. Never put either pair in an argument, environment
file, issue, pull request, GitHub secret or chat. The script reads all four values from a TTY with
echo disabled.

The probe refuses to reach credential input until the provider attestation validates. Immediately
before its first S3 write it requires this exact phrase:

```text
I AUTHORIZE REG.RU S3 COMPATIBILITY PROBE tai-model-bundles-prod-01/tai/model-bundles/v1 MAX_LOCKED_BYTES=9441280
```

Run only from the repository root:

```bash
bash apps/tai/model-artifacts/reg-ru-s3-compatibility-probe.v1.sh \
  --authority apps/tai/model-artifacts/reg-ru-s3-compatibility-authority.v1.json \
  --attestation /absolute/private/path/reg-ru-principal-attestation.json \
  --output /absolute/private/path/reg-ru-compatibility-report.json
```

Never add `--no-verify-ssl`. The script fixes both CA variables to
`/etc/ssl/certs/ca-certificates.crt` and both AWS checksum modes to `when_required`.
The report path must be absolute, must not already exist, and must have a canonical, existing
`0700` parent directory owned by the current user. Before credential input, the CLI atomically
reserves the exact report inode as an empty `0600` regular file. Final evaluation reopens only
that single-link reservation with `O_NOFOLLOW`; it never follows an output symlink or changes
parent-directory permissions.

## Bounded mutations and proofs

The script preserves unrelated policy statements and rolls the original policy back after any
failure. A successful run leaves the exact finalizer allow statements, a global delete deny on
the governed prefix, and a global insecure-transport deny. It proves that the selected principal
matches the finalizer but not setup/admin, and that a provider-attested nonmatching selector does
not match it.

Safe same-value calls prove the finalizer cannot mutate bucket policy, versioning, Object Lock or
object retention. If lifecycle configuration exists, its byte-equivalent put must also be denied;
if absent, lifecycle denial remains explicitly provider-attested. The provider evidence must deny
all five mutation classes even when the behavioral lifecycle probe is not applicable.
Only an S3 authorization-denial response counts as a denial; TLS, DNS, timeout, CLI, or provider
5xx failures stop the probe and never become permission or WORM evidence.

The data-plane sequence proves HTTPS and insecure-HTTP known-object anonymous GET denial,
independent COMPLIANCE WORM enforcement, global versionless-delete denial,
create/list/upload-part/list-parts/abort multipart support and exact-version SHA-256 restore.
Both retained versions must read back a COMPLIANCE deadline between 89 and 91 days from probe
time. A failed cleanup abort is a dominant failed-closed result rather than a successful cleanup.
The probe intentionally retains:

- one 9,437,184-byte governed stream object;
- one 4,096-byte WORM canary outside the governed prefix.

Maximum retained locked bytes are therefore **9,441,280** for one run and cannot be removed until
the 90-day COMPLIANCE retention expires. Do not rerun casually. The aborted 5 MiB multipart part
must retain zero bytes.

## Result

Only the sanitized report path persists. It is at most 1 MiB and contains hashes rather than
principal values or raw provider output. Success means only
`VERIFIED_REG_RU_S3_COMPATIBILITY`; `github_secret_registration_allowed=false`,
`finalization_allowed=false`, bundle upload/restore and benchmark remain `NOT_RUN`, admission
remains `NOT_DONE`, and production remains `NOT_ATTESTED`.

Activation requires a separate reviewed PR that registers the provider profile, switches active
requirements, updates the finalizer and its transitive CPU authority pin, and passes exact-main
gates. Do not run `/tai finalize model-bundles exact-main` from this package.
