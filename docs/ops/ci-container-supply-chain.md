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

Three such incidents occurred within ninety minutes on 2026-07-27, each on a
different job:

| Run | Job | Head |
|---|---|---|
| 30229586150 | `12 roles · 19 commands · PostgreSQL RLS · DR restore` | `dc9f79a7b` |
| 30235729808 | `RLS, race, restart, appeal and settlement acceptance` | `011bf977a` |
| 30236931255 | `PostgreSQL leases, recovery and redrive acceptance` | `148ca09cf` |

Re-running is not a fix. It restores the signal for one run and leaves the
dependency in place.

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

1. Mirror manifests, mirror workflow and this document land first.
2. The mirror workflow runs and the digest is verified against the published
   package.
3. Only then are consumers switched, together with the regression guard that
   forbids returning to an anonymous Docker Hub pull.

Switching consumers before the mirrored package exists would replace an
intermittent failure with a certain one.

## What this does not claim

The mirror proves that pinned upstream images are available under repository
control. It does not change PostgreSQL, does not touch schema, migrations, RLS,
Deal, money or production runtime, and proves nothing about whether any
acceptance suite passes.

Local development compose files (`docker-compose.yml`,
`infra/flagsmith/docker-compose-override.yml`) are out of scope: they are not CI
acceptance paths and their availability does not gate any merge.
