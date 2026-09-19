from __future__ import annotations

import hashlib
import io
import json
import re
from typing import Any
from xml.etree import ElementTree as ET
from zipfile import BadZipFile, ZipFile

from catalog_constants import (
    CatalogError,
    EXPECTED_API_VERSION,
    EXPECTED_PACKAGE_SHA,
    EXPECTED_SOURCE_INVENTORY_SHA,
    EXPECTED_SOURCE_SCHEMA_MANIFEST_SHA,
    PROTOCOL_EVIDENCE,
    WORD_NS,
)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def qname(namespace: str, local: str) -> str:
    return f"{{{namespace}}}{local}"


def namespace_map(data: bytes) -> dict[str, str]:
    result: dict[str, str] = {}
    try:
        for _event, (prefix, uri) in ET.iterparse(io.BytesIO(data), events=("start-ns",)):
            result[prefix or ""] = uri
    except ET.ParseError as error:
        raise CatalogError(f"namespace parsing failed: {error}") from error
    return result


def parse_xml(data: bytes, path: str) -> ET.Element:
    upper = data.upper()
    if b"<!DOCTYPE" in upper or b"<!ENTITY" in upper:
        raise CatalogError(f"DTD/entity declaration rejected: {path}")
    try:
        return ET.fromstring(data)
    except ET.ParseError as error:
        raise CatalogError(f"XML parsing failed for {path}: {error}") from error


def resolve_qname(value: str, mapping: dict[str, str]) -> str:
    if ":" in value:
        prefix, local = value.split(":", 1)
        namespace = mapping.get(prefix)
        if not namespace:
            raise CatalogError(f"unknown QName prefix {prefix}")
        return qname(namespace, local)
    namespace = mapping.get("")
    if not namespace:
        raise CatalogError(f"unqualified QName without default namespace: {value}")
    return qname(namespace, value)


def operation_code(suffix: str, family: str) -> str:
    if not suffix:
        if family != "DICTIONARIES":
            raise CatalogError("empty operation suffix outside dictionaries")
        return "DICTIONARIES"
    value = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", suffix)
    value = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", "_", value)
    return value.upper()


def mutation_kind(suffix: str, family: str) -> str:
    if family == "DICTIONARIES" or suffix.startswith("GetList"):
        return "READ"
    if suffix.startswith("Create"):
        return "CREATE"
    if suffix.startswith(("Canceled", "Cancel")):
        return "CANCEL"
    if suffix.startswith("Delete"):
        return "DELETE"
    if suffix.startswith("Close"):
        return "CLOSE"
    raise CatalogError(f"unknown operation semantic prefix: {suffix}")


def read_source_lock(path) -> dict[str, Any]:
    try:
        lock = json.loads(path.read_text("utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise CatalogError(f"source lock cannot be read: {error}") from error
    if not isinstance(lock, dict) or lock.get("status") != "PINNED":
        raise CatalogError("source lock is not PINNED")
    expected = {
        "version": EXPECTED_API_VERSION,
        "packageSha256": EXPECTED_PACKAGE_SHA,
        "inventorySha256": EXPECTED_SOURCE_INVENTORY_SHA,
        "schemaManifestSha256": EXPECTED_SOURCE_SCHEMA_MANIFEST_SHA,
    }
    for key, value in expected.items():
        if lock.get(key) != value:
            raise CatalogError(f"source lock {key} mismatch")
    return lock


def read_docx_protocol(archive: ZipFile, path: str) -> dict[str, Any]:
    document_bytes = archive.read(path)
    try:
        with ZipFile(io.BytesIO(document_bytes)) as document:
            xml_bytes = document.read("word/document.xml")
    except (BadZipFile, KeyError) as error:
        raise CatalogError(f"official DOCX cannot be parsed: {error}") from error
    root = parse_xml(xml_bytes, f"{path}!/word/document.xml")
    text = " ".join(
        " ".join((node.text or "").split())
        for node in root.findall(f".//{{{WORD_NS}}}t")
        if (node.text or "").strip()
    )
    text = " ".join(text.split())
    missing = [phrase for phrase in PROTOCOL_EVIDENCE if phrase not in text]
    if missing:
        raise CatalogError(f"official protocol evidence is missing: {missing}")
    return {
        "path": path,
        "sha256": sha256_bytes(document_bytes),
        "synchronousCalls": True,
        "asynchronousProcessingQueue": True,
        "sendRequestMeaning": "SUBMIT_TO_INBOUND_QUEUE",
        "sendResponseMeaning": "POLL_OUTBOUND_QUEUE",
        "ackMeaning": "CONFIRM_AND_IRREVERSIBLY_REMOVE_RESPONSE",
    }
