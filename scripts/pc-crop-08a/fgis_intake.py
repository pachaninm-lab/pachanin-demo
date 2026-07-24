#!/usr/bin/env python3
"""Governed intake for the official FGIS Grain API 1.0.23 package.

Uses only the Python standard library so the exact-head acceptance does not
depend on a mutable third-party parser or archive package.
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
import tempfile
import unicodedata
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable
from xml.etree import ElementTree as ET

MAX_PAGE_BYTES = 2 * 1024 * 1024
MAX_ARCHIVE_BYTES = 20 * 1024 * 1024
MAX_ENTRIES = 5_000
MAX_ENTRY_BYTES = 25 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
MAX_COMPRESSION_RATIO = 200.0

XML_EXTENSIONS = {".xsd", ".wsdl", ".xml"}
EXECUTABLE_EXTENSIONS = {
    ".app", ".bat", ".bin", ".class", ".cmd", ".com", ".cpl", ".dll",
    ".dmg", ".exe", ".gadget", ".hta", ".inf", ".ins", ".ipa", ".iso",
    ".jar", ".js", ".jse", ".ksh", ".lnk", ".macho", ".msi", ".msp",
    ".mst", ".pif", ".ps1", ".reg", ".scr", ".sh", ".so", ".sys", ".vb",
    ".vbe", ".vbs", ".vhd", ".vhdx", ".vxd", ".ws", ".wsc", ".wsf",
    ".wsh",
}

XSD_NS = "http://www.w3.org/2001/XMLSchema"
WSDL11_NS = "http://schemas.xmlsoap.org/wsdl/"
WSDL20_NS = "http://www.w3.org/ns/wsdl"


class IntakeError(RuntimeError):
    """Fail-closed contract intake error."""


def canonical_json_bytes(value: Any) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        .encode("utf-8")
    )


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(canonical_json_bytes(value) + b"\n")


def validate_https_url(url: str, allowed_hosts: Iterable[str]) -> urllib.parse.ParseResult:
    parsed = urllib.parse.urlparse(url)
    host = (parsed.hostname or "").lower()
    allowed = {item.lower() for item in allowed_hosts}
    if parsed.scheme.lower() != "https":
        raise IntakeError(f"Only HTTPS is allowed: {url}")
    if parsed.username or parsed.password:
        raise IntakeError(f"Credentials in URL are forbidden: {url}")
    if parsed.port not in (None, 443):
        raise IntakeError(f"Non-standard HTTPS port is forbidden: {url}")
    if host not in allowed:
        raise IntakeError(f"Host is outside the allowlist: {host}")
    if parsed.fragment:
        raise IntakeError(f"URL fragments are forbidden: {url}")
    return parsed


class AllowlistRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, allowed_hosts: Iterable[str]) -> None:
        super().__init__()
        self.allowed_hosts = tuple(allowed_hosts)

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_https_url(newurl, self.allowed_hosts)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch_bytes(
    url: str,
    allowed_hosts: Iterable[str],
    max_bytes: int,
) -> tuple[bytes, str, str | None]:
    validate_https_url(url, allowed_hosts)
    opener = urllib.request.build_opener(AllowlistRedirectHandler(allowed_hosts))
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Prozrachnaya-Cena-PC-CROP-08A/1.0",
            "Accept": "text/html,application/zip,application/octet-stream;q=0.9,*/*;q=0.1",
        },
        method="GET",
    )
    with opener.open(request, timeout=60) as response:
        final_url = response.geturl()
        validate_https_url(final_url, allowed_hosts)
        content_type = response.headers.get_content_type()
        declared = response.headers.get("Content-Length")
        if declared is not None:
            try:
                declared_size = int(declared)
            except ValueError as exc:
                raise IntakeError("Invalid Content-Length") from exc
            if declared_size > max_bytes:
                raise IntakeError(
                    f"Response exceeds declared size limit: {declared_size} > {max_bytes}"
                )
        chunks: list[bytes] = []
        total = 0
        while True:
            chunk = response.read(min(1024 * 1024, max_bytes + 1 - total))
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                raise IntakeError(f"Response exceeds size limit: {max_bytes}")
            chunks.append(chunk)
    return b"".join(chunks), final_url, content_type


class LinkCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._href: str | None = None
        self._text: list[str] = []
        self.links: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a" or self._href is not None:
            return
        attributes = {key.lower(): value for key, value in attrs}
        href = attributes.get("href")
        if href:
            self._href = href
            self._text = []

    def handle_data(self, data: str) -> None:
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._href is not None:
            text = " ".join("".join(self._text).split())
            self.links.append((self._href, text))
            self._href = None
            self._text = []


def select_artifact_url(
    page_bytes: bytes,
    page_final_url: str,
    expected_filename: str,
    version: str,
) -> str:
    try:
        page_text = page_bytes.decode("utf-8")
    except UnicodeDecodeError:
        page_text = page_bytes.decode("utf-8", errors="replace")
    parser = LinkCollector()
    parser.feed(page_text)

    exact: list[str] = []
    version_candidates: list[str] = []
    for href, text in parser.links:
        resolved = urllib.parse.urljoin(page_final_url, href)
        basename = posixpath.basename(urllib.parse.urlparse(resolved).path)
        if basename == expected_filename:
            exact.append(resolved)
        elif version in text and "api" in text.casefold():
            version_candidates.append(resolved)

    candidates = sorted(set(exact or version_candidates))
    if len(candidates) != 1:
        raise IntakeError(
            f"Expected exactly one API {version} artifact link; found {len(candidates)}"
        )
    return candidates[0]


def normalize_zip_path(raw_name: str) -> str:
    if not raw_name or "\x00" in raw_name:
        raise IntakeError("ZIP entry has an empty or NUL-containing path")
    if "\\" in raw_name:
        raise IntakeError(f"Backslashes are forbidden in ZIP paths: {raw_name}")
    normalized_unicode = unicodedata.normalize("NFC", raw_name)
    if normalized_unicode.startswith("/") or re.match(r"^[A-Za-z]:", normalized_unicode):
        raise IntakeError(f"Absolute ZIP path is forbidden: {raw_name}")

    is_dir = normalized_unicode.endswith("/")
    trimmed = normalized_unicode[:-1] if is_dir else normalized_unicode
    normalized = posixpath.normpath(trimmed)
    if normalized in ("", ".") or normalized == ".." or normalized.startswith("../"):
        raise IntakeError(f"Path traversal is forbidden: {raw_name}")
    if any(part in ("", ".", "..") for part in normalized.split("/")):
        raise IntakeError(f"Unsafe ZIP path segments: {raw_name}")
    return normalized + ("/" if is_dir else "")


def entry_category(path: str, is_dir: bool) -> str:
    if is_dir:
        return "directory"
    suffix = Path(path).suffix.casefold()
    if suffix == ".xsd":
        return "xsd"
    if suffix == ".wsdl":
        return "wsdl"
    if suffix == ".xml":
        return "xml"
    if suffix in {".pdf", ".doc", ".docx", ".odt", ".rtf", ".txt", ".md"}:
        return "document"
    if suffix in {".json", ".yaml", ".yml", ".csv", ".xlsx"}:
        return "reference"
    return "other"


def media_type(path: str, is_dir: bool) -> str:
    if is_dir:
        return "inode/directory"
    suffix = Path(path).suffix.casefold()
    if suffix in XML_EXTENSIONS:
        return "application/xml"
    guessed, _ = mimetypes.guess_type(path)
    return guessed or "application/octet-stream"


def validate_zip_info(info: zipfile.ZipInfo, normalized_path: str) -> None:
    if info.flag_bits & 0x1:
        raise IntakeError(f"Encrypted ZIP entry is forbidden: {normalized_path}")

    unix_mode = (info.external_attr >> 16) & 0xFFFF
    file_type = stat.S_IFMT(unix_mode)
    if file_type == stat.S_IFLNK:
        raise IntakeError(f"Symlink ZIP entry is forbidden: {normalized_path}")
    if file_type not in (0, stat.S_IFREG, stat.S_IFDIR):
        raise IntakeError(f"Special ZIP entry is forbidden: {normalized_path}")
    if file_type != stat.S_IFDIR and unix_mode and (unix_mode & 0o111):
        raise IntakeError(f"Executable mode is forbidden: {normalized_path}")

    suffix = Path(normalized_path.rstrip("/")).suffix.casefold()
    if suffix in EXECUTABLE_EXTENSIONS:
        raise IntakeError(f"Executable payload is forbidden: {normalized_path}")


def inspect_archive(archive_bytes: bytes) -> tuple[list[dict[str, Any]], dict[str, bytes]]:
    if len(archive_bytes) > MAX_ARCHIVE_BYTES:
        raise IntakeError("Archive exceeds the compressed size limit")
    if not zipfile.is_zipfile(io.BytesIO(archive_bytes)):
        raise IntakeError("Artifact is not a valid ZIP archive")

    inventory: list[dict[str, Any]] = []
    xml_entries: dict[str, bytes] = {}
    seen: set[str] = set()
    total_uncompressed = 0

    with zipfile.ZipFile(io.BytesIO(archive_bytes), "r") as archive:
        infos = archive.infolist()
        if not infos or len(infos) > MAX_ENTRIES:
            raise IntakeError(f"Invalid ZIP entry count: {len(infos)}")

        for info in infos:
            normalized = normalize_zip_path(info.filename)
            collision_key = normalized.rstrip("/").casefold()
            if collision_key in seen:
                raise IntakeError(f"Duplicate or case-colliding ZIP path: {normalized}")
            seen.add(collision_key)
            validate_zip_info(info, normalized)

            is_dir = info.is_dir() or normalized.endswith("/")
            if is_dir:
                inventory.append(
                    {
                        "path": normalized,
                        "isDirectory": True,
                        "compressedSizeBytes": 0,
                        "sizeBytes": 0,
                        "sha256": None,
                        "mediaType": media_type(normalized, True),
                        "category": entry_category(normalized, True),
                    }
                )
                continue

            if info.file_size > MAX_ENTRY_BYTES:
                raise IntakeError(f"ZIP entry exceeds size limit: {normalized}")
            total_uncompressed += info.file_size
            if total_uncompressed > MAX_UNCOMPRESSED_BYTES:
                raise IntakeError("ZIP exceeds total uncompressed size limit")
            if info.file_size and info.compress_size == 0:
                raise IntakeError(f"Invalid zero compressed size: {normalized}")
            ratio = info.file_size / max(info.compress_size, 1)
            if ratio > MAX_COMPRESSION_RATIO:
                raise IntakeError(
                    f"ZIP compression ratio exceeds limit for {normalized}: {ratio:.2f}"
                )

            with archive.open(info, "r") as stream:
                data = stream.read(MAX_ENTRY_BYTES + 1)
            if len(data) != info.file_size:
                raise IntakeError(f"ZIP entry size or CRC mismatch: {normalized}")

            digest = sha256_bytes(data)
            category = entry_category(normalized, False)
            inventory.append(
                {
                    "path": normalized,
                    "isDirectory": False,
                    "compressedSizeBytes": info.compress_size,
                    "sizeBytes": info.file_size,
                    "sha256": digest,
                    "mediaType": media_type(normalized, False),
                    "category": category,
                }
            )
            if category in {"xsd", "wsdl", "xml"}:
                xml_entries[normalized] = data

    inventory.sort(key=lambda entry: entry["path"])
    return inventory, xml_entries


def _element_local_name(tag: str) -> tuple[str | None, str]:
    if tag.startswith("{") and "}" in tag:
        namespace, local = tag[1:].split("}", 1)
        return namespace, local
    return None, tag


def _resolve_reference(source_path: str, location: str, available_paths: set[str]) -> dict[str, Any]:
    parsed = urllib.parse.urlparse(location)
    if parsed.scheme or parsed.netloc:
        return {
            "location": location,
            "resolvedPath": None,
            "resolution": "EXTERNAL_UNRESOLVED",
        }
    clean = urllib.parse.unquote(parsed.path)
    resolved = posixpath.normpath(posixpath.join(posixpath.dirname(source_path), clean))
    if resolved.startswith("../") or resolved == "..":
        return {
            "location": location,
            "resolvedPath": resolved,
            "resolution": "OUTSIDE_PACKAGE",
        }
    return {
        "location": location,
        "resolvedPath": resolved,
        "resolution": "RESOLVED" if resolved in available_paths else "MISSING",
    }


def analyze_xml_entries(
    xml_entries: dict[str, bytes],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    available_paths = set(xml_entries)
    files: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []

    for path in sorted(xml_entries):
        data = xml_entries[path]
        upper = data.upper()
        if b"<!DOCTYPE" in upper or b"<!ENTITY" in upper:
            raise IntakeError(f"DTD/entity declarations are forbidden: {path}")

        namespaces: set[tuple[str, str]] = set()
        try:
            for event, item in ET.iterparse(io.BytesIO(data), events=("start-ns",)):
                del event
                prefix, uri = item
                namespaces.add((prefix or "", uri))
            root = ET.fromstring(data)
        except ET.ParseError as exc:
            raise IntakeError(f"XML is not well-formed: {path}: {exc}") from exc

        references: list[dict[str, Any]] = []
        for element in root.iter():
            namespace, local = _element_local_name(element.tag)
            location: str | None = None
            ref_type: str | None = None
            if namespace == XSD_NS and local in {"import", "include", "redefine"}:
                location = element.attrib.get("schemaLocation")
                ref_type = f"xsd:{local}"
            elif namespace in {WSDL11_NS, WSDL20_NS} and local == "import":
                location = element.attrib.get("location")
                ref_type = "wsdl:import"

            if ref_type is None:
                continue
            if not location:
                reference = {
                    "type": ref_type,
                    "location": None,
                    "resolvedPath": None,
                    "resolution": "NAMESPACE_ONLY",
                }
            else:
                reference = {
                    "type": ref_type,
                    **_resolve_reference(path, location, available_paths),
                }
            references.append(reference)
            if reference["resolution"] not in {"RESOLVED", "NAMESPACE_ONLY"}:
                unresolved.append({"sourcePath": path, **reference})

        references.sort(
            key=lambda ref: (
                ref["type"],
                ref.get("location") or "",
                ref.get("resolvedPath") or "",
            )
        )
        root_namespace, root_local = _element_local_name(root.tag)
        files.append(
            {
                "path": path,
                "sha256": sha256_bytes(data),
                "root": {"namespace": root_namespace, "localName": root_local},
                "namespaces": [
                    {"prefix": prefix, "uri": uri}
                    for prefix, uri in sorted(namespaces)
                ],
                "references": references,
            }
        )

    unresolved.sort(
        key=lambda ref: (
            ref["sourcePath"],
            ref["type"],
            ref.get("location") or "",
        )
    )
    return files, unresolved


def build_outputs(
    source_lock: dict[str, Any],
    output_dir: Path,
    *,
    page_bytes: bytes,
    page_final_url: str,
    page_content_type: str | None,
    artifact_bytes: bytes,
    artifact_url: str,
    artifact_final_url: str,
    artifact_content_type: str | None,
) -> dict[str, Any]:
    version = source_lock["version"]
    package_sha = sha256_bytes(artifact_bytes)
    inventory_entries, xml_entries = inspect_archive(artifact_bytes)

    with tempfile.TemporaryDirectory(prefix="pc-crop-08a-xml-") as temp:
        extraction_root = Path(temp)
        for path, data in xml_entries.items():
            target = extraction_root.joinpath(*path.split("/"))
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        schema_files, unresolved = analyze_xml_entries(
            {
                path: extraction_root.joinpath(*path.split("/")).read_bytes()
                for path in sorted(xml_entries)
            }
        )

    inventory = {
        "schemaVersion": "pc-crop.fgis-grain-inventory.v1",
        "version": version,
        "packageSha256": package_sha,
        "entries": inventory_entries,
    }
    schema_manifest = {
        "schemaVersion": "pc-crop.fgis-grain-schema-manifest.v1",
        "version": version,
        "packageSha256": package_sha,
        "files": schema_files,
        "unresolvedReferences": unresolved,
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    archive_path = output_dir / source_lock["expectedFilename"]
    archive_path.write_bytes(artifact_bytes)
    inventory_path = output_dir / "inventory.json"
    schema_path = output_dir / "schema-manifest.json"
    write_json(inventory_path, inventory)
    write_json(schema_path, schema_manifest)

    summary = {
        "schemaVersion": "pc-crop.fgis-grain-intake-summary.v1",
        "version": version,
        "sourcePageUrl": source_lock["sourcePageUrl"],
        "sourcePageFinalUrl": page_final_url,
        "sourcePageContentType": page_content_type,
        "artifactUrl": artifact_url,
        "finalArtifactUrl": artifact_final_url,
        "artifactContentType": artifact_content_type,
        "artifactSizeBytes": len(artifact_bytes),
        "packageSha256": package_sha,
        "inventorySha256": sha256_file(inventory_path),
        "schemaManifestSha256": sha256_file(schema_path),
        "entryCount": len(inventory_entries),
        "fileCount": sum(not entry["isDirectory"] for entry in inventory_entries),
        "totalUncompressedSizeBytes": sum(
            entry["sizeBytes"] for entry in inventory_entries
        ),
        "schemaCount": len(schema_files),
        "unresolvedReferenceCount": len(unresolved),
        "pinRequired": source_lock.get("status") != "PINNED",
    }
    write_json(output_dir / "intake-summary.json", summary)
    write_json(
        output_dir / "source-evidence.json",
        {
            **summary,
            "retrievedAt": datetime.now(timezone.utc).isoformat(),
            "sourcePageSha256": sha256_bytes(page_bytes),
        },
    )
    return summary


def run(source_lock_path: Path, output_dir: Path) -> dict[str, Any]:
    source_lock = json.loads(source_lock_path.read_text("utf-8"))
    if source_lock.get("version") != "1.0.23":
        raise IntakeError("This governed intake only accepts API version 1.0.23")

    page_bytes, page_final_url, page_content_type = fetch_bytes(
        source_lock["sourcePageUrl"],
        source_lock["allowedPageHosts"],
        MAX_PAGE_BYTES,
    )
    if page_content_type not in {"text/html", "application/xhtml+xml"}:
        raise IntakeError(f"Unexpected source page content type: {page_content_type}")

    artifact_url = select_artifact_url(
        page_bytes,
        page_final_url,
        source_lock["expectedFilename"],
        source_lock["version"],
    )
    validate_https_url(artifact_url, source_lock["allowedArtifactHosts"])
    artifact_bytes, artifact_final_url, artifact_content_type = fetch_bytes(
        artifact_url,
        source_lock["allowedArtifactHosts"],
        MAX_ARCHIVE_BYTES,
    )
    if artifact_content_type not in {
        "application/zip",
        "application/octet-stream",
        "application/x-zip-compressed",
    }:
        raise IntakeError(f"Unexpected artifact content type: {artifact_content_type}")
    if posixpath.basename(urllib.parse.urlparse(artifact_final_url).path) != source_lock[
        "expectedFilename"
    ]:
        raise IntakeError("Final artifact filename does not match the governed lock")

    return build_outputs(
        source_lock,
        output_dir,
        page_bytes=page_bytes,
        page_final_url=page_final_url,
        page_content_type=page_content_type,
        artifact_bytes=artifact_bytes,
        artifact_url=artifact_url,
        artifact_final_url=artifact_final_url,
        artifact_content_type=artifact_content_type,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-lock", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        summary = run(args.source_lock, args.output)
    except (IntakeError, OSError, KeyError, json.JSONDecodeError) as exc:
        print(f"PC-CROP-08A intake failed: {exc}", file=os.sys.stderr)
        return 1
    print(json.dumps(summary, ensure_ascii=False, sort_keys=True, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
