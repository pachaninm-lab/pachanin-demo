#!/usr/bin/env python3
"""Generate the FGIS Grain API 1.0.23 catalog from the pinned official archive."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
import urllib.parse
import zipfile
from collections import defaultdict
from pathlib import Path, PurePosixPath
from typing import Any, Iterable
from xml.etree import ElementTree as ET

XSD_NS = "http://www.w3.org/2001/XMLSchema"
WSDL_NS = "http://schemas.xmlsoap.org/wsdl/"
SOAP_NS = "http://schemas.xmlsoap.org/wsdl/soap/"
API_VERSION = "1.0.23"
PACKAGE_FILENAME = "fgis-zerno-api-1.0.23.zip"
EXPECTED_WSDL_TARGET_NS = "urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/1.0.23"
EXPECTED_PORT_TYPE = "FGIS_Zerno_ExchangePortType"
EXPECTED_BINDING = "FGIS_Zerno_ExchangeSoap11Binding"
EXPECTED_SERVICE = "FGIS_Zerno_ExchangeService"
EXPECTED_TRANSPORT_OPERATIONS = ("Ack", "SendRequest", "SendResponse")
EXPECTED_BUSINESS_OPERATION_COUNT = 57
EXPECTED_PACKAGE_SHA256 = "085e22c50b6564219585c96e814b0793d906f4c5e401cbb7446a949c26f0bcd7"
MAPPING_VERSION = "fgis-zerno-1.0.23-catalog.v1"

FAMILY_BY_STEM = {
    "dictionaries": "DICTIONARIES",
    "gpb": "GPB",
    "gpb-sdiz": "GPB_SDIZ",
    "grain-monitor": "GRAIN_MONITOR",
    "lots": "LOTS",
    "rshn-documents": "RSHN_DOCUMENTS",
    "sdiz": "SDIZ",
    "ved-contract": "VED_CONTRACT",
}
READ_PREFIXES = ("Get", "List", "Find", "Search")
IDENTIFIER_NAMES = {
    "MessageID", "ReferenceMessageID", "Id", "id", "lotNumber",
    "sdizNumber", "sdizID", "SDIZNumber", "number",
    "correctedSDIZNumber", "correctedBySDIZNumber", "extinctionId",
    "extinctionRefusalId", "createLotNumber", "recordsModifiedFrom",
}


class CatalogError(RuntimeError):
    """Fail-closed contract-generation error."""


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
    ).encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def write_json(path: Path, value: Any) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = canonical_json_bytes(value) + b"\n"
    path.write_bytes(payload)
    return sha256_bytes(payload)


def archive_members_by_basename(archive: zipfile.ZipFile) -> dict[str, str]:
    result: dict[str, str] = {}
    for member in archive.namelist():
        if member.endswith("/"):
            continue
        basename = PurePosixPath(member).name
        if basename in result:
            raise CatalogError(f"duplicate archive basename: {basename}")
        result[basename] = member
    return result


def namespace_map(xml_bytes: bytes) -> dict[str, str]:
    result: dict[str, str] = {}
    try:
        for _event, (prefix, uri) in ET.iterparse(
            io.BytesIO(xml_bytes), events=("start-ns",),
        ):
            result[prefix or ""] = uri
    except ET.ParseError as error:
        raise CatalogError(f"cannot parse namespace map: {error}") from error
    return result


def qname(value: str, namespaces: dict[str, str]) -> str:
    if value.startswith("{"):
        return value
    if ":" not in value:
        default = namespaces.get("")
        return f"{{{default}}}{value}" if default else value
    prefix, local = value.split(":", 1)
    namespace = namespaces.get(prefix)
    if not namespace:
        raise CatalogError(f"unresolved QName prefix: {value}")
    return f"{{{namespace}}}{local}"


def local_name(expanded: str) -> str:
    return expanded.rsplit("}", 1)[-1] if "}" in expanded else expanded


def snake_case(value: str) -> str:
    if not value:
        return "DICTIONARIES"
    result = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", value)
    result = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", result)
    return result.replace("-", "_").upper()


def schema_stem(filename: str) -> str | None:
    match = re.fullmatch(r"fgis-zerno-api-(.+)-1\.0\.23\.xsd", filename)
    if not match:
        return None
    stem = match.group(1)
    return None if stem in {"types", "fault"} else stem


def find_required_single(
    root: ET.Element,
    path: str,
    namespaces: dict[str, str],
    label: str,
) -> ET.Element:
    matches = root.findall(path, namespaces)
    if len(matches) != 1:
        raise CatalogError(f"expected one {label}, found {len(matches)}")
    return matches[0]


def parse_wsdl(wsdl_bytes: bytes) -> dict[str, Any]:
    namespaces = namespace_map(wsdl_bytes)
    try:
        root = ET.fromstring(wsdl_bytes)
    except ET.ParseError as error:
        raise CatalogError(f"invalid WSDL: {error}") from error
    ns = {"wsdl": WSDL_NS, "soap": SOAP_NS, "xs": XSD_NS}
    target_namespace = root.attrib.get("targetNamespace")
    if target_namespace != EXPECTED_WSDL_TARGET_NS:
        raise CatalogError(f"unexpected WSDL target namespace: {target_namespace}")

    messages: dict[str, dict[str, str]] = {}
    for message in root.findall("wsdl:message", ns):
        name = message.attrib.get("name")
        parts = message.findall("wsdl:part", ns)
        if not name or len(parts) != 1:
            raise CatalogError("each WSDL message must have one named part")
        element = parts[0].attrib.get("element")
        if not element:
            raise CatalogError(f"WSDL message has no element: {name}")
        messages[name] = {
            "message": f"{{{target_namespace}}}{name}",
            "element": qname(element, namespaces),
        }

    port_type = find_required_single(root, "wsdl:portType", ns, "portType")
    if port_type.attrib.get("name") != EXPECTED_PORT_TYPE:
        raise CatalogError(f"unexpected portType: {port_type.attrib.get('name')}")

    binding = find_required_single(root, "wsdl:binding", ns, "binding")
    if binding.attrib.get("name") != EXPECTED_BINDING:
        raise CatalogError(f"unexpected binding: {binding.attrib.get('name')}")
    soap_binding = find_required_single(binding, "soap:binding", ns, "soap:binding")
    if soap_binding.attrib.get("style") != "document":
        raise CatalogError("only document-style SOAP binding is accepted")
    if soap_binding.attrib.get("transport") != "http://schemas.xmlsoap.org/soap/http":
        raise CatalogError("unexpected SOAP transport")

    action_by_operation: dict[str, str] = {}
    for operation in binding.findall("wsdl:operation", ns):
        name = operation.attrib.get("name")
        soap_operation = find_required_single(
            operation, "soap:operation", ns, f"SOAP action for {name}",
        )
        action = soap_operation.attrib.get("soapAction")
        if not name or not action:
            raise CatalogError("binding operation must have name and soapAction")
        action_by_operation[name] = action

    transport_operations: list[dict[str, Any]] = []
    for operation in port_type.findall("wsdl:operation", ns):
        name = operation.attrib.get("name")
        if not name:
            raise CatalogError("unnamed WSDL operation")
        input_element = find_required_single(
            operation, "wsdl:input", ns, f"input for {name}",
        )
        output_element = find_required_single(
            operation, "wsdl:output", ns, f"output for {name}",
        )
        fault_element = find_required_single(
            operation, "wsdl:fault", ns, f"fault for {name}",
        )
        input_message = local_name(qname(input_element.attrib["message"], namespaces))
        output_message = local_name(qname(output_element.attrib["message"], namespaces))
        fault_message = local_name(qname(fault_element.attrib["message"], namespaces))
        for message_name in (input_message, output_message, fault_message):
            if message_name not in messages:
                raise CatalogError(
                    f"operation {name} references unknown message {message_name}",
                )
        transport_operations.append({
            "name": name,
            "soapAction": action_by_operation.get(name),
            "input": messages[input_message],
            "output": messages[output_message],
            "fault": {
                **messages[fault_message],
                "name": fault_element.attrib.get("name"),
            },
        })

    names = tuple(sorted(row["name"] for row in transport_operations))
    if names != EXPECTED_TRANSPORT_OPERATIONS:
        raise CatalogError(f"unexpected transport operations: {names}")

    service = find_required_single(root, "wsdl:service", ns, "service")
    if service.attrib.get("name") != EXPECTED_SERVICE:
        raise CatalogError(f"unexpected service: {service.attrib.get('name')}")
    port = find_required_single(service, "wsdl:port", ns, "service port")
    address = find_required_single(port, "soap:address", ns, "SOAP address")
    location = address.attrib.get("location") or ""
    host = (urllib.parse.urlparse(location).hostname or "").lower()
    if host not in {"localhost", "127.0.0.1", "::1"}:
        raise CatalogError(
            "accepted WSDL endpoint must remain the documented localhost placeholder",
        )

    return {
        "targetNamespace": target_namespace,
        "portType": EXPECTED_PORT_TYPE,
        "binding": EXPECTED_BINDING,
        "soapVersion": "1.1",
        "style": "document",
        "service": EXPECTED_SERVICE,
        "port": port.attrib.get("name"),
        "documentationEndpoint": {
            "url": location,
            "placeholder": True,
            "runtimeAllowed": False,
        },
        "operations": sorted(transport_operations, key=lambda row: row["name"]),
    }


def top_level_elements(
    xsd_bytes: bytes,
) -> tuple[str, dict[str, dict[str, str | None]]]:
    try:
        root = ET.fromstring(xsd_bytes)
    except ET.ParseError as error:
        raise CatalogError(f"invalid XSD: {error}") from error
    target_namespace = root.attrib.get("targetNamespace")
    if not target_namespace:
        raise CatalogError("XSD has no targetNamespace")
    elements: dict[str, dict[str, str | None]] = {}
    for element in root.findall(f"{{{XSD_NS}}}element"):
        name = element.attrib.get("name")
        if not name:
            continue
        if name in elements:
            raise CatalogError(f"duplicate global element: {name}")
        elements[name] = {"type": element.attrib.get("type")}
    return target_namespace, elements


def parse_business_operations(
    files: dict[str, bytes],
    file_hashes: dict[str, str],
) -> list[dict[str, Any]]:
    operations: list[dict[str, Any]] = []
    seen_codes: set[str] = set()
    for filename in sorted(files):
        stem = schema_stem(filename)
        if stem is None:
            continue
        family = FAMILY_BY_STEM.get(stem)
        if not family:
            raise CatalogError(f"unknown business schema family: {filename}")
        target_namespace, elements = top_level_elements(files[filename])
        requests = sorted(name for name in elements if name.startswith("Request"))
        responses = sorted(name for name in elements if name.startswith("Response"))
        if not requests or not responses:
            raise CatalogError(
                f"business schema has no request/response roots: {filename}",
            )
        response_set = set(responses)
        paired_responses: set[str] = set()
        for request_name in requests:
            suffix = request_name[len("Request"):]
            response_name = f"Response{suffix}"
            if response_name not in response_set:
                raise CatalogError(f"orphan request {request_name} in {filename}")
            paired_responses.add(response_name)
            operation_name = suffix or "Dictionaries"
            code = snake_case(operation_name)
            if code in seen_codes:
                raise CatalogError(f"duplicate operation code: {code}")
            seen_codes.add(code)
            classification = (
                "READ"
                if operation_name.startswith(READ_PREFIXES)
                or operation_name == "Dictionaries"
                else "MUTATION"
            )
            operations.append({
                "code": code,
                "name": operation_name,
                "family": family,
                "classification": classification,
                "schemaFile": filename,
                "schemaFileSha256": file_hashes[filename],
                "namespace": target_namespace,
                "request": {
                    "element": request_name,
                    "qname": f"{{{target_namespace}}}{request_name}",
                    "type": elements[request_name]["type"],
                    "transportOperation": "SendRequest",
                },
                "response": {
                    "element": response_name,
                    "qname": f"{{{target_namespace}}}{response_name}",
                    "type": elements[response_name]["type"],
                    "transportOperation": "SendResponse",
                    "acknowledgementOperation": "Ack",
                },
            })
        orphan_responses = sorted(response_set - paired_responses)
        if orphan_responses:
            raise CatalogError(
                f"orphan responses in {filename}: {orphan_responses}",
            )
    operations.sort(key=lambda row: (row["family"], row["code"]))
    if len(operations) != EXPECTED_BUSINESS_OPERATION_COUNT:
        raise CatalogError(
            f"expected {EXPECTED_BUSINESS_OPERATION_COUNT} business operations, "
            f"found {len(operations)}",
        )
    return operations


def direct_owner(
    node: ET.Element,
    parent_map: dict[ET.Element, ET.Element],
) -> str:
    current = node
    while current in parent_map:
        current = parent_map[current]
        if (
            current.tag == f"{{{XSD_NS}}}complexType"
            and current.attrib.get("name")
        ):
            return f"complexType:{current.attrib['name']}"
        if (
            current.tag == f"{{{XSD_NS}}}element"
            and current.attrib.get("name")
        ):
            parent = parent_map.get(current)
            if parent is not None and parent.tag == f"{{{XSD_NS}}}schema":
                return f"element:{current.attrib['name']}"
    return "schema"


def parse_sdiz_identifiers(
    files: dict[str, bytes],
    file_hashes: dict[str, str],
) -> list[dict[str, Any]]:
    selected = (
        "fgis-zerno-api-types-1.0.23.xsd",
        "fgis-zerno-api-sdiz-1.0.23.xsd",
        "fgis-zerno-sdiz-1.0.23.xsd",
    )
    identifiers: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str, str]] = set()
    for filename in selected:
        xml_bytes = files.get(filename)
        if xml_bytes is None:
            raise CatalogError(f"missing identifier source schema: {filename}")
        root = ET.fromstring(xml_bytes)
        parent_map = {
            child: parent for parent in root.iter() for child in parent
        }
        for kind in ("element", "attribute"):
            for node in root.iter(f"{{{XSD_NS}}}{kind}"):
                name = node.attrib.get("name")
                if name not in IDENTIFIER_NAMES:
                    continue
                owner = direct_owner(node, parent_map)
                key = (filename, owner, kind, name)
                if key in seen:
                    continue
                seen.add(key)
                identifiers.append({
                    "schemaFile": filename,
                    "schemaFileSha256": file_hashes[filename],
                    "owner": owner,
                    "kind": kind.upper(),
                    "name": name,
                    "type": node.attrib.get("type"),
                    "use": node.attrib.get("use"),
                    "minOccurs": node.attrib.get("minOccurs"),
                    "maxOccurs": node.attrib.get("maxOccurs"),
                })
    identifiers.sort(
        key=lambda row: (
            row["schemaFile"], row["owner"], row["kind"], row["name"],
        ),
    )
    return identifiers


def enum_values(xsd_bytes: bytes, type_name: str) -> list[str]:
    root = ET.fromstring(xsd_bytes)
    for simple_type in root.findall(f"{{{XSD_NS}}}simpleType"):
        if simple_type.attrib.get("name") != type_name:
            continue
        restriction = simple_type.find(f"{{{XSD_NS}}}restriction")
        if restriction is None:
            break
        values = [
            row.attrib["value"]
            for row in restriction.findall(f"{{{XSD_NS}}}enumeration")
            if "value" in row.attrib
        ]
        if not values:
            raise CatalogError(f"simpleType {type_name} has no enumerations")
        return values
    raise CatalogError(f"simpleType not found: {type_name}")


def build_catalog(archive_path: Path, source_lock_path: Path) -> dict[str, Any]:
    archive_bytes = archive_path.read_bytes()
    package_sha = sha256_bytes(archive_bytes)
    source_lock = json.loads(source_lock_path.read_text("utf-8"))
    if source_lock.get("status") != "PINNED":
        raise CatalogError("source lock must be PINNED")
    if source_lock.get("version") != API_VERSION:
        raise CatalogError("source lock version mismatch")
    if (
        source_lock.get("packageSha256") != EXPECTED_PACKAGE_SHA256
        or package_sha != EXPECTED_PACKAGE_SHA256
    ):
        raise CatalogError("official package SHA-256 mismatch")
    if archive_path.name != PACKAGE_FILENAME:
        raise CatalogError("unexpected package filename")

    with zipfile.ZipFile(io.BytesIO(archive_bytes), "r") as archive:
        members = archive_members_by_basename(archive)
        required = [
            "fgis-zerno-api-1.0.23.wsdl",
            "fgis-zerno-api-types-1.0.23.xsd",
            "fgis-zerno-api-fault-1.0.23.xsd",
            "fgis-zerno-api-sdiz-1.0.23.xsd",
            "fgis-zerno-sdiz-1.0.23.xsd",
            "fgis-zerno-common-1.0.23.xsd",
        ]
        for filename in required:
            if filename not in members:
                raise CatalogError(
                    f"required contract file missing: {filename}",
                )
        files = {
            basename: archive.read(member)
            for basename, member in members.items()
            if basename.endswith((".xsd", ".wsdl"))
        }

    file_hashes = {
        name: sha256_bytes(value) for name, value in files.items()
    }
    transport = parse_wsdl(files["fgis-zerno-api-1.0.23.wsdl"])
    operations = parse_business_operations(files, file_hashes)
    identifiers = parse_sdiz_identifiers(files, file_hashes)
    families: dict[str, dict[str, int]] = defaultdict(
        lambda: {"read": 0, "mutation": 0},
    )
    for operation in operations:
        key = "read" if operation["classification"] == "READ" else "mutation"
        families[operation["family"]][key] += 1

    source_files = sorted(
        {operation["schemaFile"] for operation in operations}
        | {
            "fgis-zerno-api-1.0.23.wsdl",
            "fgis-zerno-api-types-1.0.23.xsd",
            "fgis-zerno-api-fault-1.0.23.xsd",
            "fgis-zerno-sdiz-1.0.23.xsd",
            "fgis-zerno-common-1.0.23.xsd",
        },
    )

    return {
        "schemaVersion": "pc-crop.fgis-grain-operation-catalog.v1",
        "adapter": {
            "adapterCode": "FGIS_ZERNO",
            "adapterVersion": API_VERSION,
            "apiVersion": API_VERSION,
            "mappingVersion": MAPPING_VERSION,
            "packageSha256": package_sha,
            "status": "ADAPTER_READY",
            "operationalStatus": "NOT_ATTESTED",
        },
        "sourceAuthority": {
            "sourceLockSchemaVersion": source_lock.get("schemaVersion"),
            "packageFilename": PACKAGE_FILENAME,
            "packageSha256": package_sha,
            "inventorySha256": source_lock.get("inventorySha256"),
            "schemaManifestSha256": source_lock.get("schemaManifestSha256"),
            "files": [
                {"filename": filename, "sha256": file_hashes[filename]}
                for filename in source_files
            ],
        },
        "transport": transport,
        "business": {
            "operationCount": len(operations),
            "families": [
                {
                    "code": family,
                    "operationCount": counts["read"] + counts["mutation"],
                    "readCount": counts["read"],
                    "mutationCount": counts["mutation"],
                }
                for family, counts in sorted(families.items())
            ],
            "operations": operations,
        },
        "enums": {
            "responseCodes": enum_values(
                files["fgis-zerno-api-types-1.0.23.xsd"],
                "ResponseCodeType",
            ),
            "sdizStatuses": enum_values(
                files["fgis-zerno-sdiz-1.0.23.xsd"], "SDIZStatusType",
            ),
            "recordStatuses": enum_values(
                files["fgis-zerno-common-1.0.23.xsd"], "StatusRecordType",
            ),
            "resultOperations": enum_values(
                files["fgis-zerno-common-1.0.23.xsd"], "ResultOperationType",
            ),
            "sdizKinds": enum_values(
                files["fgis-zerno-common-1.0.23.xsd"], "KindSDIZType",
            ),
            "sdizExtinctionKinds": enum_values(
                files["fgis-zerno-common-1.0.23.xsd"],
                "KindSDIZExtinctionType",
            ),
        },
        "sdizIdentifiers": identifiers,
        "boundaries": {
            "documentationEndpointRuntimeAllowed": False,
            "xmlCodecImplemented": False,
            "signatureImplemented": False,
            "providerClientImplemented": False,
            "domainMutationImplemented": False,
            "secondInboxOutboxOrRelay": False,
            "confirmedLive": False,
            "productionHosting": "REG_RU_VPS_ONLY",
        },
    }


def ts_literal(value: Any, indent: int = 0) -> str:
    space = "  " * indent
    next_space = "  " * (indent + 1)
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
        rows = [
            f"{next_space}{ts_literal(item, indent + 1)}," for item in value
        ]
        return "[\n" + "\n".join(rows) + f"\n{space}]"
    if isinstance(value, dict):
        if not value:
            return "{}"
        rows = []
        for key, item in value.items():
            key_literal = (
                key
                if re.fullmatch(r"[A-Za-z_$][A-Za-z0-9_$]*", key)
                else json.dumps(key)
            )
            rows.append(
                f"{next_space}{key_literal}: {ts_literal(item, indent + 1)},",
            )
        return "{\n" + "\n".join(rows) + f"\n{space}}}"
    raise CatalogError(f"cannot render TypeScript value: {type(value)}")


def render_typescript(catalog: dict[str, Any], catalog_sha256: str) -> str:
    compact_operations = [
        {
            "code": row["code"],
            "name": row["name"],
            "family": row["family"],
            "classification": row["classification"],
            "namespace": row["namespace"],
            "requestQName": row["request"]["qname"],
            "responseQName": row["response"]["qname"],
        }
        for row in catalog["business"]["operations"]
    ]
    transport = [
        {
            "name": row["name"],
            "soapAction": row["soapAction"],
            "inputQName": row["input"]["element"],
            "outputQName": row["output"]["element"],
            "faultQName": row["fault"]["element"],
        }
        for row in catalog["transport"]["operations"]
    ]
    family_codes = [
        row["code"] for row in catalog["business"]["families"]
    ]
    enums = catalog["enums"]
    identifier_names = sorted(
        {row["name"] for row in catalog["sdizIdentifiers"]},
    )
    return f'''/* eslint-disable */
/**
 * Generated from the hash-pinned official FGIS Grain API 1.0.23 package.
 * Do not edit by hand. Regenerate with scripts/pc-crop-08b/generate_contract_catalog.py.
 */

export const FGIS_GRAIN_1_0_23_CATALOG_SHA256 = {json.dumps(catalog_sha256)} as const;
export const FGIS_GRAIN_1_0_23_PACKAGE_SHA256 = {json.dumps(catalog["adapter"]["packageSha256"])} as const;
export const FGIS_GRAIN_1_0_23_MAPPING_VERSION = {json.dumps(catalog["adapter"]["mappingVersion"])} as const;
export const FGIS_GRAIN_1_0_23_TARGET_NAMESPACE = {json.dumps(catalog["transport"]["targetNamespace"])} as const;
export const FGIS_GRAIN_1_0_23_DOCUMENTATION_ENDPOINT = {ts_literal(catalog["transport"]["documentationEndpoint"])} as const;

export const FGIS_GRAIN_1_0_23_TRANSPORT_OPERATIONS = {ts_literal(transport)} as const;
export type FgisGrainTransportOperation = typeof FGIS_GRAIN_1_0_23_TRANSPORT_OPERATIONS[number]["name"];

export const FGIS_GRAIN_1_0_23_BUSINESS_FAMILIES = {ts_literal(family_codes)} as const;
export type FgisGrainBusinessFamily = typeof FGIS_GRAIN_1_0_23_BUSINESS_FAMILIES[number];

export const FGIS_GRAIN_1_0_23_BUSINESS_OPERATIONS = {ts_literal(compact_operations)} as const;
export type FgisGrainBusinessOperation = typeof FGIS_GRAIN_1_0_23_BUSINESS_OPERATIONS[number];
export type FgisGrainBusinessOperationCode = FgisGrainBusinessOperation["code"];

export const FGIS_GRAIN_1_0_23_RESPONSE_CODES = {ts_literal(enums["responseCodes"])} as const;
export type FgisGrainResponseCode = typeof FGIS_GRAIN_1_0_23_RESPONSE_CODES[number];
export const FGIS_GRAIN_1_0_23_SDIZ_STATUSES = {ts_literal(enums["sdizStatuses"])} as const;
export type FgisGrainSdizStatus = typeof FGIS_GRAIN_1_0_23_SDIZ_STATUSES[number];
export const FGIS_GRAIN_1_0_23_SDIZ_IDENTIFIER_FIELDS = {ts_literal(identifier_names)} as const;
export type FgisGrainSdizIdentifierField = typeof FGIS_GRAIN_1_0_23_SDIZ_IDENTIFIER_FIELDS[number];
'''


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--source-lock", required=True, type=Path)
    parser.add_argument("--catalog-output", required=True, type=Path)
    parser.add_argument("--lock-output", required=True, type=Path)
    parser.add_argument("--typescript-output", required=True, type=Path)
    args = parser.parse_args(list(argv) if argv is not None else None)
    try:
        catalog = build_catalog(args.archive, args.source_lock)
        catalog_sha = write_json(args.catalog_output, catalog)
        lock = {
            "schemaVersion": "pc-crop.fgis-grain-operation-catalog-lock.v1",
            "apiVersion": API_VERSION,
            "packageSha256": catalog["adapter"]["packageSha256"],
            "catalogSha256": catalog_sha,
            "operationCount": catalog["business"]["operationCount"],
            "transportOperationCount": len(catalog["transport"]["operations"]),
            "operationalStatus": "NOT_ATTESTED",
            "productionHosting": "REG_RU_VPS_ONLY",
        }
        write_json(args.lock_output, lock)
        args.typescript_output.parent.mkdir(parents=True, exist_ok=True)
        args.typescript_output.write_text(
            render_typescript(catalog, catalog_sha), encoding="utf-8",
        )
    except (
        CatalogError,
        OSError,
        json.JSONDecodeError,
        zipfile.BadZipFile,
    ) as error:
        print(f"PC-CROP-08B generation failed: {error}", file=sys.stderr)
        return 1
    print(json.dumps({
        "catalogSha256": catalog_sha,
        "operationCount": catalog["business"]["operationCount"],
        "transportOperationCount": len(catalog["transport"]["operations"]),
        "sdizIdentifierCount": len(catalog["sdizIdentifiers"]),
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
