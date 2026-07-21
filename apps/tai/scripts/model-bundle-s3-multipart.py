#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import urllib.parse
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import BinaryIO

_DEFAULT_PART_SIZE = 64 * 1024 * 1024


def _read_part(stream: BinaryIO, part_size: int) -> bytes:
    chunks: list[bytes] = []
    remaining = part_size
    while remaining > 0:
        chunk = stream.read(remaining)
        if not chunk:
            break
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def _object_url(endpoint: str, bucket: str, key: str) -> str:
    return (
        endpoint.rstrip("/")
        + "/"
        + urllib.parse.quote(bucket, safe="")
        + "/"
        + urllib.parse.quote(key, safe="/")
    )


def _query_url(base: str, parameters: dict[str, str | None]) -> str:
    parts: list[str] = []
    for key, value in parameters.items():
        encoded = urllib.parse.quote(key, safe="")
        if value is None:
            parts.append(encoded)
        else:
            parts.append(encoded + "=" + urllib.parse.quote(value, safe=""))
    return base + "?" + "&".join(parts)


def _curl(config: Path, arguments: list[str], *, input_path: Path | None = None) -> bytes:
    command = ["curl", "--config", str(config), *arguments]
    if input_path is not None:
        command.extend(["--upload-file", str(input_path)])
    completed = subprocess.run(
        command,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if completed.returncode != 0:
        error = completed.stderr.decode("utf-8", errors="replace")[-2000:]
        raise RuntimeError(f"curl failed with code {completed.returncode}: {error}")
    return completed.stdout


def _xml_text(payload: bytes, local_name: str) -> str:
    try:
        root = ET.fromstring(payload)
    except ET.ParseError as error:
        raise RuntimeError("S3 returned invalid XML") from error
    for element in root.iter():
        if element.tag.rsplit("}", 1)[-1] == local_name and element.text:
            return element.text
    raise RuntimeError(f"S3 XML field is missing: {local_name}")


def _headers(path: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    for line in path.read_text(encoding="iso-8859-1").splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        result[key.strip().lower()] = value.strip()
    return result


def multipart_upload(
    *,
    endpoint: str,
    bucket: str,
    key: str,
    config: Path,
    work_root: Path,
    stream: BinaryIO,
    part_size: int,
    expected_sha256: str,
    expected_size_bytes: int,
) -> dict[str, object]:
    if part_size < 5 * 1024 * 1024:
        raise ValueError("multipart part size must be at least 5 MiB")
    if len(expected_sha256) != 64 or any(
        character not in "0123456789abcdef" for character in expected_sha256
    ):
        raise ValueError("expected SHA-256 must be lowercase hexadecimal")
    if expected_size_bytes < 1:
        raise ValueError("expected size must be positive")
    base = _object_url(endpoint, bucket, key)
    create_url = _query_url(base, {"uploads": None})
    create = _curl(config, ["--request", "POST", "--data", "", create_url])
    upload_id = _xml_text(create, "UploadId")
    parts: list[dict[str, object]] = []
    total = 0
    digest = hashlib.sha256()
    work_root.mkdir(parents=True, exist_ok=True)
    try:
        number = 1
        while True:
            chunk = _read_part(stream, part_size)
            if not chunk:
                break
            digest.update(chunk)
            with tempfile.NamedTemporaryFile(
                prefix=f"part-{number:05d}-",
                suffix=".bin",
                dir=work_root,
                delete=False,
            ) as handle:
                handle.write(chunk)
                part_path = Path(handle.name)
            os.chmod(part_path, 0o600)
            header_path = work_root / f"part-{number:05d}.headers"
            try:
                part_url = _query_url(
                    base,
                    {"partNumber": str(number), "uploadId": upload_id},
                )
                _curl(
                    config,
                    [
                        "--request",
                        "PUT",
                        "--dump-header",
                        str(header_path),
                        "--output",
                        os.devnull,
                        part_url,
                    ],
                    input_path=part_path,
                )
                headers = _headers(header_path)
                etag = headers.get("etag", "").strip('"')
                if not etag:
                    raise RuntimeError("multipart part ETag is absent")
                parts.append({"PartNumber": number, "ETag": etag})
                total += len(chunk)
                number += 1
            finally:
                part_path.unlink(missing_ok=True)
                header_path.unlink(missing_ok=True)
        if not parts:
            raise RuntimeError("refusing to upload an empty archive")
        actual_sha256 = digest.hexdigest()
        if total != expected_size_bytes:
            raise RuntimeError(
                f"archive size drift before multipart completion: "
                f"expected={expected_size_bytes} actual={total}"
            )
        if actual_sha256 != expected_sha256:
            raise RuntimeError(
                f"archive SHA-256 drift before multipart completion: "
                f"expected={expected_sha256} actual={actual_sha256}"
            )

        complete_payload = ET.Element("CompleteMultipartUpload")
        for part in parts:
            entry = ET.SubElement(complete_payload, "Part")
            ET.SubElement(entry, "PartNumber").text = str(part["PartNumber"])
            ET.SubElement(entry, "ETag").text = f'"{part["ETag"]}"'
        complete_bytes = ET.tostring(complete_payload, encoding="utf-8", xml_declaration=True)
        complete_path = work_root / "complete-multipart.xml"
        complete_path.write_bytes(complete_bytes)
        os.chmod(complete_path, 0o600)
        try:
            complete_url = _query_url(base, {"uploadId": upload_id})
            response = _curl(
                config,
                [
                    "--request",
                    "POST",
                    "--header",
                    "Content-Type: application/xml",
                    "--data-binary",
                    f"@{complete_path}",
                    complete_url,
                ],
            )
        finally:
            complete_path.unlink(missing_ok=True)
        etag = _xml_text(response, "ETag").strip('"')
        return {
            "schema_version": "tai.s3-multipart-upload.v1",
            "status": "COMPLETE",
            "bucket": bucket,
            "object_key": key,
            "object_url": base,
            "upload_id": upload_id,
            "part_count": len(parts),
            "size_bytes": total,
            "sha256": actual_sha256,
            "etag": etag,
        }
    except Exception:
        abort_url = _query_url(base, {"uploadId": upload_id})
        try:
            _curl(config, ["--request", "DELETE", "--output", os.devnull, abort_url])
        except Exception:
            pass
        raise


def head_object(
    *,
    endpoint: str,
    bucket: str,
    key: str,
    config: Path,
    work_root: Path,
    version_id: str | None,
) -> dict[str, object]:
    base = _object_url(endpoint, bucket, key)
    url = base if version_id is None else _query_url(base, {"versionId": version_id})
    work_root.mkdir(parents=True, exist_ok=True)
    header_path = work_root / "head-object.headers"
    try:
        _curl(
            config,
            [
                "--head",
                "--dump-header",
                str(header_path),
                "--output",
                os.devnull,
                url,
            ],
        )
        headers = _headers(header_path)
    finally:
        header_path.unlink(missing_ok=True)
    observed_version = headers.get("x-amz-version-id", "")
    if not observed_version:
        raise RuntimeError("S3 object VersionId is absent")
    content_length = headers.get("content-length", "")
    if not content_length.isdigit():
        raise RuntimeError("S3 object Content-Length is invalid")
    etag = headers.get("etag", "").strip('"')
    if not etag:
        raise RuntimeError("S3 object ETag is absent")
    return {
        "schema_version": "tai.s3-head-object.v1",
        "status": "VERIFIED",
        "bucket": bucket,
        "object_key": key,
        "object_url": base,
        "version_id": observed_version,
        "etag": etag,
        "size_bytes": int(content_length),
        "last_modified": headers.get("last-modified"),
        "object_lock_mode": headers.get("x-amz-object-lock-mode"),
        "retain_until_date": headers.get("x-amz-object-lock-retain-until-date"),
    }


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.chmod(path, 0o600)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Bounded curl/SigV4 S3 transport")
    commands = parser.add_subparsers(dest="command", required=True)

    upload = commands.add_parser("upload")
    upload.add_argument("--endpoint", required=True)
    upload.add_argument("--bucket", required=True)
    upload.add_argument("--key", required=True)
    upload.add_argument("--curl-config", required=True, type=Path)
    upload.add_argument("--work-root", required=True, type=Path)
    upload.add_argument("--part-size", type=int, default=_DEFAULT_PART_SIZE)
    upload.add_argument("--expected-sha256", required=True)
    upload.add_argument("--expected-size-bytes", required=True, type=int)
    upload.add_argument("--output", required=True, type=Path)

    head = commands.add_parser("head")
    head.add_argument("--endpoint", required=True)
    head.add_argument("--bucket", required=True)
    head.add_argument("--key", required=True)
    head.add_argument("--version-id")
    head.add_argument("--curl-config", required=True, type=Path)
    head.add_argument("--work-root", required=True, type=Path)
    head.add_argument("--output", required=True, type=Path)

    args = parser.parse_args(argv)
    try:
        if args.command == "upload":
            result = multipart_upload(
                endpoint=args.endpoint,
                bucket=args.bucket,
                key=args.key,
                config=args.curl_config,
                work_root=args.work_root,
                stream=sys.stdin.buffer,
                part_size=args.part_size,
                expected_sha256=args.expected_sha256,
                expected_size_bytes=args.expected_size_bytes,
            )
        else:
            result = head_object(
                endpoint=args.endpoint,
                bucket=args.bucket,
                key=args.key,
                config=args.curl_config,
                work_root=args.work_root,
                version_id=args.version_id,
            )
        _write(args.output, result)
    except (OSError, RuntimeError, ValueError, subprocess.SubprocessError) as error:
        failure = {
            "schema_version": "tai.s3-transport-error.v1",
            "status": "FAILED_CLOSED",
            "reason": str(error)[:2000],
        }
        _write(args.output, failure)
        print(json.dumps(failure, sort_keys=True), file=sys.stderr)
        return 2
    print(json.dumps(result, separators=(",", ":"), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
