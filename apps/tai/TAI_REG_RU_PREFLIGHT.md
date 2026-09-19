# TAI Agro OS — REG.RU read-only preflight

**Authority baseline:** `f8f2e1c1d5c875e238b59509a4f7fc63ebe9b7b2`  
**Hosting:** existing REG.RU infrastructure only  
**New recurring cost:** 0 RUB  
**Production mutation:** forbidden  
**Transport:** outbound-only non-root runner plus fixed root-owned controller

## Security model

The `pcactions` runner is not root, is not a member of the `docker` group and cannot access `/var/run/docker.sock`. It has one sudo permission only: `/usr/local/sbin/pc-tai-release-controller`.

The controller rejects arbitrary commands and paths. It fetches the public repository into `/var/lib/pc-release-authority/repository`, verifies the requested SHA equals current `origin/main`, checks out that SHA in a root-owned clean worktree and runs only the approved preflight script. The runner workspace is never used for production execution.

Pull requests run hosted contract checks only. Live execution requires successful canonical exact-main image authority or owner-confirmed manual dispatch.

## One-time installation

From the REG.RU serial/VNC console, use a short-lived repository runner token and the verified private model-host SSH fingerprint:

```bash
sudo env \
  RUNNER_REGISTRATION_TOKEN='<SHORT_LIVED_TOKEN>' \
  TAI_MODEL_SSH_HOST_FINGERPRINT='SHA256:<PINNED_FINGERPRINT>' \
  bash scripts/install-pc-prod-actions-runner.sh
```

The installer pins GitHub Actions Runner `2.336.0`, verifies its official SHA-256 checksum, removes legacy Docker-group authority, installs the controller and a single-command sudoers rule, pins the private model host, and records a root-owned authority manifest.

## Evidence

The protected controller executes the existing read-only preflight, validates the exact image revision/digest, preserves explicit PostgreSQL read-only transactions and container/Compose drift snapshots, and publishes only a redacted JSON report. Commit status publication remains on a hosted runner.
