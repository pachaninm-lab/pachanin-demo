# CI container supply chain

Date: 2026-07-27.

## Why this exists

Every blocking PostgreSQL acceptance job in this repository starts by pulling
`postgres:16` from Docker Hub **anonymously**. Anonymous pulls are rate limited
and intermittently unreachable.

When the pull fails the failure does not look like an infrastructure problem. It
looks like a failed acceptance:

```
##[command]/usr/bin/docker pull postgres:16
Error response from daemon: Get "https://registry-1.docker.io/v2/": context deadline exceeded
##[warning]Docker pull failed with exit code 1, back off 6.14 seconds before retry.
...
##[error]Docker pull failed with exit code 1
##[error]No files were found with the provided path: artifacts/outbox-postgresql
```

The service container never starts, so the acceptance step never runs, so the
evidence directory is never created, so the dependent gate fails on
`test "failure" = success`. Nothing was proven and nothing was disproven.

Four such incidents occurred within two hours on 2026-07-27:

| Run | Job | Image | Head |
|---|---|---|---|
| 30229586150 | `12 roles · 19 commands · PostgreSQL RLS · DR restore` | `postgres:16` | `dc9f79a7b` |
| 30235729808 | `RLS, race, restart, appeal and settlement acceptance` | `postgres:16` | `011bf977a` |
| 30236931255 | `PostgreSQL leases, recovery and redrive acceptance` | `postgres:16` | `148ca09cf` |
| 30242646007 | `12 roles · 19 commands · PostgreSQL RLS · DR restore` | `postgres:16-alpine` | `3486f9c41` |

The fourth incident is the informative one. It landed on a pull request whose
only subject was a CI gate — nothing to do with PostgreSQL — and it failed on
`postgres:16-alpine`, not `postgres:16`. The exposure is therefore not confined
to one job or one logical image: it is every job that pulls anything from Docker
Hub anonymously.

It also shows what the failure costs even when nothing is wrong. The same job
passed on the very next run of the very same tree, so the red was pure transport
noise — but no one can tell that from the check list without opening the log.

Re-running is not a fix, and here it was not even available: the repository's
GitHub App is refused with `403 Resource not accessible by integration` on
`rerun-failed-jobs`. The only lever left was to push a new head and hope the
registry cooperated. That is not a control.

## The contract

Pinned upstream images are copied into the repository's own GHCR namespace, and
consumers pull a digest under repository control.

| | |
|---|---|
| Upstream | `docker.io/library/postgres@sha256:…` |
| Mirror | `ghcr.io/pachaninm-lab/ci-postgres:<tag>-<short-digest>` |
| Consumers pull | `ghcr.io/pachaninm-lab/ci-postgres@sha256:…` |
| Authentication | `GITHUB_TOKEN` only |

No separate Docker Hub token is introduced and no persistent Docker Hub
credentials are stored.

### The mirrored digest equals the upstream digest

`skopeo copy --all --preserve-digests` reproduces the upstream manifest index
byte for byte. A content-addressable copy therefore keeps the same digest.

The mirror workflow **verifies** this rather than assuming it: it recomputes the
digest of the pushed manifest and refuses the run if it differs. A copy that
does not preserve the digest is not a faithful mirror and must not be published
as one.

### Three logical images, not one

| Logical name | Upstream tag | Used by |
|---|---|---|
| `postgres-16` | `postgres:16` | 13 blocking acceptance workflows |
| `postgres-16-alpine` | `postgres:16-alpine` | `ci`, `api-test`, `security-abuse-evidence` |
| `postgres-16.4-alpine3.20` | `postgres:16.4-alpine3.20` | production-like Kubernetes dependencies, pgbouncer helper |

These are deliberately **not** collapsed into one image. Alpine and Debian
PostgreSQL builds differ in libc and collation. Unifying them silently could
change sort order and index behaviour in acceptance suites whose whole purpose
is to detect exactly that kind of change.

## Manifests

`.github/container-images/<logical-name>.v1.json`, schema
`pc.ci-container-image.v1`:

- `upstream_repository`, `upstream_tag`, `upstream_digest`
- `mirrored_repository`, `mirrored_tag`, `mirrored_digest`
- `platforms` — every architecture carried by the index
- `authentication_mode`
- `observed_at`, `mirrored_at`, `source_workflow`, `source_run_id`
- `verification_status`

`verification_status` is `PENDING_MIRROR_VERIFICATION` until the mirror workflow
has actually run and confirmed the digest. It is not set to verified in advance,
because a manifest that claims verification it has not received is worse than no
manifest.

All three manifests are now `VERIFIED`, each carrying the run that proved it:
run [`30247846635`](https://github.com/pachaninm-lab/pachanin-demo/actions/runs/30247846635)
on `ef9fb1634`, which reported `digest_preserved: true` for every image. A
manifest marked `VERIFIED` without `source_run_id` is refused — a claim with no
run behind it is the thing this field exists to prevent.

### The mirrored package is public, and that is a dependency worth naming

Consumers pull anonymously today because `ghcr.io/pachaninm-lab/ci-postgres` is a
public package, so no `credentials:` block and no `packages: read` permission are
needed on the sixteen consuming workflows.

If the package is ever made private, every consumer breaks at once and loudly —
the service container will not start. That is a smaller and better-behaved
dependency than the one it replaces: it is a repository setting under our own
control rather than a third party's rate limit, and it fails visibly instead of
intermittently. Restoring it means either making the package public again or
adding `credentials:` with `github.actor` and `GITHUB_TOKEN` plus
`permissions: packages: read` to each consuming workflow.

## Fail-closed rules for consumers

A consumer must refuse to start when:

- the manifest is missing;
- `mirrored_digest` is empty;
- a mutable tag is used without a digest;
- the registry is not the GHCR authority;
- the running image does not match the manifest;
- the package is unreachable;
- authentication fails.

**There is no fallback to Docker Hub.** A fallback would hide the dependency
again and reintroduce exactly the failure mode this contract removes: the next
outage would silently pull from Docker Hub and nobody would learn that the
mirror had stopped working.

## Migration order

1. Mirror manifests, mirror workflow and this document land first. — done, #3266
2. The mirror workflow runs and the digest is verified against the published
   package. — done, run `30247846635`
3. Only then are consumers switched, together with the regression guard that
   forbids returning to an anonymous Docker Hub pull. — done, #3269

Switching consumers before the mirrored package exists would replace an
intermittent failure with a certain one.

## The guard

`scripts/check-ci-postgres-image-authority.mjs` runs on every pull request and
every push to main, via `.github/workflows/ci-postgres-image-authority.yml`.

It is deliberately **not** path-filtered. The regression it guards against is a
one-line edit in any workflow or script, and a path filter is precisely how the
`Cache-Control` drift in this repository stayed invisible for a day: a gate that
only runs when someone happens to touch its own paths is not a gate.

The guard refuses:

| Case | Verdict |
|---|---|
| `ghcr.io/pachaninm-lab/ci-postgres@<verified digest>` | pass |
| the mirror pinned by a mutable tag | fail — named as a pin problem, not a registry one |
| a digest under the mirror that no manifest verifies | fail |
| `postgres:16` or any other non-mirror image | fail |
| `docker.io/library/postgres`, `registry-1.docker.io` | fail |
| any manifest not `VERIFIED`, or `VERIFIED` with no `source_run_id` | fail, before any consumer is even examined |

That last row is what keeps the guard from passing vacuously: without a
trustworthy allowlist, consumers would either all pass for no reason or all fail
for the wrong one, so a broken manifest set stops the check where it stands.

The workflow runs the guard's own test suite **before** running the guard, so a
green result means the guard was demonstrated to reject regressions on that same
commit — not merely that it printed `PASS`.

Historical and dated records are out of scope by construction: only
`.github/workflows`, `infra/kind` and `scripts` are scanned. An incident report
naming `docker pull postgres:16` describes what was true when it was written and
must stay readable as written.

### Three workflows could not be migrated, and that is recorded rather than hidden

`pc-crop-07a.yml`, `pc-crop-07b.yml` and `pc-crop-08d.yml` have their
`permissions`/`jobs` body frozen by
`docs/platform-v7/autopilot/pc-crop-predecessor-trigger-lock.json`, which pins a
sha256 of that body against baseline commit `3133779b1`. Editing the image line
inside them breaks the lock.

The lock could be regenerated to fit the edit. It was not, and must not be:
regenerating an immutability control so that it accepts your own change is
self-issuing an exemption from the control, which is the same category of error
as lowering a coverage gate to make a build pass.

So those three keep pulling `postgres:16` from Docker Hub and remain exposed to
the outage described at the top of this document. The guard records them by name
with the image each was locked with, and refuses any *other* value there — a
frozen workflow may keep exactly what it was frozen with and nothing else. A test
pins the list to precisely the files the lock actually covers, so the exception
cannot quietly grow.

Unfreezing them is an owner decision, tracked as an open item in
`docs/platform-v7/autopilot/OWNER_ACTIONS_FINAL.md`. Until then the migration is
17 of 20 consumers, not 20 of 20, and this document says 17.

## What this does not claim

The mirror proves that pinned upstream images are available under repository
control. It does not change PostgreSQL, does not touch schema, migrations, RLS,
Deal, money or production runtime, and proves nothing about whether any
acceptance suite passes.

Local development compose files (`docker-compose.yml`,
`infra/flagsmith/docker-compose-override.yml`) are out of scope: they are not CI
acceptance paths and their availability does not gate any merge.
