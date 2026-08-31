# Production web owner exact-SHA command

## Purpose

This command is a thin owner-only control-plane bridge for the existing canonical web-only production release. It does not deploy, SSH to production, mutate Compose, touch the API, run database migrations, or operate TAI itself.

Canonical mutation authority remains:

`.github/workflows/production-web-exact-sha.yml`

The bridge exists so the repository owner can request an already-built historical exact web revision that is still reachable from `main`, without creating a synthetic application commit and without using the full-stack API/database release path.

## Command

Create a comment on repository issue `#3048` with exactly:

```text
/production web exact <40-character-lowercase-sha>
```

Example shape only:

```text
/production web exact 0123456789abcdef0123456789abcdef01234567
```

## Authority and validation

The command workflow runs only when all of the following are true:

- the event is a newly created issue comment;
- the issue number is exactly `3048`;
- the comment author is exactly `github.repository_owner`;
- the body matches the exact command grammar;
- the target resolves to a Git commit;
- the target is an ancestor of current `origin/main`.

After validation it performs only one mutation: GitHub Actions dispatch of `production-web-exact-sha.yml` with `action=deploy`, the exact target SHA, and `DEPLOY-EXACT-SHA` confirmation.

The canonical release workflow remains responsible for exact OCI-image verification, protected production access, web-only mutation boundaries, Docker health, live RU/EN/ZH acceptance, persistent exact-image authority, evidence and rollback.

## Safety boundary

This bridge must not contain SSH, SCP, Docker production commands, production credentials, API deployment, database migration, application runtime changes, or TAI operations. Failure to validate the command or main-line ancestry fails closed before any release dispatch.
