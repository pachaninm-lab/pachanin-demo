# Bounded API-only image release

Status: source prerequisite for a controlled pilot. This controller does not close registration, Founder13, BANK, FGIS, business acceptance or disaster recovery. Main/CI/image publication alone is not a server release.

The sole runtime entry is an unedited repository OWNER comment on issue #4637:

    /production api-only-release current-main

A new accepted whole-six source admission and trusted exact-byte guard are prerequisites. The workflow verifies the accepted compact purpose pc-api-only-20261101, its exact concurrent vector and the six hashes embedded as JSON data in the accepted current-main guard. PRs execute public contract checks; they cannot reach protected transport. A rerun is not a new operational grant. The PR-safe native oracle builds disposable exact-head images locally; these references cannot be used for a production release.

## Execution and evidence

1. Build the canonical exact-main API and migration artifacts through the existing docker-publish.yml authority. Resolve mandatory immutable digests and OCI revisions on the runner. The migration artifact runs only in the isolated CI oracle; this controller never installs a migration service or executes migrations on production.
2. Generate a fresh target contract on operation-owned, isolated PostgreSQL. Bootstrap the existing restricted principals, apply the complete target migration chain and canonical policy/grant files, and query the actual target API image through its default Prisma and installed AuthPrisma constructors. Capture schema-qualified catalog, normalized ownership/ACLs, routine/schema/sequence authority, migration lineage and effective principal settings. Real adverse cases must detect wrong database, RLS drift, bypass privilege and function grant drift. References are same-run protected job outputs, never caller-selected hashes.
3. Require a separate finite OWNER disposition on Team Hub #5469, an exact unchanged main, DNS matching the protected server, a valid protected SSH identity and exactly one matching pinned host key. No pin replacement, alternate account, payment, provider order or automatic retry occurs.
4. Read the actual single API image metadata. When a canonical immutable RepoDigest is present, resolve that exact reference on the authenticated runner and require its image ID, OCI revision and source to match the observed server image. An ambiguous or mismatched registry reference stops the operation. For the previously verified legacy image without a canonical RepoDigest, export by exact ID through the pinned SSH transport. Load the private, bounded archive on the disposable runner in an isolated containerd store and verify the original ID, revision, image layers and image defaults. Require a single imported image with no named tag. Bind the archive SHA-256 and byte count, or the registry proof, to AP1 real-Git source equality, exact migration checksums and unchanged constructor source. The GitHub RS256 OIDC token authenticates the entire intent for this exact main workflow, run and actor.
5. Hold the existing protected backup-root operation lock. Explicitly fence older controllers using other locks. Verify the effective Compose model, all original nineteen volumes, stopped and running sibling identities, retained ciphertexts and existing key/journal metadata. The fixed canonical public home /platform-v7 must pass before any preparation mutation. Read-only preflight creates no journal, backup, image, override or container.
6. Reserve a durable exclusive one-use journal and recovery baseline before any preparation write. For an archive-backed baseline, send the exact rehearsed bytes in the authenticated release transport and retain them in the root-only journal after verifying size and SHA-256. A failed or incomplete archive transfer stops before backup, target image pull or API mutation. Run the accepted isolated logical restore drill, verify cleanup, check capacity again and pull only the immutable target digest. Arm rollback before writing the API-only override and recreate only `api` with `--no-deps --pull never`. Verify actual image ID/revision, readiness including any declared Docker health policy, effective configuration, protected inventory and both live database clients. The canonical public-home DNS/TLS/peer/HTTP/body smoke runs under the same lock before the terminal journal commit. A failure invokes image rollback.
7. On failure after arming, retain the operation lock and recreate from the captured immutable baseline image ID. If that image has disappeared and the release retained an archive, recheck the protected copy's SHA-256 and containerd store before reloading it. Verify the exact image identity again. Restore the original override bytes/mode/owner/group or absence, recreate from the original file list, and verify that the original effective reference still resolves to the same image ID. An original reference that has drifted requires reconciliation. Canonical `/platform-v7` success is mandatory again before rollback is marked verified. This procedure restores the API image only.

The actual client binding/principal scope is default/deal and AuthPrisma. Staff/storage object grants participate in the catalog, while their live datasource and business acceptance remain separate. The protected Compose input profile admits literal block maps/lists/scalars and captured literal env files; nonempty flow collections, anchors, merges and escaped keys fail before Compose. No automatic configuration rewrite occurs. The fresh catalog includes all non-system schemas and database collation/extension profile. A live mismatch is a HOLD. Do not silence a platform, permission, ownership, schema, constructor or lineage difference by copying live hashes into a reference. A separately reviewed compatibility change is required.

## Finite disposition

The Hub comment body begins with PC_API_ONLY_HOST_WINDOW followed by a newline and one JSON object. It identifies OWNER pachaninm-lab, exact target_sha, triggering command operation_id, integer not_before/expires within twenty minutes, actual source_accepted, actual native_accepted, legacy_operations_fenced, and the independently reconciled original_volume_inventory_sha256. After the CI oracle, the workflow waits at most ten minutes for this fresh claim and rechecks the original command for editing or withdrawal. Missing claims wait; ambiguous, edited or malformed matching claims fail. The workflow binds the actual claim comment ID itself. The volume digest is SHA256 of canonical JSON for the sorted original nineteen names; names are not posted in the public claim.

The source-only purpose remains productionInvocationAuthorized=false. It does not replace this finite disposition. An absent, edited, ambiguous, stale or mismatched claim fails before SSH credentials are materialized.

## Failure and rollback interpretation

- HOLD: the API image was not advanced; preparation may have created a durable backup or pulled a verified image after journal reservation.
- ROLLED_BACK_API_IMAGE_ONLY: the prior API image, effective configuration and database contract were verified. No business-data rollback is claimed.
- RECONCILIATION_REQUIRED: rollback or its verification was incomplete. Keep the journal, original copies and credentials/keys protected; do not replay or reset the operation.
- API_IMAGE_RELEASE_VERIFIED: intended API image/container and internal readiness were verified. Canonical public-home success is included under the operation lock; the runner may repeat an advisory observation. This does not prove authenticated business behavior.

The api_image_updated flag means verified release acceptance; false does not prove the previous image remains active. runtime_state explicitly distinguishes verified baseline, verified target and unknown reconciliation. A transport loss, timeout, killed process or missing terminal JSON is UNKNOWN, never success or authorization to repeat. The one-use directory remains. Unknown remote executions retain their private staged source for reconciliation; ephemeral registry tokens expire with their GitHub job. Cleanup removes only a known-complete run's source and credentials.

No archive, database rows, environment, DSN, SSH key, JWT, registry auth or protected Compose path is uploaded as public evidence. The durable recovery baseline is root-only. CI retains only sanitized oracle and terminal release receipts.

## Checks

Run the real-Git source suite and the complete controller suite on the actual frozen head:

    node --test scripts/release/test-api-schema-source-parity.mjs
    sudo env "PATH=$PATH" PYTHONDONTWRITEBYTECODE=1 python3 -B scripts/release/test-api-only-release-controller.py

The controller suite includes actual temporary RSA signing, exact-claim negative cases, real pipe timeout/output controls, protected-file atomic replacement, symlink/hardlink refusal, original override recovery, held-lock rollback, spent-operation refusal and independent image/inventory/database faults. Its engine fakes are not a live release. The actual isolated oracle must also pass with canonical target images before protected deployment; unavailable Docker, absent images or incomplete cleanup is a failure.

After API release, execute separately admitted live registration, mail/MFA, Founder13 and UX/BANK/FGIS acceptance on the canonical domain. Keep the full product block open until those paths have actual evidence.
