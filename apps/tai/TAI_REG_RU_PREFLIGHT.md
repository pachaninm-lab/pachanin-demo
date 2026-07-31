# TAI Agro OS — REG.RU read-only preflight

**Authority baseline:** `30eec47491be42db1964a46aa0e7342c0b2eec2f`  
**Hosting:** existing REG.RU infrastructure only  
**New recurring cost:** 0 RUB  
**Mode:** `READ_ONLY_PREFLIGHT`  
**Production mutation:** forbidden  
**Transport:** outbound-only local self-hosted release runner

## Purpose

The preflight inventories the exact production prerequisites for TAI without changing the running platform. The production job executes locally on the existing REG.RU VPS. GitHub-hosted runners no longer connect to production over inbound SSH.

Pull requests execute only hosted contract checks. Live inventory requires a successful canonical exact-main image publication or an owner-confirmed manual dispatch, the labels `self-hosted,linux,x64,pc-prod,tai-release`, a runner name beginning with `pc-prod-`, root execution authority and exact equality with current `origin/main`.

The root execution boundary is equivalent to the previous protected root-SSH deployment authority, but removes the public inbound SSH dependency. The release runner polls GitHub over outbound HTTPS.

## One-time installation

From the REG.RU serial/VNC console, generate a short-lived repository runner registration token and execute from an exact-main repository checkout:

```bash
sudo env RUNNER_REGISTRATION_TOKEN='<SHORT_LIVED_TOKEN>' \
  bash scripts/install-pc-prod-actions-runner.sh
```

The installer pins GitHub Actions Runner `2.336.0`, verifies the official Linux x64 SHA-256 checksum, runs the verified dependency installer, registers only `pc-prod,tai-release`, installs a hardened root systemd service and writes `/etc/pc-release-authority/actions-runner.json`. The token is never printed or persisted.

## Evidence and safeguards

The hosted job verifies the exact rootless TAI image and passes only its immutable reference and digest to the local job. The local job executes `scripts/tai-reg-ru-preflight.sh`, which:

- resolves production Compose authority from running labels;
- verifies exact API/web revision, TAI image identity, internal-only networking and rootless runtime;
- checks governed PostgreSQL relations inside an explicit read-only transaction;
- validates active knowledge, model identity and artifact-bound admission;
- snapshots containers and protected Compose hashes before and after inspection;
- returns `PRODUCTION_MUTATION_DETECTED` on any drift;
- emits only redacted status codes, counts and immutable references.

The commit status is published from a separate hosted job, so the production runner receives no status-write permission.

## Separation from deployment

A green contract proves only the mechanism. A live PASS proves only exact-main prerequisites. Production mutation remains owned by `TAI Restricted Qwen REG.RU Activation` and `TAI REG.RU Deployment`, each with rollback and exact-main acceptance.
