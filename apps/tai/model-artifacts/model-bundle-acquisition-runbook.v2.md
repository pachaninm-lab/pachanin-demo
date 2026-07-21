# AP-13B.3 model bundle acquisition, immutable storage and restore verification

## Purpose

This runbook creates external, reproducible model-bundle evidence governed by `model-bundle-authority.v2.json`. It does not admit a model, publish benchmark results or change production readiness. Model weights, source files, GGUF files, binaries and archives remain outside Git.

## Preconditions

1. The exact model revision has verified source acquisition evidence.
2. A human legal review is `APPROVED_FOR_CONVERSION` for that exact revision and intended use.
3. The accepted llama.cpp package is `VERIFIED_RESTORED` for release `b9637`, commit `aedb2a5e9ca3d4064148bbb919e0ddc0c1b70ab3`.
4. Conversion and every registered quantization completed with exit code `0`, exact argv, logs, sizes and SHA-256.
5. The controlled workspace has sufficient capacity for the original payload, one content-addressed archive and one clean restore root.
6. The storage destination is outside the conversion run root and exposes an immutable version or content-addressed locator.

No branch, mutable tag, community GGUF, copied web hash or inferred legal approval may be substituted.

## Non-self-referential storage contract

A model bundle consists of two layers:

### Payload layer

The payload archive contains only files that define and reproduce the model bundle:

```text
sources/<model>/...
evidence/remote-inventory.json
legal/LICENSE.txt
legal/review.json
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
artifacts/<intermediate>.gguf
quantization/*.log
artifacts/<quantized>.gguf
```

### Storage sidecar layer

The following files are outside the payload archive:

```text
storage/bundle.tar
storage/payload-index.json
storage/upload-record.json
storage/restore-record.json
```

This separation is mandatory. The archive cannot contain itself, and upload/restore records containing the archive digest cannot participate in that archive digest.

## 1. Build the exact payload index

Create `storage/payload-index.json` with schema `tai.model-bundle-payload-index.v1`:

```json
{
  "schema_version": "tai.model-bundle-payload-index.v1",
  "model_id": "<exact model id>",
  "revision": "<exact 40-character revision>",
  "entries": [
    {"path": "...", "sha256": "...", "size_bytes": 1}
  ]
}
```

Requirements:

- entries are sorted by path;
- the set equals every non-storage `DeclaredFile` in `bundle.v2.json`;
- no storage sidecar path is present;
- paths are bounded relative paths;
- symlinks, hard-link aliases and non-regular files are forbidden;
- SHA-256 and byte size are calculated from local bytes.

## 2. Create the payload archive

Create a regular tar archive containing exactly the payload-index entries. Do not add directory entries, symlinks, hard links, devices, FIFOs, absolute paths, `..` paths, duplicate paths or undeclared files.

For large safetensor and GGUF payloads, an uncompressed deterministic tar is permitted because these formats are generally not materially compressible. The archive name may be `storage/bundle.tar`.

Hash the completed archive locally and record its exact byte size. Do not modify it after its digest is recorded.

## 3. Upload to immutable storage

Upload the archive to content-addressed or versioned storage outside the conversion run root. The immutable locator must bind the exact archive SHA-256 using `@sha256:`, `#sha256=` or a version identifier.

Create `storage/upload-record.json` with schema `tai.model-bundle-upload-record.v1`, exact archive SHA-256, locator, timezone-aware `uploaded_at`, positive `retention_days`, and `retention_expires_at = uploaded_at + retention_days`.

The archive and upload record are sidecars; neither is an archive member.

## 4. Restore independently

1. Create a new empty restore root.
2. Download the archive from the immutable locator; do not read it from the original bundle directory.
3. Verify the downloaded archive SHA-256 before extraction.
4. Inspect all archive entries fail-closed before extraction.
5. Extract only regular bounded payload files into the clean restore root.
6. Do not copy the original root and do not add storage sidecars to the restore root.
7. Create `storage/restore-record.json` outside the restored payload with schema `tai.model-bundle-restore-record.v1`, exact archive SHA-256, immutable locator and timezone-aware `restored_at` within retention.

A copied original directory contains storage sidecars and must fail exact restored-file-set validation.

## 5. Run both verification layers

The storage verifier validates:

- exact original file set: payload plus four storage sidecars;
- exact payload-index semantics;
- original payload hashes and sizes;
- exact safe archive member set and member hashes;
- exact clean restored payload set and hashes;
- absence of storage sidecars in the restored payload;
- existing v2 authority, source, legal, toolchain, conversion and quantization semantics through the legacy verifier.

```bash
cd apps/tai
python -m tai.model_bundle_storage_cli \
  model-artifacts/model-bundle-authority.v2.json \
  /secure/<model>/bundle.v2.json \
  /secure/<model>/original \
  /secure/<model>/restore \
  --output /secure/<model>/storage-verification-report.v1.json
```

Exit code `0` and status `VERIFIED` are required. Exit code `2`, `REJECTED`, parser failure, missing evidence, archive mismatch, unsafe archive member, copied restore, extra file or original/restore mismatch blocks acceptance.

The existing command remains available for semantic diagnosis, but it must not be used alone as proof that a clean root originated from a non-self-referential immutable archive:

```bash
python -m tai.model_artifact_registry_cli verify-bundle-v2 \
  model-artifacts/model-bundle-authority.v2.json \
  /secure/<model>/bundle.v2.json \
  /secure/<model>/original \
  /secure/<model>/compatibility-restore \
  --output /secure/<model>/legacy-verification-report.v2.json
```

## 6. Publish acceptance metadata

The acceptance PR commits only small records:

- model id, role and exact revision;
- immutable locator;
- archive SHA-256 and size;
- payload-index SHA-256;
- manifest SHA-256;
- legacy v2 report SHA-256;
- storage-verification report SHA-256;
- exact-main and workflow run identity;
- final bundle status `VERIFIED`;
- issue linkage.

Never commit source/model/GGUF bytes, binaries, large archives, restricted license material, credentials or secret-bearing logs.

## Maturity boundary

Successful bundle storage and restore verification does not constitute AP-13C benchmark acceptance, AP-13D model admission or production operational attestation. `production_operational_status` remains `NOT_ATTESTED`.
