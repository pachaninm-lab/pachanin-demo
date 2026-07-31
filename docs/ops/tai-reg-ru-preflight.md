# TAI REG.RU read-only production preflight

## Purpose

This preflight determines whether the separate TAI runtime can be deployed on the existing
REG.RU production contour without changing application workloads or PostgreSQL state.
It is evidence collection, not deployment.

Evidence authority: GitHub issue `#3553`.

## Exact artifact

The workflow accepts only the current `main` commit and the canonical image:

```text
ghcr.io/pachaninm-lab/grainflow-tai:sha-<short-exact-main-sha>
```

The image must carry the full exact-main SHA in
`org.opencontainers.image.revision` on both the runner and REG.RU host.

## Read-only checks

The one-shot rootless TAI image runs on the existing production Compose network with:

- read-only root filesystem;
- a bounded no-exec temporary filesystem;
- all Linux capabilities dropped;
- `no-new-privileges`;
- no published ports;
- no platform tool configuration;
- a PostgreSQL transaction explicitly set to `READ ONLY`.

It checks only:

1. required TAI relations and view exist;
2. the future TAI database principal can `SELECT` them;
3. one active knowledge generation exists and contains chunks;
4. at least one active model profile exists;
5. every active profile has a current accepted admission with the same artifact digest;
6. the private Qwen endpoint accepts an authenticated deterministic inference request.

## Protected inputs

Protected operations storage supplies:

- production SSH identity and pinned host fingerprint;
- model-host SSH identity;
- the running model service Bearer credential;
- the existing API container database DSN.

The workflow never writes these values to an issue, artifact or log. The preflight report
contains only statuses, counts and governed reason codes. It excludes DSN, endpoint, model
identity, prompt response and credentials.

## Permitted host effects

The workflow may materialize the exact immutable TAI image in the REG.RU Docker image cache
and create a temporary `0600` environment file. The temporary file and one-shot container
must be removed before the SSH step exits.

## Forbidden operations

The workflow must not:

- run `docker compose up`, `down`, `restart` or `recreate`;
- stop, replace or reconfigure API, web, PostgreSQL, Caddy or model services;
- publish a port;
- apply a migration;
- execute `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `TRUNCATE`, `ALTER`, `CREATE` or `DROP`;
- create a PostgreSQL user or grant privileges;
- mark TAI as deployed;
- close issue `#3553`.

## Outcomes

`accepted=true` means prerequisites are present for a separate deployment scope. It is not
a production PASS.

`accepted=false` records exact sanitized blocker codes. Automatic main runs still complete
successfully after publishing a valid blocker report. A manually invoked enforcement run
fails when blockers remain.

## Next step

Only after an accepted preflight may a separate exact-main scope add the TAI Compose service,
least-privilege environment, health checks, rollback and live RU/EN/ZH acceptance.
