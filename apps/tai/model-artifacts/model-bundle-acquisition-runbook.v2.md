# AP-13B.3 model bundle acquisition and verification runbook

## Purpose

This runbook creates external, reproducible evidence for the model bundles governed by `model-bundle-authority.v2.json`. It does not admit a model, publish benchmark results or change production readiness. The verifier is read-only and never executes manifest argv.

## Preconditions

Before acquiring either model:

1. AP-13B.2a is merged and issue #2828 is closed by that merge.
2. The controlled-build workflow is merged after AP-13B.2a.
3. AP-13B.2b has produced a `VERIFIED` exact-main llama.cpp package for release `b9637`, commit `aedb2a5e9ca3d4064148bbb919e0ddc0c1b70ab3` and profile `linux-x86_64-cpu-release-static-v1`.
4. The package has an immutable locator, archive SHA-256/size, build manifest, verification report, and SHA-256/size for `llama-cli`, `llama-server`, `llama-quantize` and `llama-bench`.
5. The operator has a non-shared controlled Linux workspace, sufficient disk capacity and an external immutable storage destination.

Do not substitute a release tag, branch, short commit, community GGUF or prebuilt binary.

## 1. Establish the controlled workspace

Use a dedicated non-symlink directory with restrictive permissions. Record OS, architecture, filesystem and available capacity. Keep acquisition, conversion and restore roots separate.

```bash
umask 077
export TAI_WORK=/secure/tai-model-bundles
mkdir -p "$TAI_WORK"/{acquisition,original,restore,reports}
```

Validate the committed authority and retain its canonical digest:

```bash
cd apps/tai
python -m tai.model_artifact_registry_cli validate-bundle-authority-v2 \
  model-artifacts/model-bundle-authority.v2.json \
  --output "$TAI_WORK/reports/authority-validation.v2.json"
```

## 2. Acquire the exact upstream revision

Acquire only the full revision recorded in the authority:

- Qwen: `Qwen/Qwen3-8B@895c8d171bc03c30e113cd7a28c02494b5e068b7`;
- Mistral: `mistralai/Mistral-7B-Instruct-v0.3@c170c708c41dac9275d15a8fff4eca08d52bab71`.

Capture a machine-readable remote inventory before download. It must contain every upstream path, byte size and an immutable remote identity. Preserve the raw API/CLI response as `evidence/remote-inventory.json`.

The observed inventory must include excluded files as well as selected files. Exclusion does not mean omission from provenance.

## 3. Enforce the selected source sets

For Qwen, acquire and hash:

- all five `model-0000*-of-00005.safetensors` shards;
- `model.safetensors.index.json`;
- `tokenizer.json`, `tokenizer_config.json`, `merges.txt`, `vocab.json`;
- `config.json`, `generation_config.json`;
- `README.md`.

For Mistral, acquire and hash:

- all three `model-0000*-of-00003.safetensors` shards;
- `model.safetensors.index.json`;
- `tokenizer.model` and `tokenizer.model.v3`;
- `tokenizer.json`, `tokenizer_config.json`, `special_tokens_map.json`;
- `config.json`, `generation_config.json`, `params.json`;
- `README.md`.

`consolidated.safetensors` remains in the remote inventory with disposition `EXCLUDED`. Do not download it into the governed conversion input set and do not mix it with the three-shard Hugging Face layout.

For every selected source file, record the exact relative path, SHA-256 and byte size. Parse `model.safetensors.index.json` and confirm that its `weight_map` references every selected shard and no other shard.

## 4. Capture human legal review

Store the exact license text as an immutable evidence file. A human reviewer must inspect the exact model revision, license text and intended use, then create a signed or otherwise attributable review record containing:

- decision `APPROVED` or `REJECTED`;
- reviewer type `HUMAN`;
- stable reviewer identifier and display name;
- timezone-aware review timestamp;
- SPDX identity;
- decision basis and scope.

Metadata from the upstream model card is not human legal approval. A pending, absent or automated decision cannot verify. A `REJECTED` decision terminates acquisition for that model.

## 5. Restore and reverify the llama.cpp package

Download the AP-13B.2b package from its immutable locator into the model bundle. Verify the package archive, build manifest, verification report and all four binaries before conversion. The embedded verification report must have status `VERIFIED`, the accepted toolchain authority digest and the complete target set.

Preserve the exact converter script from the same source commit at `toolchain/source/convert_hf_to_gguf.py`. Record its SHA-256 and byte size.

## 6. Freeze the Python conversion environment

Use a dedicated environment. Record the full Python identity and a deterministic dependency record such as a hashed lockfile or complete `pip freeze` output. Do not use an unrecorded global environment.

The evidence manifest binds:

- Python identity;
- dependency record;
- converter script;
- canonical digest of all selected source files;
- exact toolchain package SHA-256;
- exact argv and log;
- intermediate GGUF SHA-256 and byte size.

## 7. Execute the governed conversion

Read the exact argv from `model-bundle-authority.v2.json`, review it, and execute it manually in the controlled environment. The verifier does not execute it.

Qwen produces `artifacts/qwen3-8b-bf16.gguf`. Mistral produces `artifacts/mistral-7b-instruct-v0.3-f16.gguf`. Capture stdout, stderr, exit status and timestamps in the conversion log. Hash the completed intermediate GGUF.

Any argv drift, missing input, failed command or unrecorded dependency invalidates the evidence.

## 8. Execute every registered quantization

Use only the verified `toolchain/bin/llama-quantize` binary and the exact authority argv.

Required outputs:

- Qwen CPU: `Q4_K_M`;
- Qwen GPU/shared: `Q8_0`;
- Mistral CPU: `Q4_K_M`.

For each quantization, preserve the exact argv and log, and bind:

- intermediate GGUF SHA-256;
- `llama-quantize` SHA-256;
- output GGUF SHA-256 and byte size;
- runtime class and quantization identity.

## 9. Assemble the external bundle

The external original root contains at least:

```text
original/
  sources/<model>/...
  legal/LICENSE.txt
  legal/review.json
  evidence/remote-inventory.json
  toolchain/package.tar.zst
  toolchain/build-manifest.json
  toolchain/verification-report.json
  toolchain/bin/llama-cli
  toolchain/bin/llama-server
  toolchain/bin/llama-quantize
  toolchain/bin/llama-bench
  toolchain/source/convert_hf_to_gguf.py
  conversion/python-dependencies.txt
  conversion/convert.log
  quantization/*.log
  artifacts/*.gguf
  storage/payload-index.json
  storage/upload-record.json
  storage/restore-record.json
  storage/bundle.tar.zst
```

Create `bundle.v2.json` outside the archive construction process so no self-referential digest is required. Every declared file path must be unique and bounded beneath the root. Symlinks, non-regular files and hard-link aliases are forbidden.

## 10. Upload immutably and restore independently

Upload the bundle archive to content-addressed or versioned external storage. Record an immutable locator containing a digest or storage version. Preserve the upload receipt.

Download from that locator into a clean restore root, extract it, and preserve the restore record. Do not copy the original directory to manufacture restore evidence. The restore root must originate from the immutable external object.

## 11. Run fail-closed verification

```bash
cd apps/tai
python -m tai.model_artifact_registry_cli verify-bundle-v2 \
  model-artifacts/model-bundle-authority.v2.json \
  "$TAI_WORK/<model>/bundle.v2.json" \
  "$TAI_WORK/<model>/original" \
  "$TAI_WORK/<model>/restore" \
  --output "$TAI_WORK/<model>/verification-report.v2.json"
```

Exit code `0` and status `VERIFIED` are required. Exit code `2`, `PENDING_ACQUISITION`, `REJECTED`, parser failure, missing evidence or any original/restore mismatch blocks acceptance.

## 12. Publish the acceptance PR

The acceptance PR commits only small records:

- immutable locator;
- archive SHA-256 and size;
- authority, manifest and verification-report SHA-256;
- exact-main commit and workflow run identity;
- final `VERIFIED` status;
- issue linkage.

Do not commit model weights, GGUF files, binaries, source archives, license evidence containing restricted material, logs with secrets or storage credentials.

The acceptance PR does not assert AP-13C benchmark performance, AP-13D admission or production readiness. TAI remains `NOT_ATTESTED` until all later gates are complete.
