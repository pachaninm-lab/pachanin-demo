# IR-20 isolated backup restore prerequisite

## Scope and decision

Base: `126f4b17f0be87eab07a238dc3ffee35a4b8ed8b`, after PR #5428.
Fresh read-only REG.RU diagnostic run `35397047080` succeeded. The earlier
artifact `10567310099` reported archive catalogue readability, but no successful
restore. Catalogue inspection is not a substitute for executing `pg_restore`.

Disposition: EXTEND_EXISTING operations tooling. The existing
`platform-v7-database-dr-rehearsal.sh` deliberately refuses production and depends
on the synthetic `DEAL-INDUSTRIAL-001` fixture and CI principals. It is preserved.
This executor instead restores an operator-selected source snapshot into an
isolated container without writing to the source database.

No release entry point is added. The new workflow is pull-request-only and uses
synthetic data on a disposable runner. It has no production credentials. Neither
merging this scope nor a green fixture test invokes anything on REG.RU.

## Execution contract

`ir20-restore-drill.sh` takes an exact target SHA, a full source PostgreSQL
container ID and its expected Compose project. These arguments must come from a
protected, reviewed operations controller. Do not paste protected runtime
configuration into issues, chat, or CI logs.

The controller must first bind that PostgreSQL instance/database to the canonical
API, serialize with the existing production release lock, approve read load and
backup handling, and enforce the total operational timeout. This script DOES NOT
establish that canonical binding or grant a new operational approval. Do not invoke
it directly on production based only on this PR's test result.

The executor requires root, a local Unix Docker daemon, a recognized PostgreSQL
16 source image, an already-present exact image ID, a protected backup directory,
at least 2 GiB disk headroom and 2 GiB available RAM. It never pulls an image.
Source database names and principals are read from existing container configuration
and checked against the live local PostgreSQL session. No credentials are replaced.
All source queries run in READ ONLY transactions; exported data and the five
critical-table fingerprints use the same PostgreSQL exported snapshot.
Writes to the snapshot session run in child shells with no inherited EXIT cleanup.
A closed input pipe therefore fails the operation without terminating the parent
before its cleanup. Session loss cannot emit successful restore evidence or leave
raw inspection/row copies through a skipped cleanup path.

A fresh restore instance uses a random name and independent bootstrap role, no
network, no published port, no host bind, a read-only root filesystem, dropped
capabilities, no-new-privileges, a non-root PostgreSQL UID, 1 CPU, 768 MiB memory,
128 PIDs and bounded tmpfs. Source and restore IDs cannot be equal. Only this
owned disposable instance can be removed. A create/cleanup transport ambiguity
is not reported as success. After a successful removal command, a separate
bounded local-daemon inventory must confirm that the validated full target ID is
absent in all container states. Non-empty, malformed or failed inventory prevents
report finalization; a successful delete acknowledgement alone is insufficient.

The roles export omits role passwords. Restore retains ownership and ACLs;
`--no-owner` and `--no-acl` are not used. The complete custom-format database archive
is restored with `--exit-on-error`. Comparisons cover all rows in `deals`,
`audit_events`, `ledger_entries`, `outbox_entries` and `_prisma_migrations`, plus
those tables' owners, effective ACLs, RLS, policies, constraints, triggers and
trigger function definitions. Missing tables, changed source, role drift,
failed restore, fingerprint mismatch or failed cleanup prevent a successful result.

Patched PostgreSQL versions can generate random `\restrict`/`\unrestrict` keys
in successive plain roles exports. Drift comparison removes only a validated,
paired transport marker; role SQL remains unchanged and is used for restoration.

## Evidence and limitations

The sanitized report binds target SHA, source image ID, archive/role digests,
row counts/fingerprints, durations and disposable cleanup. Its classification is
`CRITICAL_STATE_RESTORE_VERIFIED_NOT_RELEASE_ACCEPTANCE`. It explicitly retains
`deployment_authorized=false`, `live_delivery=NOT_PERFORMED`,
`full_dr_acceptance=NOT_PROVEN` and
`source_binding=OPERATOR_SELECTED_NOT_CANONICAL_API_VERIFIED`.

The protected archive and roles SQL remain on the executing host. Temporary
business-row copies, selected environment values and Docker inspections are
removed on success and failure. Only a finalized sanitized report can be uploaded;
never upload the protected backup directory. Backups must be enrolled into the
existing approved encryption, retention and off-host recovery policy before a
production invocation is admitted. This scope does not establish off-site RPO,
object recovery, all-domain application behavior, worker delivery recovery, or
backward-compatible rollback. Physical preservation of irreversible intent is
not inferred from a local archive or a database transaction.

Report publication follows successful `fsync` of the archive, roles, pending
report, run directory and every ancestor directory up to the filesystem root.
Syncing only the run directory does not persist its name in its parent; the
backup hierarchy may itself be newly created. The pending report is then renamed
and its containing directory synchronized again before any success output.
An I/O error keeps the operation failed, attempts removal of both report markers
and preserves the backup files. If marker removal or its synchronization also
fails, cleanup durability is not proven and the operation still cannot succeed.
These barriers depend on the filesystem/storage honoring `fsync`; they do not
establish power-loss, off-host or full disaster-recovery acceptance.

The 64 MiB per-output and 512 MiB restored-data bounds are fail-closed limits for
this narrow rehearsal, not claimed production capacity. Exceeding them requires a
reviewed resource profile, not a larger arbitrary CLI override. Full production
cutover and the required 30-minute live observation remain pending. No IR-21
transition or R0–R12 production points are awarded.

## Checks

Run `sudo /usr/bin/python3 -B scripts/release/test-ir20-restore-drill.py` for the
mocked-Docker rejection matrix. The separate integration script creates only
synthetic data, including UTF-8/newline payloads, ownership, grants, FORCE RLS,
policy and trigger fixtures, then executes the actual restore executor.

The same test command also executes the actual embedded report finalizer with
real temporary files and injected `fsync`/rename errors. It checks ancestor-sync
ordering, failure at each durability barrier, missing archives, report-marker
removal and preservation of backup bytes. These are local fault-injection tests,
not a physical power-loss experiment or independent review.

The PR workflow uses the existing verified
`.github/container-images/postgres-16.v1.json` image authority, not Docker Hub
fallback or a new dependency. GitHub CI must execute the real PostgreSQL fixture;
local mocked-Docker success is not a PostgreSQL result or independent review.

Primary contracts consulted: PostgreSQL 16 `pg_dump`, `pg_dumpall`, `pg_restore`
and exported snapshots; Docker Engine resource/runtime isolation options.

- https://www.postgresql.org/docs/16/app-pgdump.html
- https://www.postgresql.org/docs/16/app-pg-dumpall.html
- https://www.postgresql.org/docs/16/app-pgrestore.html
- https://www.postgresql.org/docs/16/functions-admin.html#FUNCTIONS-SNAPSHOT-SYNCHRONIZATION
- https://docs.docker.com/reference/cli/docker/container/create/
- https://docs.docker.com/reference/cli/docker/container/ls/
- https://www.gnu.org/software/bash/manual/html_node/Signals.html
- https://man7.org/linux/man-pages/man2/fsync.2.html


## Optional separate source-review execution

Owner-directed continuation on 2026-09-19 adds a bounded, read-only review
process to the existing PR-only workflow. This changes the execution method,
not the six-file scope, restore contract, required tests or merge authority.
The runner loads a checksum-pinned Apache-2.0 Ministral 3 8B model and a
checksum-pinned llama.cpp CPU engine. Both are development-only, disposable
runner artifacts; neither is added to the platform or Gekta runtime. No API
key, paid inference service, production secret, new runner class or Mac is used.

The model receives the complete Git base-to-head diff in a fresh inference
context. It has no implementation tools. The artifact preserves the actual
request, response, exact refs/tree/blobs/diff hash, model/engine identities and
prompt-token accounting. Missing files, wrong SHA, inadequate per-file/area
coverage, truncated context/generation, fabricated execution claims and a PASS
with a blocking finding reject the candidate. Validator fixtures are not reviews.

This is an OPTIONAL evidence collector. A successful collection job is neither
review PASS nor merge admission. Unavailable execution records NOT_REVIEW, not
approval. Even a well-formed model candidate retains independent_review_accepted=false
and merge_authorized=false until the authorized operator actually examines its
provenance, full coverage, limitations and findings. Findings remain actionable;
automation cannot resolve them. Another real independent reviewer can replace
this method; no named model/provider becomes a mandatory dependency.

Pinned upstream sources (checked 2026-09-19):
- llama.cpp b10964 / b29c606e28a01b1bc8c1351026a0fa6e616bf6c4, release asset 563672468:
  https://github.com/ggml-org/llama.cpp/releases/tag/b10964
- Ministral-3-8B-Instruct-2512-GGUF revision 65457cc28fafb2210c8fb885a068b107e8d7fab3:
  https://huggingface.co/mistralai/Ministral-3-8B-Instruct-2512-GGUF


## Optional review execution repair — 2026-09-19

Run `35412668024` ended with exit 1, no response, and NOT_REVIEW. Its deleted
runtime logs make the underlying exception unproven; do not call it a proven
timeout or memory failure. The pinned engine's own server README documents a
3600-second default timeout, not the older 600-second default:
`ggml-org/llama.cpp@b29c606e28a01b1bc8c1351026a0fa6e616bf6c4/tools/server/README.md`.

The corrected collector records distinct preparation, template, tokenization,
inference and validation stages and allowlisted exception categories/statuses.
An always-run finalizer preserves classified diagnostics, exact-run identity and
artifact hashes before deleting raw logs. Exception messages, URLs and HTTP
bodies are not published. Missing exit evidence or interrupted execution is
NOT_REVIEW; collection success still grants no review or merge authority.

The one-shot CPU inference now uses a 40960-token slot and 128-token physical
batches to bound allocation rather than reserving an unnecessary 65536-token
slot. The full prompt, 6144-token output and 512-token margin must fit together;
there is no truncation, chunk omission, weaker review schema or retry loop.
Explicit server/client deadlines are 3000/2700 seconds. A 60-minute execution
step leaves ten minutes within the existing job budget for finalization/upload.
A new run after these material repairs is diagnostic execution, not evidence
that the historical cause was established or that independent review passed.
