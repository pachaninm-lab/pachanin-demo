# platform-v7 audit diff guard — 2026-06-23

## Allowed diff

Only these paths are allowed in this audit PR:

```text
docs/platform-v7/audit/**
```

## Forbidden diff

```text
apps/landing/**
package.json
package-lock.json
pnpm-lock.yaml
yarn.lock
**/api/**
**/auth/**
**/session/**
**/migrations/**
```

## Manual review note

If any forbidden path appears, request changes and split the PR.
