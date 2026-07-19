# TAI local model artifacts

This directory stores only small machine-readable authorities, schemas, pending baselines and runbooks. Model weights, GGUF files, source archives, compiled binaries, tokenizer binaries and license evidence are not committed to Git.

## Current status

`candidates.v1.json` pins two source candidates:

- primary: `Qwen/Qwen3-8B` at revision `895c8d171bc03c30e113cd7a28c02494b5e068b7`;
- fallback: `mistralai/Mistral-7B-Instruct-v0.3` at revision `c170c708c41dac9275d15a8fff4eca08d52bab71`.

Both model candidates remain `PENDING`. The Apache-2.0 metadata in an upstream model card is not treated as completed legal review. Exact license text, tokenizer files, source weights and quantized artifacts still have to be captured and hashed before a model bundle can verify.

The quantization recipes now bind to the accepted llama.cpp source authority:

- release: `b9637`;
- full commit: `aedb2a5e9ca3d4064148bbb919e0ddc0c1b70ab3`;
- controlled targets: `llama-cli`, `llama-server`, `llama-quantize`, `llama-bench`.

This pin does **not** claim that the binaries have been built. `llama-cpp-build-baseline.v1.json` intentionally remains `PENDING_BUILD` and must return exit code `2` from the verifier.

## Toolchain authority and evidence

- `llama-cpp-toolchain-authority.v1.json` fixes the repository, release, full commit, exact source archive URI, Linux x86_64 CPU build profile, configure/build argv, evidence paths and four required outputs.
- `llama-cpp-build-evidence.schema.v1.json` defines the external immutable evidence contract for either `PENDING_BUILD` or a completed `BUILT` observation.
- `llama-cpp-build-baseline.v1.json` is the committed fail-closed baseline. It contains no fabricated source digest, compiler identity, log, binary size or binary hash.
- `llama-cpp-source-build-runbook.md` defines the controlled source-build and evidence-capture procedure.

The verifier reads and hashes bounded files only. It rejects missing files, path traversal, symlinks, non-regular binaries, duplicate paths or targets, hard-link aliasing, source-tree drift, dirty checkout evidence, command drift, authority drift, digest/size mismatch and incomplete target sets. It never executes argv stored in the authority or evidence manifest.

### Verify the committed pending baseline

```bash
cd apps/tai
python -m tai.model_artifact_registry_cli verify-toolchain \
  model-artifacts/llama-cpp-toolchain-authority.v1.json \
  model-artifacts/llama-cpp-build-baseline.v1.json \
  /nonexistent/pending-root
```

Expected result: status `PENDING_BUILD`, reason `BUILD_PENDING`, exit code `2`.

### Collect completed external evidence

After following the source-build runbook, collect the standard evidence layout without executing any manifest command:

```bash
cd apps/tai
python -m tai.model_artifact_registry_cli collect-toolchain-evidence \
  model-artifacts/llama-cpp-toolchain-authority.v1.json \
  /secure/evidence/llama-cpp-b9637 \
  --cmake-executable /usr/bin/cmake \
  --c-compiler-executable /usr/bin/cc \
  --cxx-compiler-executable /usr/bin/c++ \
  --output /secure/evidence/llama-cpp-b9637/evidence/llama-cpp-build.v1.json \
  --verification-output /secure/evidence/llama-cpp-b9637/evidence/llama-cpp-verification.v1.json
```

The command exits `0` only when the collected evidence verifies against the exact authority. A standalone verification command is also available:

```bash
python -m tai.model_artifact_registry_cli verify-toolchain \
  model-artifacts/llama-cpp-toolchain-authority.v1.json \
  /secure/evidence/llama-cpp-b9637/evidence/llama-cpp-build.v1.json \
  /secure/evidence/llama-cpp-b9637 \
  --output /secure/evidence/llama-cpp-b9637/evidence/llama-cpp-verification.v1.json
```

## Validate the model source registry

```bash
cd apps/tai
python -m tai.model_artifact_registry_cli validate-registry \
  model-artifacts/candidates.v1.json
```

This validates schema and immutable source references. It does not claim that local model artifacts exist or are admitted.

## Required local model bundle layout

A model bundle lives outside Git and contains:

```text
bundle-root/
  licenses/<model>/LICENSE
  sources/<model>/tokenizer...
  sources/<model>/model...safetensors
  artifacts/<model>-q4-k-m.gguf
```

A separate `bundle.v1.json` declares every evidence file with exact relative path, SHA-256 and byte size. Each quantized artifact also declares runtime class, quantization and the same full toolchain commit fixed by the authority.

## Verify a completed model bundle

```bash
cd apps/tai
python -m tai.model_artifact_registry_cli verify-bundle \
  model-artifacts/candidates.v1.json \
  /secure/evidence/qwen3-8b.bundle.v1.json \
  /secure/evidence/qwen3-8b \
  --output /secure/evidence/qwen3-8b.verification.json
```

Exit codes:

- `0` — every required file, size, hash, recipe, approved license review and full toolchain commit matches;
- `2` — pending state, invalid schema, missing evidence, mismatch or rejected license.

## Quantization sequence

1. complete and verify the exact llama.cpp source build;
2. fetch the exact upstream model revision;
3. capture and review the exact license text;
4. hash source weights and tokenizer files;
5. convert to F16/BF16 GGUF with the verified toolchain;
6. quantize to the declared output;
7. hash the output and create the external bundle manifest;
8. run the fail-closed bundle verifier;
9. create AP-13A artifact/license evidence only after legal approval;
10. benchmark in AP-13C before any AP-13D admission decision.

## Security rules

- Never use `main`, `master`, `latest`, a mutable model tag or a short commit.
- Never trust a community GGUF without a complete provenance chain.
- Never commit multi-gigabyte weights, source archives, binaries or secrets to Git.
- Never mark a license approved automatically.
- Never execute commands read from an evidence manifest.
- Never copy benchmark numbers from a model card into admission evidence.
- Never change `NOT_ATTESTED` until AP-13C, AP-13D and the later exact-main acceptance gates pass.
