#!/usr/bin/env python3
"""Generate FGIS Grain API 1.0.23 signing policy from the pinned official DOCX.

The generator never resolves OOXML relationships, does not execute macros and
commits no binary document or prose excerpts. Each accepted fact is linked to a
normalized paragraph SHA-256 fingerprint.
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
OOXML_WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
OOXML_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
FORBIDDEN_DOCX_MARKERS = (
    "vbaproject",
    "activex",
    "embeddings",
    "oleobject",
    "customui",
)


class PolicyGenerationError(RuntimeError):
    """Fail-closed official policy generation error."""


@dataclass(frozen=True)
class OfficialProtocolDocument:
    path: str
    sha256: str
    size_bytes: int
    bytes: bytes


@dataclass(frozen=True)
class ParagraphEvidence:
    index: int
    sha256: str
    normalized_text: str


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def write_json(path: Path, value: Any) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )
    return sha256_bytes(canonical_json_bytes(value))


def normalized_zip_path(value: str) -> str:
    if not value or "\x00" in value or "\\" in value:
        raise PolicyGenerationError(f"unsafe ZIP path: {value!r}")
    normalized = unicodedata.normalize("NFC", value)
    candidate = normalized[:-1] if normalized.endswith("/") else normalized
    if not candidate or candidate.startswith("/"):
        raise PolicyGenerationError(f"unsafe ZIP path: {value!r}")
    parts = PurePosixPath(candidate).parts
    if any(part in {"", ".", ".."} for part in parts):
        raise PolicyGenerationError(f"unsafe ZIP path: {value!r}")
    return "/".join(parts)


def validate_zip_info(info: zipfile.ZipInfo, seen: set[str]) -> str:
    path = normalized_zip_path(info.filename)
    collision_key = unicodedata.normalize("NFKC", path).casefold()
    if collision_key in seen:
        raise PolicyGenerationError(f"duplicate/colliding ZIP path: {path}")
    seen.add(collision_key)
    if info.flag_bits & 0x1:
        raise PolicyGenerationError(f"encrypted ZIP entry rejected: {path}")
    mode = (info.external_attr >> 16) & 0xFFFF
    if mode and stat.S_ISLNK(mode):
        raise PolicyGenerationError(f"symbolic link rejected: {path}")
    if info.file_size < 0 or info.compress_size < 0:
        raise PolicyGenerationError(f"negative ZIP entry size: {path}")
    return path


def read_zip_entry(archive: zipfile.ZipFile, info: zipfile.ZipInfo, maximum: int) -> bytes:
    if info.file_size > maximum:
        raise PolicyGenerationError(f"ZIP entry exceeds {maximum} bytes: {info.filename}")
    with archive.open(info, "r") as source:
        data = source.read(maximum + 1)
    if len(data) != info.file_size or len(data) > maximum:
        raise PolicyGenerationError(f"ZIP entry size mismatch: {info.filename}")
    return data


def load_lock(path: Path) -> dict[str, Any]:
    try:
        lock = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise PolicyGenerationError(f"cannot read policy lock: {error}") from error
    if not isinstance(lock, dict):
        raise PolicyGenerationError("policy lock must be an object")
    required = {
        "schemaVersion",
        "apiVersion",
        "status",
        "packageSha256",
        "protocolDocumentSha256",
        "policyVersion",
        "requiredIdentifiers",
    }
    missing = sorted(required - lock.keys())
    if missing:
        raise PolicyGenerationError(f"policy lock missing: {', '.join(missing)}")
    if lock["schemaVersion"] != "pc-crop.fgis-grain-signing-policy-lock.v1":
        raise PolicyGenerationError("unsupported policy lock schema")
    for field in ("packageSha256", "protocolDocumentSha256"):
        if not isinstance(lock[field], str) or not SHA256_RE.fullmatch(lock[field]):
            raise PolicyGenerationError(f"invalid {field}")
    identifiers = lock["requiredIdentifiers"]
    if not isinstance(identifiers, dict) or set(identifiers) != {
        "digestAlgorithmUri",
        "signatureAlgorithmUri",
        "canonicalizationAlgorithmUri",
        "transformAlgorithmUri",
    }:
        raise PolicyGenerationError("requiredIdentifiers are malformed")
    if not all(isinstance(value, str) and value for value in identifiers.values()):
        raise PolicyGenerationError("requiredIdentifiers must be non-empty strings")
    return lock


def find_official_protocol(archive_path: Path, lock: dict[str, Any]) -> OfficialProtocolDocument:
    archive_sha256 = sha256_bytes(archive_path.read_bytes())
    if archive_sha256 != lock["packageSha256"]:
        raise PolicyGenerationError(
            f"official package hash mismatch: {archive_sha256} != {lock['packageSha256']}"
        )
    try:
        archive = zipfile.ZipFile(archive_path, "r")
    except zipfile.BadZipFile as error:
        raise PolicyGenerationError(f"invalid official ZIP: {error}") from error
    matches: list[OfficialProtocolDocument] = []
    with archive:
        infos = archive.infolist()
        if not infos or len(infos) > MAX_OUTER_ENTRIES:
            raise PolicyGenerationError("official ZIP entry count is invalid")
        seen: set[str] = set()
        for info in infos:
            path = validate_zip_info(info, seen)
            if info.is_dir() or not path.lower().endswith(".docx"):
                continue
            data = read_zip_entry(archive, info, MAX_DOCX_BYTES)
            digest = sha256_bytes(data)
            if digest == lock["protocolDocumentSha256"]:
                matches.append(
                    OfficialProtocolDocument(
                        path=path,
                        sha256=digest,
                        size_bytes=len(data),
                        bytes=data,
                    )
                )
    if len(matches) != 1:
        raise PolicyGenerationError(
            "expected exactly one protocol DOCX with hash "
            f"{lock['protocolDocumentSha256']}, found {len(matches)}"
        )
    return matches[0]


def hardened_xml(data: bytes, path: str) -> ET.Element:
    if len(data) > MAX_XML_BYTES:
        raise PolicyGenerationError(f"OOXML part exceeds limit: {path}")
    upper = data.upper()
    if b"<!DOCTYPE" in upper or b"<!ENTITY" in upper:
        raise PolicyGenerationError(f"DTD/entity rejected in OOXML part: {path}")
    try:
        return ET.fromstring(data)
    except ET.ParseError as error:
        raise PolicyGenerationError(f"malformed OOXML part {path}: {error}") from error


def inspect_docx(document: OfficialProtocolDocument) -> tuple[list[ParagraphEvidence], dict[str, Any]]:
    try:
        archive = zipfile.ZipFile(io.BytesIO(document.bytes), "r")
    except zipfile.BadZipFile as error:
        raise PolicyGenerationError(f"protocol document is not valid OOXML: {error}") from error
    parts: dict[str, bytes] = {}
    external_relationships: list[dict[str, str]] = []
    total = 0
    with archive:
        infos = archive.infolist()
        if not infos or len(infos) > MAX_DOCX_ENTRIES:
            raise PolicyGenerationError("DOCX entry count is invalid")
        seen: set[str] = set()
        for info in infos:
            path = validate_zip_info(info, seen)
            total += info.file_size
            if total > MAX_DOCX_TOTAL_BYTES:
                raise PolicyGenerationError("DOCX expanded size exceeds limit")
            lowered = path.casefold()
            if any(marker in lowered for marker in FORBIDDEN_DOCX_MARKERS) or lowered.endswith(".bin"):
                raise PolicyGenerationError(f"active/embedded OOXML payload rejected: {path}")
            if info.is_dir():
                continue
            data = read_zip_entry(archive, info, MAX_XML_BYTES if path.endswith(".xml") or path.endswith(".rels") else MAX_DOCX_BYTES)
            parts[path] = data

    document_xml = parts.get("word/document.xml")
    if document_xml is None:
        raise PolicyGenerationError("word/document.xml is missing")

    for path, data in sorted(parts.items()):
        if not path.endswith(".rels"):
            continue
        root = hardened_xml(data, path)
        for relationship in root.findall(f"{{{OOXML_REL_NS}}}Relationship"):
            if relationship.attrib.get("TargetMode") == "External":
                external_relationships.append(
                    {
                        "part": path,
                        "type": relationship.attrib.get("Type", ""),
                        "targetSha256": sha256_bytes(
                            relationship.attrib.get("Target", "").encode("utf-8")
                        ),
                    }
                )

    root = hardened_xml(document_xml, "word/document.xml")
    paragraphs: list[ParagraphEvidence] = []
    for paragraph in root.iter(f"{{{OOXML_WORD_NS}}}p"):
        chunks: list[str] = []
        for element in paragraph.iter():
            if element.tag == f"{{{OOXML_WORD_NS}}}t" and element.text:
                chunks.append(element.text)
            elif element.tag in {
                f"{{{OOXML_WORD_NS}}}tab",
                f"{{{OOXML_WORD_NS}}}br",
                f"{{{OOXML_WORD_NS}}}cr",
            }:
                chunks.append(" ")
        normalized = normalize_text("".join(chunks))
        if normalized:
            paragraphs.append(
                ParagraphEvidence(
                    index=len(paragraphs),
                    sha256=sha256_bytes(normalized.encode("utf-8")),
                    normalized_text=normalized,
                )
            )
    if not paragraphs:
        raise PolicyGenerationError("protocol document has no text paragraphs")
    metadata = {
        "documentXmlSha256": sha256_bytes(document_xml),
        "paragraphCount": len(paragraphs),
        "externalRelationshipCount": len(external_relationships),
        "externalRelationshipsResolved": False,
        "externalRelationshipFingerprints": external_relationships,
        "macroOrEmbeddedPayloadPresent": False,
    }
    return paragraphs, metadata


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).replace("\u00a0", " ")
    return re.sub(r"\s+", " ", normalized).strip()


def evidence_record(paragraph: ParagraphEvidence) -> dict[str, Any]:
    return {
        "paragraphIndex": paragraph.index,
        "paragraphSha256": paragraph.sha256,
    }


def find_exact(paragraphs: Iterable[ParagraphEvidence], value: str, fact: str) -> ParagraphEvidence:
    matches = [paragraph for paragraph in paragraphs if value in paragraph.normalized_text]
    if not matches:
        raise PolicyGenerationError(f"official protocol fact not found: {fact}")
    return matches[0]


def find_pattern(
    paragraphs: Iterable[ParagraphEvidence],
    patterns: tuple[re.Pattern[str], ...],
    fact: str,
    required: bool = True,
) -> ParagraphEvidence | None:
    for paragraph in paragraphs:
        if all(pattern.search(paragraph.normalized_text) for pattern in patterns):
            return paragraph
    if required:
        raise PolicyGenerationError(f"official protocol fact not found: {fact}")
    return None


def build_manifest(
    lock: dict[str, Any],
    document: OfficialProtocolDocument,
    paragraphs: list[ParagraphEvidence],
    docx_metadata: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    identifiers = lock["requiredIdentifiers"]
    fact_paragraphs = {
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
        "pkcs7": find_pattern(
            paragraphs,
            (re.compile(r"PKCS\s*#?\s*7", re.IGNORECASE),),
            "PKCS#7",
        ),
        "x509": find_pattern(
            paragraphs,
            (re.compile(r"X\s*\.?\s*509", re.IGNORECASE),),
            "X.509 certificate",
        ),
        "detached": find_pattern(
            paragraphs,
            (re.compile(r"отсоедин|detached", re.IGNORECASE),),
            "detached signature",
        ),
        "messageDataTarget": find_pattern(
            paragraphs,
            (
                re.compile(r"MessageData", re.IGNORECASE),
                re.compile(r"подпис|sign", re.IGNORECASE),
            ),
            "MessageData signature target",
        ),
    }
    optional_facts = {
        "pkcs7Version15": find_pattern(
            paragraphs,
            (
                re.compile(r"PKCS\s*#?\s*7", re.IGNORECASE),
                re.compile(r"(?:v|верси[яи])?\s*1[\.,]5", re.IGNORECASE),
            ),
            "PKCS#7 v1.5",
            required=False,
        ),
        "contentTypeAttribute": find_pattern(
            paragraphs,
            (re.compile(r"contentType", re.IGNORECASE),),
            "contentType authenticated attribute",
            required=False,
        ),
        "messageDigestAttribute": find_pattern(
            paragraphs,
            (re.compile(r"messageDigest", re.IGNORECASE),),
            "messageDigest authenticated attribute",
            required=False,
        ),
        "rfc5652": find_pattern(
            paragraphs,
            (re.compile(r"RFC\s*5652", re.IGNORECASE),),
            "RFC 5652",
            required=False,
        ),
    }
    evidence = {
        key: evidence_record(value)
        for key, value in fact_paragraphs.items()
    }
    evidence.update(
        {
            key: evidence_record(value) if value else None
            for key, value in optional_facts.items()
        }
    )
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
            **docx_metadata,
        },
        "algorithms": {
            "digestAlgorithmUri": identifiers["digestAlgorithmUri"],
            "signatureAlgorithmUri": identifiers["signatureAlgorithmUri"],
            "canonicalizationAlgorithmUri": identifiers[
                "canonicalizationAlgorithmUri"
            ],
            "transformAlgorithmUri": identifiers["transformAlgorithmUri"],
        },
        "signatureContainer": {
            "format": "PKCS7",
            "version15EvidencePresent": optional_facts["pkcs7Version15"] is not None,
            "detached": True,
            "certificateProfile": "X509",
            "embeddedContentAllowed": False,
            "singleSignatureRequired": True,
        },
        "signatureTarget": {
            "elementLocalName": "MessageData",
            "referenceStyle": "XML_ID_FRAGMENT",
            "contentInsideElement": True,
        },
        "authenticatedAttributes": {
            "contentTypeEvidencePresent": optional_facts["contentTypeAttribute"] is not None,
            "messageDigestEvidencePresent": optional_facts["messageDigestAttribute"] is not None,
            "rfc5652EvidencePresent": optional_facts["rfc5652"] is not None,
        },
        "evidence": evidence,
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
    discovery = {
        "schemaVersion": "pc-crop.fgis-grain-signing-policy-discovery.v1",
        "status": "DISCOVERED",
        "protocolDocumentPath": document.path,
        "protocolDocumentSha256": document.sha256,
        "protocolDocumentSizeBytes": document.size_bytes,
        "policyManifestSha256": sha256_bytes(canonical_json_bytes(manifest)),
        "factEvidence": {
            key: {
                **evidence_record(value),
                "preview": value.normalized_text[:240],
            }
            for key, value in fact_paragraphs.items()
        },
        "optionalFactEvidence": {
            key: (
                {
                    **evidence_record(value),
                    "preview": value.normalized_text[:240],
                }
                if value
                else None
            )
            for key, value in optional_facts.items()
        },
    }
    return manifest, discovery


def typescript_literal(value: Any, indent: int = 0) -> str:
    prefix = "  " * indent
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, list):
        if not value:
            return "[]"
        items = ",\n".join(
            f"{'  ' * (indent + 1)}{typescript_literal(item, indent + 1)}"
            for item in value
        )
        return f"[\n{items},\n{prefix}]"
    if isinstance(value, dict):
        if not value:
            return "{}"
        items = []
        for key, item in value.items():
            rendered_key = key if re.fullmatch(r"[A-Za-z_$][A-Za-z0-9_$]*", key) else json.dumps(key)
            items.append(
                f"{'  ' * (indent + 1)}{rendered_key}: {typescript_literal(item, indent + 1)}"
            )
        return f"{{\n{',\n'.join(items)},\n{prefix}}}"
    raise TypeError(f"unsupported TypeScript literal: {type(value)!r}")


def write_typescript(path: Path, manifest: dict[str, Any]) -> str:
    content = (
        "// Generated from the hash-pinned official FGIS Grain API 1.0.23 protocol.\n"
        "// Do not edit by hand. Binary source and prose excerpts are not committed.\n\n"
        "export const FGIS_GRAIN_1_0_23_SIGNING_POLICY = "
        f"{typescript_literal(manifest)} as const;\n\n"
        "export type FgisGrainSigningPolicy = "
        "typeof FGIS_GRAIN_1_0_23_SIGNING_POLICY;\n"
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return sha256_bytes(content.encode("utf-8"))


def enforce_pinned_lock(
    lock: dict[str, Any],
    document: OfficialProtocolDocument,
    manifest_sha256: str,
    typescript_sha256: str,
) -> bool:
    if lock["status"] == "DISCOVERY_REQUIRED":
        return False
    if lock["status"] != "PINNED":
        raise PolicyGenerationError("unsupported policy lock status")
    expected = {
        "protocolDocumentPath": document.path,
        "policyManifestSha256": manifest_sha256,
        "generatedTypescriptSha256": typescript_sha256,
    }
    for field, observed in expected.items():
        if lock.get(field) != observed:
            raise PolicyGenerationError(
                f"pinned policy lock mismatch for {field}: {lock.get(field)!r} != {observed!r}"
            )
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--lock", required=True, type=Path)
    parser.add_argument("--manifest-output", required=True, type=Path)
    parser.add_argument("--typescript-output", required=True, type=Path)
    parser.add_argument("--discovery-output", required=True, type=Path)
    arguments = parser.parse_args()

    lock = load_lock(arguments.lock)
    document = find_official_protocol(arguments.archive, lock)
    paragraphs, docx_metadata = inspect_docx(document)
    manifest, discovery = build_manifest(lock, document, paragraphs, docx_metadata)
    manifest_sha256 = write_json(arguments.manifest_output, manifest)
    typescript_sha256 = write_typescript(arguments.typescript_output, manifest)
    pinned = enforce_pinned_lock(
        lock, document, manifest_sha256, typescript_sha256
    )
    discovery = {
        **discovery,
        "status": "PINNED" if pinned else "DISCOVERED_NOT_PINNED",
        "generatedTypescriptSha256": typescript_sha256,
        "pinned": pinned,
    }
    write_json(arguments.discovery_output, discovery)
    print(json.dumps(discovery, ensure_ascii=False, sort_keys=True, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except PolicyGenerationError as error:
        print(f"PC-CROP-08D signing policy generation failed: {error}")
        raise SystemExit(1)
