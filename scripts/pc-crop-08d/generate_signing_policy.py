#!/usr/bin/env python3
"""Generate signing-policy authority from the pinned official API 1.0.23 DOCX.

Binary source and prose excerpts stay out of Git. Accepted facts are linked to
normalized paragraph SHA-256 fingerprints. OOXML relationships are inventoried
but never resolved; active/embedded payloads are rejected.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import stat
import unicodedata
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Iterable
from xml.etree import ElementTree as ET

MAX_OUTER_ENTRIES = 20_000
MAX_DOCX_BYTES = 64 * 1024 * 1024
MAX_DOCX_ENTRIES = 5_000
MAX_DOCX_TOTAL_BYTES = 128 * 1024 * 1024
MAX_XML_BYTES = 32 * 1024 * 1024
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
FORBIDDEN_DOCX_MARKERS = (
    "vbaproject",
    "activex",
    "embeddings",
    "oleobject",
    "customui",
)


class PolicyGenerationError(RuntimeError):
    pass


@dataclass(frozen=True)
class ProtocolDocument:
    path: str
    sha256: str
    size_bytes: int
    data: bytes


@dataclass(frozen=True)
class Paragraph:
    index: int
    sha256: str
    text: str


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def json_bytes(value: Any) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    ).encode("utf-8")


def write_bytes(path: Path, data: bytes) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return digest(data)


def normalize_zip_path(value: str) -> str:
    if not value or "\x00" in value or "\\" in value:
        raise PolicyGenerationError(f"unsafe ZIP path: {value!r}")
    value = unicodedata.normalize("NFC", value)
    candidate = value[:-1] if value.endswith("/") else value
    if not candidate or candidate.startswith("/"):
        raise PolicyGenerationError(f"unsafe ZIP path: {value!r}")
    parts = PurePosixPath(candidate).parts
    if any(part in {"", ".", ".."} for part in parts):
        raise PolicyGenerationError(f"unsafe ZIP path: {value!r}")
    return "/".join(parts)


def validate_entry(info: zipfile.ZipInfo, seen: set[str]) -> str:
    path = normalize_zip_path(info.filename)
    key = unicodedata.normalize("NFKC", path).casefold()
    if key in seen:
        raise PolicyGenerationError(f"duplicate/colliding ZIP path: {path}")
    seen.add(key)
    if info.flag_bits & 0x1:
        raise PolicyGenerationError(f"encrypted ZIP entry rejected: {path}")
    mode = (info.external_attr >> 16) & 0xFFFF
    if mode and stat.S_ISLNK(mode):
        raise PolicyGenerationError(f"symbolic link rejected: {path}")
    return path


def bounded_read(archive: zipfile.ZipFile, info: zipfile.ZipInfo, limit: int) -> bytes:
    if info.file_size < 0 or info.file_size > limit:
        raise PolicyGenerationError(f"entry exceeds limit: {info.filename}")
    with archive.open(info, "r") as source:
        data = source.read(limit + 1)
    if len(data) != info.file_size or len(data) > limit:
        raise PolicyGenerationError(f"entry size mismatch: {info.filename}")
    return data


def load_lock(path: Path) -> dict[str, Any]:
    try:
        lock = json.loads(path.read_text("utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise PolicyGenerationError(f"cannot read policy lock: {error}") from error
    if not isinstance(lock, dict):
        raise PolicyGenerationError("policy lock must be an object")
    if lock.get("schemaVersion") != "pc-crop.fgis-grain-signing-policy-lock.v1":
        raise PolicyGenerationError("unsupported policy lock schema")
    for field in ("packageSha256", "protocolDocumentSha256"):
        if not isinstance(lock.get(field), str) or not SHA256_RE.fullmatch(lock[field]):
            raise PolicyGenerationError(f"invalid {field}")
    identifiers = lock.get("requiredIdentifiers")
    expected = {
        "digestAlgorithmUri",
        "signatureAlgorithmUri",
        "canonicalizationAlgorithmUri",
        "transformAlgorithmUri",
    }
    if not isinstance(identifiers, dict) or set(identifiers) != expected:
        raise PolicyGenerationError("requiredIdentifiers are malformed")
    if not all(isinstance(value, str) and value for value in identifiers.values()):
        raise PolicyGenerationError("requiredIdentifiers must be non-empty strings")
    return lock


def locate_protocol(archive_path: Path, lock: dict[str, Any]) -> ProtocolDocument:
    archive_data = archive_path.read_bytes()
    if digest(archive_data) != lock["packageSha256"]:
        raise PolicyGenerationError("official package SHA-256 mismatch")
    try:
        archive = zipfile.ZipFile(io.BytesIO(archive_data), "r")
    except zipfile.BadZipFile as error:
        raise PolicyGenerationError(f"invalid official ZIP: {error}") from error
    matches: list[ProtocolDocument] = []
    with archive:
        infos = archive.infolist()
        if not infos or len(infos) > MAX_OUTER_ENTRIES:
            raise PolicyGenerationError("official ZIP entry count is invalid")
        seen: set[str] = set()
        for info in infos:
            path = validate_entry(info, seen)
            if info.is_dir() or not path.casefold().endswith(".docx"):
                continue
            data = bounded_read(archive, info, MAX_DOCX_BYTES)
            sha256 = digest(data)
            if sha256 == lock["protocolDocumentSha256"]:
                matches.append(ProtocolDocument(path, sha256, len(data), data))
    if len(matches) != 1:
        raise PolicyGenerationError(
            f"expected one protocol DOCX, found {len(matches)}"
        )
    return matches[0]


def parse_xml(data: bytes, path: str) -> ET.Element:
    if len(data) > MAX_XML_BYTES:
        raise PolicyGenerationError(f"OOXML part exceeds limit: {path}")
    upper = data.upper()
    if b"<!DOCTYPE" in upper or b"<!ENTITY" in upper:
        raise PolicyGenerationError(f"DTD/entity rejected: {path}")
    try:
        return ET.fromstring(data)
    except ET.ParseError as error:
        raise PolicyGenerationError(f"malformed OOXML part {path}: {error}") from error


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).replace("\u00a0", " ")
    return re.sub(r"\s+", " ", value).strip()


def inspect_docx(document: ProtocolDocument) -> tuple[list[Paragraph], dict[str, Any]]:
    try:
        archive = zipfile.ZipFile(io.BytesIO(document.data), "r")
    except zipfile.BadZipFile as error:
        raise PolicyGenerationError(f"protocol DOCX is invalid: {error}") from error
    parts: dict[str, bytes] = {}
    external: list[dict[str, str]] = []
    total = 0
    with archive:
        infos = archive.infolist()
        if not infos or len(infos) > MAX_DOCX_ENTRIES:
            raise PolicyGenerationError("DOCX entry count is invalid")
        seen: set[str] = set()
        for info in infos:
            path = validate_entry(info, seen)
            total += info.file_size
            if total > MAX_DOCX_TOTAL_BYTES:
                raise PolicyGenerationError("DOCX expanded size exceeds limit")
            lowered = path.casefold()
            if any(marker in lowered for marker in FORBIDDEN_DOCX_MARKERS) or lowered.endswith(".bin"):
                raise PolicyGenerationError(f"active/embedded payload rejected: {path}")
            if info.is_dir():
                continue
            limit = MAX_XML_BYTES if path.endswith((".xml", ".rels")) else MAX_DOCX_BYTES
            parts[path] = bounded_read(archive, info, limit)

    document_xml = parts.get("word/document.xml")
    if document_xml is None:
        raise PolicyGenerationError("word/document.xml is missing")
    for path, data in sorted(parts.items()):
        if not path.endswith(".rels"):
            continue
        root = parse_xml(data, path)
        for relation in root.findall(f"{{{REL_NS}}}Relationship"):
            if relation.attrib.get("TargetMode") == "External":
                external.append(
                    {
                        "part": path,
                        "type": relation.attrib.get("Type", ""),
                        "targetSha256": digest(
                            relation.attrib.get("Target", "").encode("utf-8")
                        ),
                    }
                )

    root = parse_xml(document_xml, "word/document.xml")
    paragraphs: list[Paragraph] = []
    for node in root.iter(f"{{{WORD_NS}}}p"):
        chunks: list[str] = []
        for element in node.iter():
            if element.tag == f"{{{WORD_NS}}}t" and element.text:
                chunks.append(element.text)
            elif element.tag in {
                f"{{{WORD_NS}}}tab",
                f"{{{WORD_NS}}}br",
                f"{{{WORD_NS}}}cr",
            }:
                chunks.append(" ")
        text = normalize_text("".join(chunks))
        if text:
            paragraphs.append(Paragraph(len(paragraphs), digest(text.encode()), text))
    if not paragraphs:
        raise PolicyGenerationError("protocol document has no text")
    return paragraphs, {
        "documentXmlSha256": digest(document_xml),
        "paragraphCount": len(paragraphs),
        "externalRelationshipCount": len(external),
        "externalRelationshipsResolved": False,
        "externalRelationshipFingerprints": external,
        "macroOrEmbeddedPayloadPresent": False,
    }


def find_exact(paragraphs: Iterable[Paragraph], value: str, fact: str) -> Paragraph:
    for paragraph in paragraphs:
        if value in paragraph.text:
            return paragraph
    raise PolicyGenerationError(f"official protocol fact not found: {fact}")


def find_patterns(
    paragraphs: Iterable[Paragraph],
    patterns: tuple[str, ...],
    fact: str,
    required: bool = True,
) -> Paragraph | None:
    compiled = tuple(re.compile(pattern, re.IGNORECASE) for pattern in patterns)
    for paragraph in paragraphs:
        if all(pattern.search(paragraph.text) for pattern in compiled):
            return paragraph
    if required:
        raise PolicyGenerationError(f"official protocol fact not found: {fact}")
    return None


def evidence(paragraph: Paragraph | None) -> dict[str, Any] | None:
    if paragraph is None:
        return None
    return {
        "paragraphIndex": paragraph.index,
        "paragraphSha256": paragraph.sha256,
    }


def build_manifest(
    lock: dict[str, Any],
    document: ProtocolDocument,
    paragraphs: list[Paragraph],
    metadata: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    identifiers = lock["requiredIdentifiers"]
    facts: dict[str, Paragraph] = {
        "digestAlgorithmUri": find_exact(
            paragraphs, identifiers["digestAlgorithmUri"], "GOST digest URI"
        ),
        "signatureAlgorithmUri": find_exact(
            paragraphs, identifiers["signatureAlgorithmUri"], "GOST signature URI"
        ),
        "canonicalizationAlgorithmUri": find_exact(
            paragraphs,
            identifiers["canonicalizationAlgorithmUri"],
            "Exclusive XML C14N URI",
        ),
        "transformAlgorithmUri": find_exact(
            paragraphs, identifiers["transformAlgorithmUri"], "SMEV transform URI"
        ),
        "pkcs7": find_patterns(paragraphs, (r"PKCS\s*#?\s*7",), "PKCS#7"),
        "x509": find_patterns(paragraphs, (r"X\s*[-\.]?\s*509",), "X-509"),
        "detached": find_patterns(
            paragraphs, (r"отсоедин|detached",), "detached signature"
        ),
        "messageDataTarget": find_patterns(
            paragraphs,
            (r"MessageData", r"подпис|sign"),
            "MessageData signature target",
        ),
    }
    optional = {
        "pkcs7Version15": find_patterns(
            paragraphs,
            (r"PKCS\s*#?\s*7", r"(?:v|верси[яи])?\s*1[\.,]5"),
            "PKCS#7 v1.5",
            False,
        ),
        "contentTypeAttribute": find_patterns(
            paragraphs, (r"contentType",), "contentType", False
        ),
        "messageDigestAttribute": find_patterns(
            paragraphs, (r"messageDigest",), "messageDigest", False
        ),
        "rfc5652": find_patterns(paragraphs, (r"RFC\s*5652",), "RFC 5652", False),
        "singleSignature": find_patterns(
            paragraphs,
            (r"более одной|единствен", r"подпис|ЭЦП|PKCS"),
            "single signature",
            False,
        ),
    }
    manifest = {
        "schemaVersion": "pc-crop.fgis-grain-signing-policy.v1",
        "adapterCode": "FGIS_ZERNO",
        "apiVersion": lock["apiVersion"],
        "packageSha256": lock["packageSha256"],
        "policyVersion": lock["policyVersion"],
        "protocolDocument": {
            "path": document.path,
            "sha256": document.sha256,
            "sizeBytes": document.size_bytes,
            **metadata,
        },
        "algorithms": dict(identifiers),
        "signatureContainer": {
            "format": "PKCS7",
            "version": "1.5" if optional["pkcs7Version15"] else None,
            "detached": True,
            "certificateProfile": "X509_ONLY",
            "embeddedContentAllowed": False,
            "singleSignatureRequired": optional["singleSignature"] is not None,
        },
        "signatureTarget": {
            "elementLocalName": "MessageData",
            "referenceStyle": "XML_ID_FRAGMENT",
            "contentInsideElement": True,
        },
        "authenticatedAttributes": {
            "contentTypeRequired": optional["contentTypeAttribute"] is not None,
            "messageDigestRequired": optional["messageDigestAttribute"] is not None,
            "orderingStandard": "RFC_5652" if optional["rfc5652"] else None,
        },
        "evidence": {
            **{key: evidence(value) for key, value in facts.items()},
            **{key: evidence(value) for key, value in optional.items()},
        },
        "implementationStatus": "PORTS_ONLY",
        "operationalStatus": "NOT_ATTESTED",
        "productionHosting": "REG_RU_VPS_ONLY",
        "boundaries": {
            "binaryProtocolCommittedToGit": False,
            "externalRelationshipsResolved": False,
            "macroExecution": False,
            "canonicalizationImplemented": False,
            "smevTransformImplemented": False,
            "gostSigningImplemented": False,
            "signatureVerificationImplemented": False,
            "providerCall": False,
        },
    }
    previews = {
        key: {**evidence(value), "preview": value.text[:240]}
        for key, value in facts.items()
    }
    previews.update(
        {
            key: ({**evidence(value), "preview": value.text[:240]} if value else None)
            for key, value in optional.items()
        }
    )
    return manifest, {
        "schemaVersion": "pc-crop.fgis-grain-signing-policy-discovery.v1",
        "status": "DISCOVERED",
        "protocolDocumentPath": document.path,
        "protocolDocumentSha256": document.sha256,
        "protocolDocumentSizeBytes": document.size_bytes,
        "factEvidence": previews,
    }


def typescript_bytes(manifest: dict[str, Any]) -> bytes:
    literal = json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2)
    return (
        "// Generated from the hash-pinned official FGIS Grain API 1.0.23 protocol.\n"
        "// Do not edit by hand. Binary source and prose excerpts are not committed.\n\n"
        f"export const FGIS_GRAIN_1_0_23_SIGNING_POLICY = {literal} as const;\n\n"
        "export type FgisGrainSigningPolicy = "
        "typeof FGIS_GRAIN_1_0_23_SIGNING_POLICY;\n"
    ).encode("utf-8")


def enforce_lock(
    lock: dict[str, Any],
    document: ProtocolDocument,
    manifest_sha256: str,
    typescript_sha256: str,
) -> bool:
    if lock.get("status") == "DISCOVERY_REQUIRED":
        return False
    if lock.get("status") != "PINNED":
        raise PolicyGenerationError("unsupported policy lock status")
    observed = {
        "protocolDocumentPath": document.path,
        "policyManifestSha256": manifest_sha256,
        "generatedTypescriptSha256": typescript_sha256,
    }
    for key, value in observed.items():
        if lock.get(key) != value:
            raise PolicyGenerationError(f"pinned lock mismatch: {key}")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--lock", required=True, type=Path)
    parser.add_argument("--manifest-output", required=True, type=Path)
    parser.add_argument("--typescript-output", required=True, type=Path)
    parser.add_argument("--discovery-output", required=True, type=Path)
    args = parser.parse_args()

    lock = load_lock(args.lock)
    document = locate_protocol(args.archive, lock)
    paragraphs, metadata = inspect_docx(document)
    manifest, discovery = build_manifest(lock, document, paragraphs, metadata)
    manifest_sha256 = write_bytes(args.manifest_output, json_bytes(manifest))
    typescript_sha256 = write_bytes(args.typescript_output, typescript_bytes(manifest))
    pinned = enforce_lock(lock, document, manifest_sha256, typescript_sha256)
    discovery.update(
        {
            "status": "PINNED" if pinned else "DISCOVERED_NOT_PINNED",
            "policyManifestSha256": manifest_sha256,
            "generatedTypescriptSha256": typescript_sha256,
            "pinned": pinned,
        }
    )
    write_bytes(args.discovery_output, json_bytes(discovery))
    print(json.dumps(discovery, ensure_ascii=False, sort_keys=True, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except PolicyGenerationError as error:
        print(f"PC-CROP-08D signing policy generation failed: {error}")
        raise SystemExit(1)
