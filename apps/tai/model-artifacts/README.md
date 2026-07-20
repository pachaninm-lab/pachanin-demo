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

## AP-13B.3 source/conversion/license bundle authority

The v1 registry and verifier remain available for compatibility. They are not sufficient for AP-13B.3 acceptance because a v1 bundle does not declare or verify the source weight shards. AP-13B.3 uses the independent, stricter v2 contract:

- `model-bundle-authority.v2.json` fixes the full remote inventory, selected converter inputs, explicit exclusions, exact conversion argv and every required quantization;
- `local-model-artifact-bundle.schema.v2.json` is the versioned external evidence schema;
- `qwen3-8b.bundle.v2.pending.json` and `mistral-7b-instruct-v0.3.bundle.v2.pending.json` are honest `PENDING_ACQUISITION` baselines;
- `model-bundle-acquisition-runbook.v2.md` defines acquisition, legal review, conversion, immutable storage and restore verification.

The authority records every file visible at the pinned upstream revisions. Qwen selects all five source shards, the shard index, the complete tokenizer set, both configuration files and the model card. Mistral selects all three source shards, the shard index, `tokenizer.model`, `tokenizer.model.v3`, the remaining tokenizer/configuration files and the model card. `consolidated.safetensors` is inventoried but explicitly excluded because the governed llama.cpp conversion uses the Hugging Face shard/index layout and must not mix duplicate weight serializations.

The v2 verifier requires all of the following before status `VERIFIED`:

1. the authority canonical SHA-256 matches;
2. the observed remote inventory exactly matches the authority, including exclusions;
3. every selected source file has an exact local size and SHA-256;
4. the shard index references every declared weight shard and no undeclared shard;
5. a human-attributed legal decision is `APPROVED` and binds the exact license text;
6. the verified AP-13B.2b llama.cpp package, build manifest, verification report and all four binaries match the accepted authority;
7. Python/dependency, converter, exact argv, log and intermediate GGUF evidence are complete;
8. every registered quantization binds the intermediate GGUF and exact `llama-quantize` binary;
9. immutable upload evidence exists; and
10. every declared file re-verifies from a separate restored root.

The parser rejects duplicate and unknown JSON keys. File verification rejects traversal, symlinks, non-regular files and hard-link aliasing. The verifier never executes argv from either the authority or manifest.

### Validate the v2 authority

```bash
cd apps/tai
python -m tai.model_artifact_registry_cli validate-bundle-authority-v2 \
  model-artifacts/model-bundle-authority.v2.json
```

### Verify a pending baseline

A pending baseline is intentionally non-zero and contains no invented hashes, build observations or legal decision:

```bash
python -m tai.model_artifact_registry_cli verify-bundle-v2 \
  model-artifacts/model-bundle-authority.v2.json \
  model-artifacts/qwen3-8b.bundle.v2.pending.json \
  /nonexistent/pending-root \
  /nonexistent/restored-root
```

Expected result: status `PENDING_ACQUISITION`, reason `ACQUISITION_PENDING`, exit code `2`.

### Verify completed and restored evidence

```bash
python -m tai.model_artifact_registry_cli verify-bundle-v2 \
  model-artifacts/model-bundle-authority.v2.json \
  /secure/evidence/qwen3-8b/bundle.v2.json \
  /secure/evidence/qwen3-8b/original \
  /secure/evidence/qwen3-8b/restored \
  --output /secure/evidence/qwen3-8b/verification-report.v2.json
```

Exit code `0` is reserved for a complete `VERIFIED` report. `PENDING_ACQUISITION`, invalid input, legal rejection, missing evidence, drift or restore mismatch returns exit code `2`.

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
