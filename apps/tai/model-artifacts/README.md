# TAI local model artifacts

This directory stores only small machine-readable registries and runbooks. Model weights, GGUF files, tokenizer binaries and license evidence are not committed to Git.

## Current status

`candidates.v1.json` pins two source candidates:

- primary: `Qwen/Qwen3-8B` at revision `895c8d171bc03c30e113cd7a28c02494b5e068b7`;
- fallback: `mistralai/Mistral-7B-Instruct-v0.3` at revision `c170c708c41dac9275d15a8fff4eca08d52bab71`.

Both candidates remain `PENDING`. The Apache-2.0 metadata in the upstream model card is not treated as completed legal review. The exact license text, tokenizer files, source weights, quantized artifacts and full llama.cpp commit still have to be captured and hashed before a bundle can verify.

## Validate the source registry

```bash
cd apps/tai
python -m tai.model_artifact_registry_cli validate-registry \
  model-artifacts/candidates.v1.json
```

This validates only schema and immutable source references. It does not claim that local artifacts exist or are admitted.

## Required local bundle layout

A bundle lives outside Git and contains:

```text
bundle-root/
  licenses/<model>/LICENSE
  sources/<model>/tokenizer...
  sources/<model>/model...safetensors
  artifacts/<model>-q4-k-m.gguf
```

A separate `bundle.v1.json` declares every evidence file with exact relative path, SHA-256 and byte size. Each quantized artifact also declares runtime class, quantization and the full 40-character toolchain commit.

## Verify a completed bundle

```bash
cd apps/tai
python -m tai.model_artifact_registry_cli verify-bundle \
  model-artifacts/candidates.v1.json \
  /secure/evidence/qwen3-8b.bundle.v1.json \
  /secure/evidence/qwen3-8b \
  --output /secure/evidence/qwen3-8b.verification.json
```

Exit codes:

- `0` — all required files, sizes, hashes, recipes, license review and toolchain commit match;
- `2` — invalid schema, missing evidence, mismatch or pending/rejected license.

## Quantization boundary

The registry currently pins llama.cpp release `b9637`, but intentionally leaves `toolchain_commit` null until the full commit SHA and source/build evidence are captured. A release tag or short SHA alone is insufficient for bundle verification.

The expected sequence is:

1. fetch the exact upstream model revision;
2. capture and review the exact license text;
3. hash source weights and tokenizer files;
4. pin the full llama.cpp commit and build environment;
5. convert to F16/BF16 GGUF;
6. quantize to the declared output;
7. hash the output and create the bundle manifest;
8. run the verifier;
9. only then create AP-13A artifact/license evidence;
10. benchmark in AP-13C before any admission decision.

## Security rules

- Never use `main`, `master`, `latest` or mutable model tags.
- Never trust a community GGUF without a complete provenance chain.
- Never commit multi-gigabyte weights or secrets to Git.
- Never mark a license approved automatically.
- Never copy benchmark numbers from a model card into admission evidence.
- Never change `NOT_ATTESTED` until AP-13C and AP-13D exact-main evidence passes.
