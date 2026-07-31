# TAI Agro OS — exact-main REG.RU deployment

**Authority baseline:** `30eec47491be42db1964a46aa0e7342c0b2eec2f`  
**Hosting:** existing REG.RU infrastructure only  
**New recurring cost:** 0 RUB  
**Production transport:** outbound-only local self-hosted release runner  
**Public TAI port:** forbidden

## Release chain

1. Canonical API, web, migration and TAI images are published for exact current main.
2. Restricted Qwen activation runs locally on the REG.RU production host and passes RU/EN/ZH plus hosted Chromium acceptance.
3. `TAI REG.RU Deployment` verifies the exact rootless TAI image on a hosted runner.
4. The local root release runner performs strict read-only preflight, retrieves the already active private model credential from the local API container without disclosure, and executes the rollback-bound TAI deployment script.
5. Post-deployment preflight must return PASS with zero blockers.
6. A separate hosted job publishes the exact-SHA deployment status.

No production SSH host, port, key, fingerprint, `ssh-keyscan`, `ssh` or `scp` is used. The model remains on the private REG.RU network and its credential remains server-only.

## Production boundary

The live runner executes only after successful upstream exact-main authority or owner-confirmed manual dispatch. Pull requests run hosted contract checks only. The deployed TAI service remains:

- rootless UID `65532:65532`;
- read-only filesystem with all Linux capabilities dropped;
- internal-only with no host/public ports;
- bound to an immutable image digest and exact OCI revision;
- limited to a dedicated non-inheriting PostgreSQL principal with zero non-TAI table grants;
- tool-disabled-safe and unable to create prepared actions during acceptance.

## Rollback

The deployment script creates a root-owned state directory under `/var/lib/pc-release-authority`, snapshots protected files and database-role state, and writes an executable rollback authority. Any failed deployment or post-deployment acceptance runs rollback before failure is published. Missing rollback authority after mutation is a hard failure.

## One-time runner prerequisite

Install the checksum-pinned release runner from the REG.RU serial/VNC console using `scripts/install-pc-prod-actions-runner.sh`. No new VPS, provider, VPN, tunnel, SaaS, paid API or recurring payment is required.
