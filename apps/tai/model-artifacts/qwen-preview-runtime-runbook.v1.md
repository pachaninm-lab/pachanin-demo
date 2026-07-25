# Qwen3-8B read-only operational preview runtime

## Purpose

This contour proves one bounded, owner-triggered, read-only Qwen3-8B Q4_K_M inference session on the dedicated `tai-model` host. It is not a benchmark completion, model admission, routing activation, UI activation, deployment, or production attestation.

Command:

```text
/tai run qwen read-only preview exact-main
```

The command is accepted only as an owner-authored issue comment on issue `#3003` while the workflow file is present on exact `main`.

## Protected inputs

The workflow uses only these repository secrets:

- `TAI_MODEL_HOST`;
- `TAI_MODEL_SSH_USER`, required to resolve to `tai-model`;
- `TAI_MODEL_SSH_PORT`;
- `TAI_MODEL_SSH_KEY`;
- `TAI_MODEL_SSH_HOST_KEY` — **new prerequisite**, the pinned public host key.

`TAI_MODEL_SSH_HOST_KEY` holds one public host key line as the host presents it, for
example `ssh-ed25519 AAAAC3Nza...`. Read it on the model host with:

```
ssh-keyscan -t ed25519 -p <port> <host>
```

taking the value from a trusted path — a console session on the host itself, not the
same network path the workflow will later use.

The driver builds `known_hosts` from this pin alone, then confirms the host presents the
same key before the SSH credential is ever written to disk. Without the secret the run
fails closed before any protected access; on a mismatch it exits `21` and the credential
never reaches the runner. Learning the key with `ssh-keyscan` at connection time would be
trust-on-first-use with nothing to anchor it: a hijacked DNS entry or route could present
its own key, satisfy `StrictHostKeyChecking`, emulate the remote script and return
self-digested evidence accepted as model provenance.

Evidence that fails verification is deleted on the runner and exits `22`. Only accepted
evidence is uploaded; a failed run uploads the authority document and the pre-access
validation report alone, never anything returned by the model host.

The exact-main checkout, authority self-digest, focused Ruff/mypy/pytest checks, and shell syntax checks complete before SSH begins. No password secret, production web host credential, S3 credential, model bytes, prompt, or response is uploaded to GitHub.

## Host prerequisites

The dedicated model host must provide:

- Linux x86_64;
- user `tai-model`;
- non-symlink workspace `/srv/tai-models`;
- the exact accepted conversion root `8bd494dc…/29810648430-1`;
- its exact `status.json`, conversion authority, canonical report, and Q4 step evidence;
- the report-bound `artifacts/qwen3-8b-q4-k-m.gguf`;
- the report-local `toolchain/bin/llama-server` from llama.cpp release `b9637`;
- `curl`, `jq`, `python3`, `sha256sum`, `ss`, and `stat`.

The runtime accepts only conversion exact-main `8bd494dc4954baaf699cffa243951392ff451ebb`, workflow `29810648430`, attempt `1`. It verifies the pinned conversion-authority and report SHA-256 values, the exact Qwen source revision, the separate COMPLETE `qwen3-8b-q4-k-m` step with exit code 0, and the pinned 5,027,784,032-byte GGUF digest. Hint-based, glob-based, or newest-report selection is prohibited. This host-local identity remains pending external immutable storage acceptance.

## Runtime boundaries

- listener: `127.0.0.1:18080` only;
- context: 4096 tokens;
- output: at most 128 tokens;
- deterministic generation: temperature 0, top-p 1, seed 42;
- parallel requests: 1;
- queued requests: 0 in the controlled driver;
- startup timeout: 180 seconds;
- request timeout: 120 seconds;
- observed whole-process-tree RSS limit: 12,000,000,000 bytes;
- 50 ms fail-closed RSS guard, active during model load, readiness, and every request;
- tools and write authority: disabled;
- public routing, Gateway/UI binding, service installation, and deployment: prohibited.

The driver executes serial RU, EN, and ZH smoke requests. Prompts, HTTP bodies, model logs, and generated text stay inside the host-only `raw` directory and are deleted before successful evidence is emitted.

## Evidence

The GitHub artifact may contain only:

- exact-main and workflow identity;
- authority digest;
- hashed host identity;
- model and toolchain SHA-256/size metadata;
- startup, elapsed, token, response-byte, and RSS measurements;
- prompt and response digests;
- listener lifecycle, process stop, raw deletion, and rollback proof;
- unchanged maturity statuses.

The verifier rejects raw fields, duplicate JSON keys, stale evidence, wrong exact-main, model or toolchain drift, public listeners, missing RU/EN/ZH coverage, excessive resources, incomplete cleanup, and any maturity escalation.

## Cleanup and rollback

The launcher creates a dedicated process session in a stopped state. The RSS guard validates PID, process group, session, start time, and its first sample before the model is resumed. On an observed breach or guard failure it terminates the entire tracked process group and descendants. On success or failure the remote trap terminates and reaps the server and guard, removes the host-only raw directory, and verifies that the preview port is no longer listening. This userspace guard is a fail-closed preview control, not evidence of a kernel cgroup memory cap. The contour does not create a system service, container, public listener, route, or persistent deployment, so rollback is restoration of the pre-run no-listener state.

## Maturity boundary

A valid result is exactly:

`READ_ONLY_OPERATIONAL_PREVIEW_PENDING_EXTERNAL_IMMUTABILITY`

The following remain unchanged:

- benchmark: `PENDING_BENCHMARK`;
- model admission: `PENDING_ADMISSION`;
- routing: `NOT_ACTIVATED`;
- UI: `NOT_ACTIVATED`;
- deployment: `NOT_ACTIVATED`;
- production operational status: `NOT_ATTESTED`.
