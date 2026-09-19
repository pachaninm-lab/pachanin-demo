#!/usr/bin/env python3
"""Fail-closed intake for the official FGIS Grain API 1.0.23 archive.

The script discovers the package from the operator's API page, validates every
redirect, downloads with a bounded streaming hash, inspects the ZIP without
extracting executable content, validates XML/XSD/WSDL references and writes
machine-readable evidence. It never performs a live FGIS API call.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import mimetypes
import os
import posixpath
import re
import stat
import sys
import tempfile
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from typing import Any, BinaryIO, Iterable
from xml.etree import ElementTree as ET

MAX_PAGE_BYTES = 4 * 1024 * 1024
MAX_ARCHIVE_BYTES = 128 * 1024 * 1024
MAX_ENTRY_COUNT = 20_000
MAX_ENTRY_BYTES = 128 * 1024 * 1024
MAX_TOTAL_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024
MAX_COMPRESSION_RATIO = 250.0
MAX_REDIRECTS = 8
READ_CHUNK_BYTES = 1024 * 1024
ZIP_MAGIC = (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
EXECUTABLE_SUFFIXES = {
    ".apk",
    ".app",
    ".bat",
    ".class",
    ".cmd",
    ".com",
    ".deb",
    ".dll",
    ".dylib",
    ".exe",
    ".jar",
    ".msi",
    ".ps1",
    ".rpm",
    ".scr",
    ".sh",
    ".so",
}
XML_SUFFIXES = {".xml", ".xsd", ".wsdl"}
DOCUMENT_SUFFIXES = {".doc", ".docx", ".md", ".odt", ".pdf", ".rtf", ".txt"}
REFERENCE_SUFFIXES = {".csv", ".json", ".ods", ".xlsx", ".yaml", ".yml"}
ALLOWED_CONTENT_TYPES = {
    "application/octet-stream",
    "application/x-zip-compressed",
    "application/zip",
}
USER_AGENT = "TransparentPrice-PC-CROP-08A/1.0 (+https://github.com/pachaninm-lab/pachanin-demo)"


class IntakeError(RuntimeError):
    """A fail-closed artifact intake rejection."""


class LinkCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        for key, value in attrs:
            if key.lower() == "href" and value:
                self.links.append(value.strip())


@dataclass(frozen=True)
class FetchResult:
    requested_url: str
    final_url: str
    content_type: str
    content_length: int
    redirects: tuple[str, ...]


@dataclass(frozen=True)
class PackageDownload:
    fetch: FetchResult
    sha256: str
    size_bytes: int
    path: Path


class AllowlistedRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, allowed_hosts: set[str]) -> None:
        super().__init__()
        self.allowed_hosts = allowed_hosts
        self.redirects: list[str] = []

    def redirect_request(  # type: ignore[override]
        self,
        req: urllib.request.Request,
        fp: BinaryIO,
        code: int,
        msg: str,
        headers: Any,
        newurl: str,
    ) -> urllib.request.Request | None:
        absolute = urllib.parse.urljoin(req.full_url, newurl)
        validate_https_url(absolute, self.allowed_hosts)
        self.redirects.append(absolute)
        if len(self.redirects) > MAX_REDIRECTS:
            raise IntakeError("redirect limit exceeded")
        return super().redirect_request(req, fp, code, msg, headers, absolute)


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def write_json(path: Path, value: Any) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    path.write_text(data, encoding="utf-8")
    return sha256_bytes(canonical_json_bytes(value))


def validate_https_url(url: str, allowed_hosts: set[str]) -> urllib.parse.ParseResult:
    parsed = urllib.parse.urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https":
        raise IntakeError(f"non-HTTPS URL rejected: {url}")
    if not host or host not in allowed_hosts:
        raise IntakeError(f"URL host is not allowlisted: {host or '<missing>'}")
    if parsed.username or parsed.password:
        raise IntakeError("userinfo in URL is forbidden")
    if parsed.fragment:
        raise IntakeError("URL fragments are forbidden")
    return parsed


def build_opener(allowed_hosts: set[str]) -> tuple[urllib.request.OpenerDirector, AllowlistedRedirectHandler]:
    handler = AllowlistedRedirectHandler(allowed_hosts)
    return urllib.request.build_opener(handler), handler


def request(url: str) -> urllib.request.Request:
    return urllib.request.Request(
        url,
        headers={
            "Accept": "*/*",
            "Accept-Encoding": "identity",
            "Cache-Control": "no-cache",
            "User-Agent": USER_AGENT,
        },
        method="GET",
    )


def read_bounded(response: BinaryIO, maximum: int) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = response.read(min(READ_CHUNK_BYTES, maximum - total + 1))
        if not chunk:
            break
        total += len(chunk)
        if total > maximum:
            raise IntakeError(f"response exceeds {maximum} bytes")
        chunks.append(chunk)
    return b"".join(chunks)


def fetch_operator_page(url: str, allowed_hosts: set[str]) -> tuple[str, bytes, tuple[str, ...]]:
    validate_https_url(url, allowed_hosts)
    opener, redirects = build_opener(allowed_hosts)
    try:
        with opener.open(request(url), timeout=45) as response:
            final_url = response.geturl()
            validate_https_url(final_url, allowed_hosts)
            content_type = response.headers.get_content_type().lower()
            if content_type not in {"text/html", "application/xhtml+xml"}:
                raise IntakeError(f"operator page returned unexpected content type: {content_type}")
            return final_url, read_bounded(response, MAX_PAGE_BYTES), tuple(redirects.redirects)
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise IntakeError(f"operator page fetch failed: {error}") from error


def discover_artifact_url(page_url: str, html: bytes, expected_filename: str) -> str:
    parser = LinkCollector()
    try:
        parser.feed(html.decode("utf-8", errors="strict"))
    except UnicodeDecodeError:
        parser.feed(html.decode("utf-8", errors="replace"))
    matches: set[str] = set()
    for href in parser.links:
        candidate = urllib.parse.urljoin(page_url, href)
        parsed = urllib.parse.urlparse(candidate)
        filename = PurePosixPath(urllib.parse.unquote(parsed.path)).name
        if filename == expected_filename:
            matches.add(candidate)
    if len(matches) != 1:
        raise IntakeError(
            f"expected exactly one link for {expected_filename}, found {len(matches)}"
        )
    return next(iter(matches))


def parse_content_length(value: str | None) -> int | None:
    if value is None or not value.strip():
        return None
    try:
        parsed = int(value)
    except ValueError as error:
        raise IntakeError("invalid Content-Length") from error
    if parsed < 0:
        raise IntakeError("negative Content-Length")
    return parsed


def download_package(
    url: str,
    allowed_hosts: set[str],
    destination: Path,
) -> PackageDownload:
    validate_https_url(url, allowed_hosts)
    opener, redirects = build_opener(allowed_hosts)
    destination.parent.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256()
    total = 0
    first_bytes = bytearray()
    try:
        with opener.open(request(url), timeout=90) as response:
            final_url = response.geturl()
            validate_https_url(final_url, allowed_hosts)
            content_type = response.headers.get_content_type().lower()
            if content_type not in ALLOWED_CONTENT_TYPES:
                raise IntakeError(f"artifact returned unexpected content type: {content_type}")
            declared_length = parse_content_length(response.headers.get("Content-Length"))
            if declared_length is not None and declared_length > MAX_ARCHIVE_BYTES:
                raise IntakeError("declared archive size exceeds limit")
            with destination.open("wb") as output:
                while True:
                    chunk = response.read(READ_CHUNK_BYTES)
                    if not chunk:
                        break
                    if len(first_bytes) < 4:
                        first_bytes.extend(chunk[: 4 - len(first_bytes)])
                    total += len(chunk)
                    if total > MAX_ARCHIVE_BYTES:
                        raise IntakeError("downloaded archive size exceeds limit")
                    digest.update(chunk)
                    output.write(chunk)
                output.flush()
                os.fsync(output.fileno())
            if declared_length is not None and total != declared_length:
                raise IntakeError(
                    f"Content-Length mismatch: declared {declared_length}, received {total}"
                )
            if not any(bytes(first_bytes).startswith(magic) for magic in ZIP_MAGIC):
                raise IntakeError("downloaded artifact is not a ZIP file")
            return PackageDownload(
                fetch=FetchResult(
                    requested_url=url,
                    final_url=final_url,
                    content_type=content_type,
                    content_length=total,
                    redirects=tuple(redirects.redirects),
                ),
                sha256=digest.hexdigest(),
                size_bytes=total,
                path=destination,
            )
    except (urllib.error.URLError, TimeoutError, OSError, zipfile.BadZipFile) as error:
        destination.unlink(missing_ok=True)
        raise IntakeError(f"artifact download failed: {error}") from error


def normalized_zip_path(name: str) -> tuple[str, bool]:
    if "\x00" in name:
        raise IntakeError("NUL byte in ZIP entry path")
    if "\\" in name:
        raise IntakeError(f"backslash in ZIP entry path: {name}")
    normalized_unicode = unicodedata.normalize("NFC", name)
    is_directory = normalized_unicode.endswith("/")
    candidate = normalized_unicode[:-1] if is_directory else normalized_unicode
    if not candidate:
        raise IntakeError("empty ZIP entry path")
    if candidate.startswith("/"):
        raise IntakeError(f"absolute ZIP entry path: {name}")
    parts = PurePosixPath(candidate).parts
    if not parts or any(part in {"", ".", ".."} for part in parts):
        raise IntakeError(f"unsafe ZIP entry path: {name}")
    normalized = posixpath.normpath("/".join(parts))
    if normalized == ".." or normalized.startswith("../"):
        raise IntakeError(f"path traversal in ZIP entry: {name}")
    return normalized, is_directory


def category_for(path: str, is_directory: bool) -> str:
    if is_directory:
        return "directory"
    suffix = PurePosixPath(path).suffix.lower()
    if suffix == ".xsd":
        return "xsd"
    if suffix == ".wsdl":
        return "wsdl"
    if suffix == ".xml":
        return "xml"
    if suffix in DOCUMENT_SUFFIXES:
        return "document"
    if suffix in REFERENCE_SUFFIXES:
        return "reference"
    return "other"


def validate_zip_info(info: zipfile.ZipInfo, seen_paths: set[str]) -> tuple[str, bool]:
    path, is_directory = normalized_zip_path(info.filename)
    collision_key = path.casefold()
    if collision_key in seen_paths:
        raise IntakeError(f"duplicate or case-colliding ZIP entry: {path}")
    seen_paths.add(collision_key)
    if info.flag_bits & 0x1:
        raise IntakeError(f"encrypted ZIP entry rejected: {path}")
    mode = (info.external_attr >> 16) & 0xFFFF
    if mode and stat.S_ISLNK(mode):
        raise IntakeError(f"symbolic link rejected: {path}")
    if not is_directory and PurePosixPath(path).suffix.lower() in EXECUTABLE_SUFFIXES:
        raise IntakeError(f"executable payload rejected: {path}")
    if info.file_size < 0 or info.compress_size < 0:
        raise IntakeError(f"negative ZIP entry size: {path}")
    if info.file_size > MAX_ENTRY_BYTES:
        raise IntakeError(f"ZIP entry exceeds size limit: {path}")
    if info.file_size > 0:
        ratio = info.file_size / max(info.compress_size, 1)
        if ratio > MAX_COMPRESSION_RATIO:
            raise IntakeError(f"ZIP compression ratio exceeds limit: {path}")
    return path, is_directory


def read_zip_entry(archive: zipfile.ZipFile, info: zipfile.ZipInfo) -> bytes:
    digest_buffer = io.BytesIO()
    total = 0
    with archive.open(info, "r") as source:
        while True:
            chunk = source.read(READ_CHUNK_BYTES)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_ENTRY_BYTES or total > info.file_size:
                raise IntakeError(f"ZIP entry expanded beyond declared size: {info.filename}")
            digest_buffer.write(chunk)
    if total != info.file_size:
        raise IntakeError(f"ZIP entry size mismatch: {info.filename}")
    return digest_buffer.getvalue()


def xml_local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def parse_xml_contract(path: str, data: bytes, available_paths: set[str]) -> dict[str, Any]:
    upper = data.upper()
    if b"<!DOCTYPE" in upper or b"<!ENTITY" in upper:
        raise IntakeError(f"DTD/entity declaration rejected: {path}")
    try:
        root = ET.fromstring(data)
        namespace_events = ET.iterparse(io.BytesIO(data), events=("start-ns",))
        namespaces = sorted({uri for _event, (_prefix, uri) in namespace_events if uri})
    except ET.ParseError as error:
        raise IntakeError(f"XML parsing failed for {path}: {error}") from error

    references: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []
    current_dir = posixpath.dirname(path)
    for element in root.iter():
        kind = xml_local_name(str(element.tag))
        if kind not in {"import", "include", "redefine"}:
            continue
        location = element.attrib.get("schemaLocation") or element.attrib.get("location")
        namespace = element.attrib.get("namespace")
        reference: dict[str, Any] = {
            "kind": kind,
            "namespace": namespace,
            "location": location,
            "resolved": True,
            "resolvedPath": None,
            "external": False,
        }
        if location:
            parsed = urllib.parse.urlparse(location)
            if parsed.scheme or parsed.netloc:
                reference["external"] = True
                reference["resolved"] = False
                unresolved.append({"path": path, "kind": kind, "location": location})
            else:
                decoded = urllib.parse.unquote(location)
                resolved = posixpath.normpath(posixpath.join(current_dir, decoded))
                if resolved == ".." or resolved.startswith("../") or resolved.startswith("/"):
                    reference["resolved"] = False
                    unresolved.append({"path": path, "kind": kind, "location": location})
                else:
                    reference["resolvedPath"] = resolved
                    if resolved.casefold() not in available_paths:
                        reference["resolved"] = False
                        unresolved.append(
                            {
                                "path": path,
                                "kind": kind,
                                "location": location,
                                "resolvedPath": resolved,
                            }
                        )
        references.append(reference)

    return {
        "root": str(root.tag),
        "namespaces": namespaces,
        "references": references,
        "unresolvedReferences": unresolved,
    }


def inspect_archive(package: PackageDownload, version: str) -> tuple[dict[str, Any], dict[str, Any]]:
    try:
        archive = zipfile.ZipFile(package.path, "r")
    except zipfile.BadZipFile as error:
        raise IntakeError(f"invalid ZIP central directory: {error}") from error

    with archive:
        infos = archive.infolist()
        if not infos:
            raise IntakeError("archive is empty")
        if len(infos) > MAX_ENTRY_COUNT:
            raise IntakeError("archive entry count exceeds limit")
        seen_paths: set[str] = set()
        prepared: list[tuple[zipfile.ZipInfo, str, bool]] = []
        total_uncompressed = 0
        for info in infos:
            path, is_directory = validate_zip_info(info, seen_paths)
            total_uncompressed += info.file_size
            if total_uncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES:
                raise IntakeError("total uncompressed archive size exceeds limit")
            prepared.append((info, path, is_directory))

        available_paths = {path.casefold() for _info, path, _is_dir in prepared}
        entries: list[dict[str, Any]] = []
        schema_entries: list[dict[str, Any]] = []
        all_unresolved: list[dict[str, Any]] = []
        all_namespaces: set[str] = set()
        categories: Counter[str] = Counter()

        for info, path, is_directory in sorted(prepared, key=lambda row: row[1].casefold()):
            category = category_for(path, is_directory)
            categories[category] += 1
            entry: dict[str, Any] = {
                "path": path,
                "directory": is_directory,
                "category": category,
                "sizeBytes": info.file_size,
                "compressedSizeBytes": info.compress_size,
                "compressionMethod": info.compress_type,
                "mediaType": None if is_directory else (mimetypes.guess_type(path)[0] or "application/octet-stream"),
                "sha256": None,
            }
            if not is_directory:
                data = read_zip_entry(archive, info)
                entry["sha256"] = sha256_bytes(data)
                if PurePosixPath(path).suffix.lower() in XML_SUFFIXES:
                    xml_contract = parse_xml_contract(path, data, available_paths)
                    all_namespaces.update(xml_contract["namespaces"])
                    all_unresolved.extend(xml_contract["unresolvedReferences"])
                    schema_entries.append(
                        {
                            "path": path,
                            "category": category,
                            "sha256": entry["sha256"],
                            "sizeBytes": info.file_size,
                            **xml_contract,
                        }
                    )
            entries.append(entry)

        if all_unresolved:
            raise IntakeError(
                f"schema package contains {len(all_unresolved)} unresolved reference(s)"
            )

        inventory = {
            "schemaVersion": "pc-crop.fgis-grain-artifact-inventory.v1",
            "apiVersion": version,
            "package": {
                "filename": package.path.name,
                "sha256": package.sha256,
                "sizeBytes": package.size_bytes,
                "contentType": package.fetch.content_type,
                "sourceUrl": package.fetch.requested_url,
                "finalUrl": package.fetch.final_url,
                "redirects": list(package.fetch.redirects),
            },
            "entryCount": len(entries),
            "fileCount": sum(1 for entry in entries if not entry["directory"]),
            "totalUncompressedBytes": total_uncompressed,
            "categories": dict(sorted(categories.items())),
            "entries": entries,
        }
        schema_manifest = {
            "schemaVersion": "pc-crop.fgis-grain-schema-manifest.v1",
            "apiVersion": version,
            "packageSha256": package.sha256,
            "schemaCount": len(schema_entries),
            "namespaceCount": len(all_namespaces),
            "namespaces": sorted(all_namespaces),
            "unresolvedReferenceCount": 0,
            "unresolvedReferences": [],
            "schemas": schema_entries,
        }
        return inventory, schema_manifest


def load_lock(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise IntakeError(f"source lock cannot be read: {error}") from error
    if not isinstance(value, dict):
        raise IntakeError("source lock must be a JSON object")
    required = {
        "version",
        "status",
        "sourcePageUrl",
        "expectedFilename",
        "allowedPageHosts",
        "allowedArtifactHosts",
    }
    missing = sorted(required - value.keys())
    if missing:
        raise IntakeError(f"source lock is missing fields: {', '.join(missing)}")
    if value["status"] not in {"DISCOVERY_REQUIRED", "PINNED"}:
        raise IntakeError("source lock status is invalid")
    for field in ("allowedPageHosts", "allowedArtifactHosts"):
        hosts = value[field]
        if not isinstance(hosts, list) or not hosts or not all(isinstance(host, str) and host for host in hosts):
            raise IntakeError(f"source lock {field} must be a non-empty string array")
    return value


def enforce_lock(
    lock: dict[str, Any],
    package: PackageDownload,
    inventory_sha256: str,
    schema_manifest_sha256: str,
) -> bool:
    if lock["status"] == "DISCOVERY_REQUIRED":
        return False
    expected = lock.get("packageSha256")
    if not isinstance(expected, str) or not SHA256_RE.fullmatch(expected):
        raise IntakeError("pinned source lock has no valid package SHA-256")
    if package.sha256 != expected:
        raise IntakeError(
            f"package SHA-256 mismatch: expected {expected}, received {package.sha256}"
        )
    final_url = lock.get("finalArtifactUrl")
    if not isinstance(final_url, str) or package.fetch.final_url != final_url:
        raise IntakeError("final artifact URL does not match the pinned lock")
    expected_size = lock.get("artifactSizeBytes")
    if not isinstance(expected_size, int) or package.size_bytes != expected_size:
        raise IntakeError("artifact size does not match the pinned lock")
    if lock.get("inventorySha256") != inventory_sha256:
        raise IntakeError("inventory SHA-256 does not match the pinned lock")
    if lock.get("schemaManifestSha256") != schema_manifest_sha256:
        raise IntakeError("schema manifest SHA-256 does not match the pinned lock")
    return True


def run(lock_path: Path, output_dir: Path, exact_head: str) -> dict[str, Any]:
    lock = load_lock(lock_path)
    version = str(lock["version"])
    expected_filename = str(lock["expectedFilename"])
    page_hosts = {str(host).lower() for host in lock["allowedPageHosts"]}
    artifact_hosts = {str(host).lower() for host in lock["allowedArtifactHosts"]}
    source_page = str(lock["sourcePageUrl"])

    output_dir.mkdir(parents=True, exist_ok=True)
    final_page, html, page_redirects = fetch_operator_page(source_page, page_hosts)
    discovered_url = discover_artifact_url(final_page, html, expected_filename)
    parsed_artifact = validate_https_url(discovered_url, artifact_hosts)
    if PurePosixPath(urllib.parse.unquote(parsed_artifact.path)).name != expected_filename:
        raise IntakeError("discovered artifact filename does not match the source lock")

    package_path = output_dir / expected_filename
    package = download_package(discovered_url, artifact_hosts, package_path)
    inventory, schema_manifest = inspect_archive(package, version)
    inventory_sha256 = write_json(output_dir / "artifact-inventory.json", inventory)
    schema_manifest_sha256 = write_json(output_dir / "schema-manifest.json", schema_manifest)
    pin_verified = enforce_lock(lock, package, inventory_sha256, schema_manifest_sha256)

    acceptance = {
        "schemaVersion": "pc-crop.fgis-grain-artifact-intake-acceptance.v1",
        "slice": "PC-CROP-08A",
        "issue": 3155,
        "apiVersion": version,
        "exactHead": exact_head,
        "status": "PASS" if pin_verified else "DISCOVERY_PASS",
        "operationalStatus": "NOT_ATTESTED",
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "operatorPageRequestedUrl": source_page,
            "operatorPageFinalUrl": final_page,
            "operatorPageRedirects": list(page_redirects),
            "artifactDiscoveredUrl": discovered_url,
            "artifactFinalUrl": package.fetch.final_url,
            "artifactRedirects": list(package.fetch.redirects),
        },
        "artifact": {
            "filename": expected_filename,
            "sha256": package.sha256,
            "sizeBytes": package.size_bytes,
            "contentType": package.fetch.content_type,
            "inventorySha256": inventory_sha256,
            "schemaManifestSha256": schema_manifest_sha256,
        },
        "inventory": {
            "entryCount": inventory["entryCount"],
            "fileCount": inventory["fileCount"],
            "totalUncompressedBytes": inventory["totalUncompressedBytes"],
            "categories": inventory["categories"],
            "schemaCount": schema_manifest["schemaCount"],
            "namespaceCount": schema_manifest["namespaceCount"],
            "unresolvedReferenceCount": schema_manifest["unresolvedReferenceCount"],
        },
        "invariants": {
            "officialOperatorSourceOnly": True,
            "httpsRedirectAllowlist": True,
            "boundedStreamingDownload": True,
            "zipPathTraversalRejected": True,
            "zipBombBounded": True,
            "encryptedArchiveRejected": True,
            "symlinkRejected": True,
            "executablePayloadRejected": True,
            "xmlDtdAndEntityRejected": True,
            "schemaReferencesResolved": True,
            "packagePinVerified": pin_verified,
        },
        "boundaries": {
            "binaryArchiveCommittedToGit": False,
            "handwrittenEndpointOrFieldMapping": False,
            "liveCredentialOrCertificateUse": False,
            "externalProductionApiCall": False,
            "confirmedLiveClaim": False,
            "secondInboxOutboxOrRelay": False,
            "productionDeployment": False,
            "productionHosting": "REG_RU_VPS_ONLY",
        },
    }
    write_json(output_dir / "pc-crop-08a-acceptance.json", acceptance)
    return acceptance


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lock-file", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--exact-head", default=os.environ.get("GITHUB_SHA", "UNKNOWN"))
    args = parser.parse_args(list(argv) if argv is not None else None)

    try:
        acceptance = run(args.lock_file, args.output_dir, args.exact_head)
    except IntakeError as error:
        args.output_dir.mkdir(parents=True, exist_ok=True)
        failure = {
            "schemaVersion": "pc-crop.fgis-grain-artifact-intake-acceptance.v1",
            "slice": "PC-CROP-08A",
            "issue": 3155,
            "exactHead": args.exact_head,
            "status": "FAIL",
            "operationalStatus": "NOT_ATTESTED",
            "error": str(error),
        }
        write_json(args.output_dir / "pc-crop-08a-acceptance.json", failure)
        print(json.dumps(failure, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1

    print(json.dumps(acceptance, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
