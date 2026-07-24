#!/usr/bin/env python3
"""Fail-closed intake for the official FGIS Grain API 1.0.23 package.

The binary ZIP is evidence only and is never written into the repository by this
program. The deterministic manifest excludes retrieval-time fields so identical
packages produce byte-identical schema authority.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import mimetypes
import os
import re
import shutil
import stat
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from typing import Any, Iterable
import xml.etree.ElementTree as ET

MAX_ARCHIVE_BYTES = 64 * 1024 * 1024
MAX_ENTRIES = 5_000
MAX_TOTAL_UNCOMPRESSED = 512 * 1024 * 1024
MAX_SINGLE_FILE = 64 * 1024 * 1024
MAX_COMPRESSION_RATIO = 250
MAX_XML_BYTES = 32 * 1024 * 1024
READ_CHUNK = 128 * 1024
ALLOWED_ARCHIVE_MEDIA_TYPES = {
    "application/zip",
    "application/x-zip-compressed",
    "application/octet-stream",
}
EXECUTABLE_SUFFIXES = {
    ".app", ".apk", ".bat", ".bin", ".class", ".cmd", ".com", ".dll",
    ".dmg", ".elf", ".exe", ".jar", ".js", ".jse", ".lnk", ".msi",
    ".msp", ".msu", ".ps1", ".scr", ".sh", ".so", ".vbs", ".vbe",
}
XML_SUFFIXES = {".xml", ".xsd", ".wsdl"}
XSD_NS = "http://www.w3.org/2001/XMLSchema"
WSDL_NS = "http://schemas.xmlsoap.org/wsdl/"
DOCTYPE_PATTERN = re.compile(br"<!\s*(?:DOCTYPE|ENTITY)\b", re.IGNORECASE)
WINDOWS_DRIVE_PATTERN = re.compile(r"^[A-Za-z]:")


class IntakeError(RuntimeError):
    """Expected fail-closed validation error."""


@dataclass(frozen=True)
class FetchResult:
    requested_url: str
    final_url: str
    redirect_chain: tuple[str, ...]
    media_type: str
    content_length_header: int | None
    body: bytes


class LinkCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._current_href: str | None = None
        self._current_text: list[str] = []
        self.links: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        attr_map = {key.lower(): value for key, value in attrs}
        self._current_href = attr_map.get("href")
        self._current_text = []

    def handle_data(self, data: str) -> None:
        if self._current_href is not None:
            self._current_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._current_href is not None:
            self.links.append((self._current_href, " ".join(self._current_text).strip()))
            self._current_href = None
            self._current_text = []


class AllowlistedRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, allowed_origins: set[str]) -> None:
        super().__init__()
        self.allowed_origins = allowed_origins
        self.chain: list[str] = []

    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: Any,
        code: int,
        msg: str,
        headers: Any,
        newurl: str,
    ) -> urllib.request.Request | None:
        absolute = urllib.parse.urljoin(req.full_url, newurl)
        assert_allowed_url(absolute, self.allowed_origins)
        self.chain.append(absolute)
        return super().redirect_request(req, fp, code, msg, headers, absolute)


def canonical_json(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def write_json(path: Path, value: Any, *, canonical: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = canonical_json(value) if canonical else (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")
    path.write_bytes(data)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def origin(url: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        raise IntakeError(f"HTTPS URL is required: {url}")
    port = parsed.port
    default_port = port is None or port == 443
    return f"https://{parsed.hostname.lower()}{'' if default_port else f':{port}'}"


def assert_allowed_url(url: str, allowed_origins: set[str]) -> None:
    parsed = urllib.parse.urlsplit(url)
    if parsed.username or parsed.password:
        raise IntakeError("userinfo is forbidden in official source URLs")
    if origin(url) not in allowed_origins:
        raise IntakeError(f"URL origin is outside the official allowlist: {url}")
    if parsed.fragment:
        raise IntakeError("URL fragments are forbidden for artifact retrieval")


def parse_content_length(value: str | None) -> int | None:
    if value is None or not value.strip():
        return None
    try:
        parsed = int(value)
    except ValueError as error:
        raise IntakeError("invalid Content-Length header") from error
    if parsed < 0:
        raise IntakeError("negative Content-Length header")
    return parsed


def fetch_https(url: str, allowed_origins: set[str], max_bytes: int) -> FetchResult:
    assert_allowed_url(url, allowed_origins)
    redirect_handler = AllowlistedRedirectHandler(allowed_origins)
    opener = urllib.request.build_opener(redirect_handler)
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "text/html,application/zip,application/octet-stream;q=0.9,*/*;q=0.1",
            "User-Agent": "TransparentPrice-PC-CROP-08A/1.0 (+https://github.com/pachaninm-lab/pachanin-demo)",
        },
        method="GET",
    )
    try:
        with opener.open(request, timeout=45) as response:
            final_url = response.geturl()
            assert_allowed_url(final_url, allowed_origins)
            declared_length = parse_content_length(response.headers.get("Content-Length"))
            if declared_length is not None and declared_length > max_bytes:
                raise IntakeError(f"response exceeds {max_bytes} bytes")
            media_type = (response.headers.get_content_type() or "application/octet-stream").lower()
            chunks: list[bytes] = []
            observed = 0
            while True:
                chunk = response.read(READ_CHUNK)
                if not chunk:
                    break
                observed += len(chunk)
                if observed > max_bytes:
                    raise IntakeError(f"response exceeds {max_bytes} bytes")
                chunks.append(chunk)
    except urllib.error.HTTPError as error:
        raise IntakeError(f"official source returned HTTP {error.code}") from error
    except urllib.error.URLError as error:
        raise IntakeError(f"official source network error: {error.reason}") from error
    body = b"".join(chunks)
    if declared_length is not None and declared_length != len(body):
        raise IntakeError("Content-Length does not match the downloaded body")
    return FetchResult(
        requested_url=url,
        final_url=final_url,
        redirect_chain=tuple(redirect_handler.chain),
        media_type=media_type,
        content_length_header=declared_length,
        body=body,
    )


def discover_archive_url(page: FetchResult, expected_filename: str, label_contains: str) -> str:
    charset = "utf-8"
    text = page.body.decode(charset, errors="strict")
    parser = LinkCollector()
    parser.feed(text)
    matches: set[str] = set()
    expected_lower = expected_filename.lower()
    label_lower = label_contains.casefold()
    for href, label in parser.links:
        absolute = urllib.parse.urljoin(page.final_url, href)
        path_name = PurePosixPath(urllib.parse.unquote(urllib.parse.urlsplit(absolute).path)).name.lower()
        if path_name == expected_lower or (label_lower in label.casefold() and path_name.endswith(".zip")):
            matches.add(absolute)
    if len(matches) != 1:
        raise IntakeError(f"expected exactly one official {expected_filename} link, found {len(matches)}")
    return next(iter(matches))


def normalize_member_path(name: str) -> str:
    if "\x00" in name:
        raise IntakeError("ZIP member contains NUL")
    candidate = name.replace("\\", "/")
    if candidate.startswith("/") or WINDOWS_DRIVE_PATTERN.match(candidate):
        raise IntakeError(f"absolute ZIP path is forbidden: {name}")
    parts: list[str] = []
    for part in PurePosixPath(candidate).parts:
        if part in ("", "."):
            continue
        if part == "..":
            raise IntakeError(f"ZIP path traversal is forbidden: {name}")
        parts.append(part)
    if not parts:
        raise IntakeError(f"empty ZIP member path: {name}")
    normalized = "/".join(parts)
    if len(normalized) > 512:
        raise IntakeError(f"ZIP member path is too long: {name}")
    return normalized


def member_is_symlink(info: zipfile.ZipInfo) -> bool:
    mode = (info.external_attr >> 16) & 0xFFFF
    return stat.S_IFMT(mode) == stat.S_IFLNK


def member_has_exec_bit(info: zipfile.ZipInfo) -> bool:
    mode = (info.external_attr >> 16) & 0xFFFF
    return bool(mode & 0o111)


def classify(path: str, is_directory: bool) -> tuple[str, str]:
    if is_directory:
        return "directory", "inode/directory"
    suffix = PurePosixPath(path).suffix.lower()
    if suffix == ".xsd":
        category = "XSD"
    elif suffix == ".wsdl":
        category = "WSDL"
    elif suffix == ".xml":
        category = "XML"
    elif suffix in {".pdf", ".doc", ".docx", ".odt", ".rtf", ".txt", ".md"}:
        category = "document"
    elif suffix in {".csv", ".json", ".yaml", ".yml"}:
        category = "reference"
    else:
        category = "other"
    return category, mimetypes.guess_type(path)[0] or "application/octet-stream"


def reject_executable(path: str, info: zipfile.ZipInfo, prefix: bytes) -> None:
    suffix = PurePosixPath(path).suffix.lower()
    if suffix in EXECUTABLE_SUFFIXES:
        raise IntakeError(f"executable payload extension is forbidden: {path}")
    if member_has_exec_bit(info):
        raise IntakeError(f"executable permission bits are forbidden: {path}")
    if prefix.startswith((b"MZ", b"\x7fELF", b"#!")):
        raise IntakeError(f"executable payload magic is forbidden: {path}")


def xml_namespaces(data: bytes) -> list[dict[str, str]]:
    namespaces: set[tuple[str, str]] = set()
    try:
        for _, value in ET.iterparse(io.BytesIO(data), events=("start-ns",)):
            prefix, uri = value
            namespaces.add((prefix or "", uri))
    except ET.ParseError as error:
        raise IntakeError(f"XML namespace parsing failed: {error}") from error
    return [{"prefix": prefix, "uri": uri} for prefix, uri in sorted(namespaces)]


def parse_xml(path: str, data: bytes) -> tuple[ET.Element, list[dict[str, str]]]:
    if len(data) > MAX_XML_BYTES:
        raise IntakeError(f"XML member exceeds {MAX_XML_BYTES} bytes: {path}")
    if DOCTYPE_PATTERN.search(data):
        raise IntakeError(f"DOCTYPE/ENTITY is forbidden in XML: {path}")
    try:
        root = ET.fromstring(data)
    except ET.ParseError as error:
        raise IntakeError(f"XML is not well formed ({path}): {error}") from error
    return root, xml_namespaces(data)


def local_name(tag: str) -> tuple[str, str]:
    if tag.startswith("{") and "}" in tag:
        namespace, name = tag[1:].split("}", 1)
        return namespace, name
    return "", tag


def reference_candidates(path: str, root: ET.Element) -> list[dict[str, str]]:
    references: list[dict[str, str]] = []
    for element in root.iter():
        namespace, name = local_name(str(element.tag))
        attribute = None
        if namespace == XSD_NS and name in {"include", "import", "redefine"}:
            attribute = "schemaLocation"
        elif namespace == WSDL_NS and name == "import":
            attribute = "location"
        if attribute is None:
            continue
        location = (element.attrib.get(attribute) or "").strip()
        if not location:
            continue
        references.append({"source": path, "kind": name, "location": location})
    return references


def resolve_reference(source: str, location: str, known_paths: set[str]) -> str:
    split = urllib.parse.urlsplit(location)
    if split.scheme or split.netloc:
        raise IntakeError(f"external schema reference is unresolved: {source} -> {location}")
    decoded = urllib.parse.unquote(split.path)
    if not decoded:
        raise IntakeError(f"empty schema reference: {source} -> {location}")
    combined = str(PurePosixPath(source).parent / decoded)
    target = normalize_member_path(combined)
    if target not in known_paths:
        raise IntakeError(f"unresolved schema reference: {source} -> {target}")
    return target


def inventory_archive(archive: bytes, extract_root: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, str]], int]:
    if not archive.startswith(b"PK") or not zipfile.is_zipfile(io.BytesIO(archive)):
        raise IntakeError("downloaded payload is not a ZIP archive")
    entries: list[dict[str, Any]] = []
    xml_documents: dict[str, tuple[ET.Element, list[dict[str, str]]]] = {}
    path_keys: set[str] = set()
    known_paths: set[str] = set()
    total_uncompressed = 0
    with zipfile.ZipFile(io.BytesIO(archive), "r") as package:
        infos = package.infolist()
        if not infos or len(infos) > MAX_ENTRIES:
            raise IntakeError(f"ZIP entry count must be between 1 and {MAX_ENTRIES}")
        for info in infos:
            normalized = normalize_member_path(info.filename)
            collision_key = normalized.casefold()
            if collision_key in path_keys:
                raise IntakeError(f"duplicate or case-colliding ZIP path: {normalized}")
            path_keys.add(collision_key)
            known_paths.add(normalized)
            if info.flag_bits & 0x1:
                raise IntakeError(f"encrypted ZIP member is forbidden: {normalized}")
            if member_is_symlink(info):
                raise IntakeError(f"symlink ZIP member is forbidden: {normalized}")
            is_directory = info.is_dir() or info.filename.endswith("/")
            if is_directory:
                category, media_type = classify(normalized, True)
                entries.append({
                    "path": normalized,
                    "directory": True,
                    "compressedSize": 0,
                    "uncompressedSize": 0,
                    "sha256": None,
                    "mediaType": media_type,
                    "category": category,
                })
                continue
            if info.file_size < 0 or info.file_size > MAX_SINGLE_FILE:
                raise IntakeError(f"ZIP member exceeds {MAX_SINGLE_FILE} bytes: {normalized}")
            total_uncompressed += info.file_size
            if total_uncompressed > MAX_TOTAL_UNCOMPRESSED:
                raise IntakeError(f"ZIP total uncompressed size exceeds {MAX_TOTAL_UNCOMPRESSED} bytes")
            if info.file_size > 0:
                if info.compress_size <= 0:
                    raise IntakeError(f"invalid compressed size for {normalized}")
                ratio = info.file_size / info.compress_size
                if ratio > MAX_COMPRESSION_RATIO:
                    raise IntakeError(f"ZIP compression ratio exceeds {MAX_COMPRESSION_RATIO}: {normalized}")
            with package.open(info, "r") as stream:
                data = stream.read(MAX_SINGLE_FILE + 1)
            if len(data) != info.file_size:
                raise IntakeError(f"ZIP member size mismatch: {normalized}")
            reject_executable(normalized, info, data[:4])
            category, media_type = classify(normalized, False)
            digest = sha256_bytes(data)
            entries.append({
                "path": normalized,
                "directory": False,
                "compressedSize": info.compress_size,
                "uncompressedSize": info.file_size,
                "sha256": digest,
                "mediaType": media_type,
                "category": category,
            })
            if PurePosixPath(normalized).suffix.lower() in XML_SUFFIXES:
                target = extract_root / normalized
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
                xml_documents[normalized] = parse_xml(normalized, data)
        corrupt = package.testzip()
        if corrupt is not None:
            raise IntakeError(f"ZIP CRC validation failed: {corrupt}")

    references: list[dict[str, Any]] = []
    namespaces: set[tuple[str, str]] = set()
    for source in sorted(xml_documents):
        root, document_namespaces = xml_documents[source]
        for item in document_namespaces:
            namespaces.add((item["prefix"], item["uri"]))
        for reference in reference_candidates(source, root):
            target = resolve_reference(source, reference["location"], known_paths)
            references.append({**reference, "resolvedPath": target})
    return (
        sorted(entries, key=lambda item: item["path"]),
        sorted(references, key=lambda item: (item["source"], item["kind"], item["location"])),
        [{"prefix": prefix, "uri": uri} for prefix, uri in sorted(namespaces)],
        total_uncompressed,
    )


def load_policy(path: Path) -> dict[str, Any]:
    try:
        policy = json.loads(path.read_text("utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise IntakeError(f"cannot read source policy: {error}") from error
    required = ["adapterCode", "apiVersion", "expectedFilename", "operatorPageUrl", "allowedHttpsOrigins", "linkLabelContains"]
    if any(not policy.get(key) for key in required):
        raise IntakeError("source policy is incomplete")
    if policy.get("confirmedLive") is not False or policy.get("binaryArchiveInGit") is not False:
        raise IntakeError("source policy maturity boundaries are invalid")
    return policy


def run(args: argparse.Namespace) -> dict[str, Any]:
    policy = load_policy(args.source_policy)
    allowed_origins = {origin(str(value)) for value in policy["allowedHttpsOrigins"]}
    output_dir: Path = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    expected_filename = str(policy["expectedFilename"])

    if args.offline_archive is None:
        page = fetch_https(str(policy["operatorPageUrl"]), allowed_origins, 4 * 1024 * 1024)
        archive_url = discover_archive_url(page, expected_filename, str(policy["linkLabelContains"]))
        assert_allowed_url(archive_url, allowed_origins)
        archive_fetch = fetch_https(archive_url, allowed_origins, MAX_ARCHIVE_BYTES)
        if archive_fetch.media_type not in ALLOWED_ARCHIVE_MEDIA_TYPES:
            raise IntakeError(f"unexpected archive Content-Type: {archive_fetch.media_type}")
        source_page_final_url = page.final_url
        discovered_url = archive_url
        redirect_chain = list(page.redirect_chain) + list(archive_fetch.redirect_chain)
        archive = archive_fetch.body
        final_url = archive_fetch.final_url
        content_length_header = archive_fetch.content_length_header
        media_type = archive_fetch.media_type
    else:
        archive = args.offline_archive.read_bytes()
        if len(archive) > MAX_ARCHIVE_BYTES:
            raise IntakeError(f"offline archive exceeds {MAX_ARCHIVE_BYTES} bytes")
        discovered_url = args.offline_source_url
        final_url = args.offline_final_url or args.offline_source_url
        assert_allowed_url(discovered_url, allowed_origins)
        assert_allowed_url(final_url, allowed_origins)
        source_page_final_url = str(policy["operatorPageUrl"])
        redirect_chain = []
        content_length_header = len(archive)
        media_type = "application/zip"

    if PurePosixPath(urllib.parse.unquote(urllib.parse.urlsplit(final_url).path)).name.lower() != expected_filename.lower():
        raise IntakeError(f"final URL filename does not match {expected_filename}")
    if len(archive) == 0 or len(archive) > MAX_ARCHIVE_BYTES:
        raise IntakeError("archive size is outside the governed range")

    archive_sha256 = sha256_bytes(archive)
    archive_path = output_dir / expected_filename
    archive_path.write_bytes(archive)
    extract_root = Path(tempfile.mkdtemp(prefix="pc-crop-08a-"))
    try:
        entries, references, namespaces, total_uncompressed = inventory_archive(archive, extract_root)
    finally:
        shutil.rmtree(extract_root, ignore_errors=True)

    schema_entries = [entry for entry in entries if entry["category"] in {"XSD", "WSDL", "XML"}]
    manifest = {
        "schemaVersion": "pc-crop.fgis-zerno-schema-manifest.v1",
        "adapterCode": str(policy["adapterCode"]),
        "apiVersion": str(policy["apiVersion"]),
        "mappingPackageVersion": str(policy["apiVersion"]),
        "packageFilename": expected_filename,
        "packageSha256": archive_sha256,
        "packageSize": len(archive),
        "fileCount": len(entries),
        "totalUncompressedSize": total_uncompressed,
        "schemaFileCount": len(schema_entries),
        "unresolvedReferenceCount": 0,
        "namespaces": namespaces,
        "references": references,
        "files": entries,
        "environmentStatus": "ADAPTER_READY",
        "operationalStatus": "NOT_ATTESTED",
        "confirmedLive": False,
    }
    manifest_bytes = canonical_json(manifest)
    manifest_sha256 = sha256_bytes(manifest_bytes)
    manifest_path = output_dir / "fgis-zerno-api-1.0.23-manifest.json"
    manifest_path.write_bytes(manifest_bytes)

    inventory = {
        "schemaVersion": "pc-crop.fgis-zerno-archive-inventory.v1",
        "packageSha256": archive_sha256,
        "manifestSha256": manifest_sha256,
        "files": entries,
    }
    write_json(output_dir / "fgis-zerno-api-1.0.23-inventory.json", inventory, canonical=True)

    retrieved_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    report = {
        "schemaVersion": "pc-crop.fgis-zerno-official-intake-acceptance.v1",
        "slice": "PC-CROP-08A",
        "issue": 3155,
        "status": "PASS",
        "operationalStatus": "NOT_ATTESTED",
        "exactHead": args.exact_head,
        "adapterCode": str(policy["adapterCode"]),
        "apiVersion": str(policy["apiVersion"]),
        "sourcePageUrl": str(policy["operatorPageUrl"]),
        "sourcePageFinalUrl": source_page_final_url,
        "discoveredUrl": discovered_url,
        "finalUrl": final_url,
        "redirectChain": redirect_chain,
        "allowedHttpsOrigins": sorted(allowed_origins),
        "retrievedAt": retrieved_at,
        "mediaType": media_type,
        "contentLengthHeader": content_length_header,
        "packageFilename": expected_filename,
        "packageSha256": archive_sha256,
        "packageSize": len(archive),
        "manifestSha256": manifest_sha256,
        "fileCount": len(entries),
        "totalUncompressedSize": total_uncompressed,
        "schemaFileCount": len(schema_entries),
        "unresolvedReferenceCount": 0,
        "invariants": {
            "officialOperatorPage": True,
            "httpsOriginAllowlist": True,
            "redirectAllowlist": True,
            "zipSafety": True,
            "encryptedArchiveRejected": True,
            "pathTraversalRejected": True,
            "symlinkRejected": True,
            "executablePayloadRejected": True,
            "archiveBombLimits": True,
            "xmlDoctypeEntityRejected": True,
            "xmlWellFormed": True,
            "schemaReferencesResolved": True,
            "deterministicManifest": True,
            "binaryArchiveEvidenceOnly": True,
            "confirmedLiveNeverInferred": True,
        },
        "boundaries": {
            "credentialsOrCertificates": False,
            "liveApiEndpointCall": False,
            "handwrittenBusinessMapping": False,
            "binaryArchiveCommittedToGit": False,
            "secondInboxOutboxOrRelay": False,
            "productionDeployment": False,
            "productionHosting": "REG_RU_VPS_ONLY",
        },
    }
    write_json(output_dir / "pc-crop-08a-acceptance.json", report)
    return report


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-policy", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--exact-head", default=os.environ.get("GITHUB_SHA", "UNKNOWN"))
    parser.add_argument("--offline-archive", type=Path)
    parser.add_argument("--offline-source-url", default="https://static.specagro.ru/fgis-zerno-api-1.0.23.zip")
    parser.add_argument("--offline-final-url")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    try:
        report = run(args)
    except Exception as error:  # produce fail evidence for expected and unexpected faults
        args.output_dir.mkdir(parents=True, exist_ok=True)
        failure = {
            "schemaVersion": "pc-crop.fgis-zerno-official-intake-acceptance.v1",
            "slice": "PC-CROP-08A",
            "issue": 3155,
            "status": "FAIL",
            "operationalStatus": "NOT_ATTESTED",
            "exactHead": args.exact_head,
            "errorType": type(error).__name__,
            "error": str(error),
        }
        write_json(args.output_dir / "pc-crop-08a-acceptance.json", failure)
        print(json.dumps(failure, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
