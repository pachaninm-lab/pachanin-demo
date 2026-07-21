from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import BinaryIO

_DEFAULT_PART_SIZE = 64 * 1024 * 1024
_CHUNK_SIZE = 1024 * 1024


def _read_part(stream: BinaryIO, part_size: int) -> bytes:
    chunks: list[bytes] = []
    remaining = part_size
    while remaining > 0:
        chunk = stream.read(min(remaining, _CHUNK_SIZE))
        if not chunk:
            break
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def _aws(
    *,
    endpoint: str,
    region: str,
    arguments: list[str],
) -> dict[str, object]:
    command = [
        "aws",
        "--endpoint-url",
        endpoint,
        "--region",
        region,
        "--cli-connect-timeout",
        "30",
        "--cli-read-timeout",
        "21600",
        *arguments,
        "--output",
        "json",
    ]
    completed = subprocess.run(
        command,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if completed.returncode != 0:
        stderr = completed.stderr.decode("utf-8", errors="replace")[-2000:]
        raise RuntimeError(f"AWS CLI failed with code {completed.returncode}: {stderr}")
    if not completed.stdout.strip():
        return {}
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError("AWS CLI returned invalid JSON") from error
    if not isinstance(payload, dict):
        raise RuntimeError("AWS CLI JSON root must be an object")
    return payload


def _abort(
    *,
    endpoint: str,
    region: str,
    bucket: str,
    key: str,
    upload_id: str,
) -> None:
    _aws(
        endpoint=endpoint,
        region=region,
        arguments=[
            "s3api",
            "abort-multipart-upload",
            "--bucket",
            bucket,
            "--key",
            key,
            "--upload-id",
            upload_id,
        ],
    )


def upload_stream(
    *,
    stream: BinaryIO,
    endpoint: str,
    region: str,
    bucket: str,
    key: str,
    work_root: Path,
    expected_sha256: str,
    expected_size_bytes: int,
    part_size_bytes: int = _DEFAULT_PART_SIZE,
) -> dict[str, object]:
    if len(expected_sha256) != 64 or any(
        character not in "0123456789abcdef" for character in expected_sha256
    ):
        raise ValueError("expected SHA-256 must be lowercase hexadecimal")
    if expected_size_bytes < 1:
        raise ValueError("expected size must be positive")
    if part_size_bytes < 5 * 1024 * 1024:
        raise ValueError("multipart part size must be at least 5 MiB")
    work_root.mkdir(parents=True, exist_ok=True, mode=0o700)
    if work_root.is_symlink():
        raise ValueError("multipart work root must not be a symlink")

    created = _aws(
        endpoint=endpoint,
        region=region,
        arguments=[
            "s3api",
            "create-multipart-upload",
            "--bucket",
            bucket,
            "--key",
            key,
            "--content-type",
            "application/x-tar",
        ],
    )
    upload_id = created.get("UploadId")
    if not isinstance(upload_id, str) or not upload_id:
        raise RuntimeError("multipart upload id is absent")

    digest = hashlib.sha256()
    total_size = 0
    completed_parts: list[dict[str, object]] = []
    try:
        part_number = 1
        while True:
            part = _read_part(stream, part_size_bytes)
            if not part:
                break
            digest.update(part)
            total_size += len(part)
            with tempfile.NamedTemporaryFile(
                mode="wb",
                prefix=f"part-{part_number:05d}-",
                suffix=".bin",
                dir=work_root,
                delete=False,
            ) as handle:
                handle.write(part)
                part_path = Path(handle.name)
            os.chmod(part_path, 0o600)
            try:
                uploaded = _aws(
                    endpoint=endpoint,
                    region=region,
                    arguments=[
                        "s3api",
                        "upload-part",
                        "--bucket",
                        bucket,
                        "--key",
                        key,
                        "--part-number",
                        str(part_number),
                        "--upload-id",
                        upload_id,
                        "--body",
                        str(part_path),
                    ],
                )
            finally:
                part_path.unlink(missing_ok=True)
            etag = uploaded.get("ETag")
            if not isinstance(etag, str) or not etag:
                raise RuntimeError(f"multipart part ETag is absent: {part_number}")
            completed_parts.append({"ETag": etag, "PartNumber": part_number})
            part_number += 1

        if not completed_parts:
            raise RuntimeError("refusing to complete an empty multipart upload")
        second_stream_sha256 = digest.hexdigest()
        if total_size != expected_size_bytes:
            raise RuntimeError(
                "second archive stream size drift before completion: "
                f"expected={expected_size_bytes} actual={total_size}"
            )
        if second_stream_sha256 != expected_sha256:
            raise RuntimeError(
                "second archive stream SHA-256 drift before completion: "
                f"expected={expected_sha256} actual={second_stream_sha256}"
            )

        completion_path = work_root / "complete-multipart-upload.json"
        completion_path.write_text(
            json.dumps({"Parts": completed_parts}, separators=(",", ":"), sort_keys=True),
            encoding="utf-8",
        )
        os.chmod(completion_path, 0o600)
        try:
            completed = _aws(
                endpoint=endpoint,
                region=region,
                arguments=[
                    "s3api",
                    "complete-multipart-upload",
                    "--bucket",
                    bucket,
                    "--key",
                    key,
                    "--upload-id",
                    upload_id,
                    "--multipart-upload",
                    f"file://{completion_path}",
                ],
            )
        finally:
            completion_path.unlink(missing_ok=True)
    except Exception:
        try:
            _abort(
                endpoint=endpoint,
                region=region,
                bucket=bucket,
                key=key,
                upload_id=upload_id,
            )
        except Exception:
            pass
        raise

    version_id = completed.get("VersionId")
    etag = completed.get("ETag")
    if not isinstance(version_id, str) or not version_id:
        raise RuntimeError("completed object VersionId is absent")
    if not isinstance(etag, str) or not etag:
        raise RuntimeError("completed object ETag is absent")
    return {
        "schema_version": "tai.model-bundle-multipart-upload.v1",
        "status": "COMPLETE",
        "bucket": bucket,
        "key": key,
        "upload_id": upload_id,
        "part_count": len(completed_parts),
        "part_size_bytes": part_size_bytes,
        "archive_size_bytes": total_size,
        "first_stream_sha256": expected_sha256,
        "second_stream_sha256": second_stream_sha256,
        "version_id": version_id,
        "etag": etag,
        "completed_only_after_stream_match": True,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Upload a TAI archive stream with pre-completion digest binding"
    )
    parser.add_argument("--endpoint", required=True)
    parser.add_argument("--region", required=True)
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--key", required=True)
    parser.add_argument("--work-root", required=True, type=Path)
    parser.add_argument("--expected-sha256", required=True)
    parser.add_argument("--expected-size-bytes", required=True, type=int)
    parser.add_argument("--part-size-bytes", type=int, default=_DEFAULT_PART_SIZE)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        report = upload_stream(
            stream=sys.stdin.buffer,
            endpoint=args.endpoint,
            region=args.region,
            bucket=args.bucket,
            key=args.key,
            work_root=args.work_root,
            expected_sha256=args.expected_sha256,
            expected_size_bytes=args.expected_size_bytes,
            part_size_bytes=args.part_size_bytes,
        )
    except (OSError, RuntimeError, ValueError, subprocess.SubprocessError) as error:
        report = {
            "schema_version": "tai.model-bundle-multipart-upload-error.v1",
            "status": "FAILED_CLOSED",
            "reason": str(error)[:2000],
            "completed_object": False,
            "production_operational_status": "NOT_ATTESTED",
        }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        return 2
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
