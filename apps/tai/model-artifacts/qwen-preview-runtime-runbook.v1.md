# Qwen3-8B read-only operational preview runtime

## Purpose

This contour proves one bounded, owner-triggered, read-only Qwen3-8B Q4_K_M inference session on the dedicated `tai-model` host. It is not a benchmark completion, model admission, routing activation, UI activation, deployment, or production attestation.

Command:

```text
/tai run qwen read-only preview exact-main
```

The command is accepted only as an owner-authored issue comment on issue `#3003` while the workflow file is present on exact `main`.

## Protected inputs

The workflow uses only the existing repository secrets:

- `TAI_MODEL_HOST`;
- `TAI_MODEL_SSH_USER`, required to resolve to `tai-model`;
- `TAI_MODEL_SSH_PORT`;
- `TAI_MODEL_SSH_KEY`.

The exact-main checkout, authority self-digest, focused Ruff/mypy/pytest checks, and shell syntax checks complete before SSH begins. No password secret, production web host credential, S3 credential, model bytes, prompt, or response is uploaded to GitHub.

## Host prerequisites

The dedicated model host must provide:

- Linux x86_64;
- user `tai-model`;
- non-symlink workspace `/srv/tai-models`;
- a completed conversion report under `/srv/tai-models/conversion-runs`;
- the report-bound `artifacts/qwen3-8b-q4-k-m.gguf`;
- the report-local `toolchain/bin/llama-server` from llama.cpp release `b9637`;
- `curl`, `jq`, `python3`, `sha256sum`, `ss`, and `stat`.

The runtime independently recomputes the conversion report self-digest, Q4_K_M size and SHA-256, and `llama-server` size and SHA-256 before execution. The newest valid completed conversion report is selected only from the governed conversion root. This host-local identity remains pending external immutable storage acceptance.

## Runtime boundaries

- listener: `127.0.0.1:18080` only;
- context: 4096 tokens;
- output: at most 128 tokens;
- deterministic generation: temperature 0, top-p 1, seed 42;
- parallel requests: 1;
- queued requests: 0 in the controlled driver;
- startup timeout: 180 seconds;
- request timeout: 120 seconds;
- peak RSS limit: 12,000,000,000 bytes;
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

On success or failure the remote trap terminates `llama-server`, removes the host-only raw directory, and verifies that the preview port is no longer listening. The contour does not create a system service, container, public listener, route, or persistent deployment, so rollback is restoration of the pre-run no-listener state.

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
