from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from tai.model_bundle_finalize import (
    complete_storage_manifest,
    extract_streamed_archive,
    hash_stream,
    prepare_model_bundle,
    validate_finalization_authority,
)


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Governed TAI model-bundle finalization")
    commands = parser.add_subparsers(dest="command", required=True)

    validate = commands.add_parser("validate-authority")
    validate.add_argument("authority", type=Path)
    validate.add_argument("--output", required=True, type=Path)

    prepare = commands.add_parser("prepare-model")
    prepare.add_argument("finalization_authority", type=Path)
    prepare.add_argument("bundle_authority", type=Path)
    prepare.add_argument("conversion_authority", type=Path)
    prepare.add_argument("toolchain_acceptance", type=Path)
    prepare.add_argument("source_evidence_root", type=Path)
    prepare.add_argument("legal_review_record", type=Path)
    prepare.add_argument("license_text", type=Path)
    prepare.add_argument("conversion_root", type=Path)
    prepare.add_argument("toolchain_extract_root", type=Path)
    prepare.add_argument("model_key")
    prepare.add_argument("original_root", type=Path)
    prepare.add_argument("--output", required=True, type=Path)

    hash_command = commands.add_parser("hash-stream")
    hash_command.add_argument("--output", required=True, type=Path)

    extract = commands.add_parser("extract-stream")
    extract.add_argument("payload_index", type=Path)
    extract.add_argument("restore_root", type=Path)
    extract.add_argument("--output", required=True, type=Path)

    complete = commands.add_parser("complete-storage")
    complete.add_argument("state", type=Path)
    complete.add_argument("original_root", type=Path)
    complete.add_argument("--archive-sha256", required=True)
    complete.add_argument("--archive-size-bytes", required=True, type=int)
    complete.add_argument("--endpoint", required=True)
    complete.add_argument("--region", required=True)
    complete.add_argument("--bucket", required=True)
    complete.add_argument("--object-key", required=True)
    complete.add_argument("--version-id", required=True)
    complete.add_argument("--etag", required=True)
    complete.add_argument("--uploaded-at", required=True)
    complete.add_argument("--retention-days", required=True, type=int)
    complete.add_argument("--retention-expires-at", required=True)
    complete.add_argument("--restored-at", required=True)
    complete.add_argument("--manifest", required=True, type=Path)
    complete.add_argument("--output", required=True, type=Path)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.command == "validate-authority":
            payload = validate_finalization_authority(args.authority)
            authority_result = payload.get("result")
            if not isinstance(authority_result, dict):
                raise ValueError("authority result must be an object")
            result = {
                "schema_version": "tai.model-bundle-finalization-authority-report.v1",
                "status": "VALID",
                "issue": payload["issue"],
                "command": payload["command"],
                "production_operational_status": authority_result.get(
                    "production_operational_status"
                ),
                "reasons": [],
            }
            _write(args.output, result)
        elif args.command == "prepare-model":
            result = prepare_model_bundle(
                finalization_authority_path=args.finalization_authority,
                bundle_authority_path=args.bundle_authority,
                conversion_authority_path=args.conversion_authority,
                toolchain_acceptance_path=args.toolchain_acceptance,
                source_evidence_root=args.source_evidence_root,
                legal_review_record_path=args.legal_review_record,
                license_text_path=args.license_text,
                conversion_root=args.conversion_root,
                toolchain_extract_root=args.toolchain_extract_root,
                model_key=args.model_key,
                original_root=args.original_root,
                state_output=args.output,
            )
        elif args.command == "hash-stream":
            digest = hash_stream(sys.stdin.buffer)
            result = {
                "schema_version": "tai.model-bundle-stream-digest.v1",
                "status": "HASHED",
                "sha256": digest.sha256,
                "size_bytes": digest.size_bytes,
            }
            _write(args.output, result)
        elif args.command == "extract-stream":
            result = extract_streamed_archive(
                payload_index_path=args.payload_index,
                restore_root=args.restore_root,
                stream=sys.stdin.buffer,
            )
            _write(args.output, result)
        elif args.command == "complete-storage":
            result = complete_storage_manifest(
                state_path=args.state,
                original_root=args.original_root,
                archive_sha256=args.archive_sha256,
                archive_size_bytes=args.archive_size_bytes,
                endpoint=args.endpoint,
                region=args.region,
                bucket=args.bucket,
                object_key=args.object_key,
                version_id=args.version_id,
                etag=args.etag,
                uploaded_at=args.uploaded_at,
                retention_days=args.retention_days,
                retention_expires_at=args.retention_expires_at,
                restored_at=args.restored_at,
                output_manifest=args.manifest,
            )
            _write(args.output, result)
        else:
            raise AssertionError("unsupported command")
    except (OSError, ValueError, KeyError, TypeError) as error:
        failure = {
            "schema_version": "tai.model-bundle-finalization-error.v1",
            "status": "FAILED_CLOSED",
            "reason": str(error)[:1000],
            "benchmark_status": "NOT_RUN",
            "model_admission_status": "NOT_DONE",
            "production_operational_status": "NOT_ATTESTED",
        }
        output = getattr(args, "output", None)
        if isinstance(output, Path):
            _write(output, failure)
        print(json.dumps(failure, ensure_ascii=False, sort_keys=True), file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":"), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
