from __future__ import annotations

import io
import urllib.parse
from pathlib import PurePosixPath
from typing import Any
from zipfile import BadZipFile, ZipFile

from catalog_constants import (
    CatalogError, EXPECTED_API_VERSION, EXPECTED_BINDING,
    EXPECTED_BUSINESS_OPERATION_COUNT, EXPECTED_DOCUMENTED_ENDPOINT,
    EXPECTED_FAMILY_COUNT, EXPECTED_PORT, EXPECTED_PORT_TYPE,
    EXPECTED_SERVICE, EXPECTED_SOAP_TRANSPORT,
    EXPECTED_SOURCE_INVENTORY_SHA, EXPECTED_SOURCE_SCHEMA_MANIFEST_SHA,
    EXPECTED_TRANSPORT, EXPECTED_WSDL_TNS, FAMILY_BY_FILE,
    SOAP11_NS, WSDL_NS, XS_NS,
)
from catalog_xml import (
    mutation_kind, namespace_map, operation_code, parse_xml, qname,
    read_docx_protocol, resolve_qname, sha256_bytes,
)


def message_element(message_ref, messages, mapping) -> str:
    local = message_ref.split(":", 1)[-1]
    message = messages.get(local)
    if message is None:
        raise CatalogError(f"WSDL message missing: {local}")
    parts = message.findall(f"{{{WSDL_NS}}}part")
    if len(parts) != 1 or "element" not in parts[0].attrib:
        raise CatalogError(f"invalid WSDL message part: {local}")
    return resolve_qname(parts[0].attrib["element"], mapping)


def derive_catalog(archive_bytes: bytes) -> dict[str, Any]:
    try:
        archive = ZipFile(io.BytesIO(archive_bytes))
    except BadZipFile as error:
        raise CatalogError(f"invalid official package ZIP: {error}") from error
    with archive:
        names = archive.namelist()
        wsdls = [name for name in names if name.lower().endswith(".wsdl")]
        docx = [name for name in names if name.lower().endswith(".docx")]
        if len(wsdls) != 1 or len(docx) != 1:
            raise CatalogError("exactly one WSDL and one official DOCX are required")
        wsdl_path = wsdls[0]
        wsdl_data = archive.read(wsdl_path)
        root = parse_xml(wsdl_data, wsdl_path)
        mapping = namespace_map(wsdl_data)
        if root.attrib.get("targetNamespace") != EXPECTED_WSDL_TNS:
            raise CatalogError("WSDL target namespace drift")

        port_type = next(
            (node for node in root.findall(f"{{{WSDL_NS}}}portType") if node.attrib.get("name") == EXPECTED_PORT_TYPE),
            None,
        )
        if port_type is None:
            raise CatalogError("expected WSDL portType missing")
        names_in_port = [node.attrib.get("name") for node in port_type.findall(f"{{{WSDL_NS}}}operation")]
        if tuple(names_in_port) != EXPECTED_TRANSPORT:
            raise CatalogError(f"transport operation drift: {names_in_port}")
        messages = {
            node.attrib["name"]: node
            for node in root.findall(f"{{{WSDL_NS}}}message")
            if node.attrib.get("name")
        }
        transport = []
        for node in port_type.findall(f"{{{WSDL_NS}}}operation"):
            name = node.attrib["name"]
            input_node = node.find(f"{{{WSDL_NS}}}input")
            output_node = node.find(f"{{{WSDL_NS}}}output")
            fault_node = node.find(f"{{{WSDL_NS}}}fault")
            if input_node is None or output_node is None or fault_node is None:
                raise CatalogError(f"incomplete transport operation {name}")
            transport.append({
                "operation": name,
                "requestElementQName": message_element(input_node.attrib["message"], messages, mapping),
                "responseElementQName": message_element(output_node.attrib["message"], messages, mapping),
                "faultElementQName": message_element(fault_node.attrib["message"], messages, mapping),
                "soapAction": f"urn:{name}",
            })

        binding = next(
            (node for node in root.findall(f"{{{WSDL_NS}}}binding") if node.attrib.get("name") == EXPECTED_BINDING),
            None,
        )
        if binding is None or resolve_qname(binding.attrib["type"], mapping) != qname(EXPECTED_WSDL_TNS, EXPECTED_PORT_TYPE):
            raise CatalogError("expected SOAP 1.1 binding missing or mismatched")
        soap_binding = binding.find(f"{{{SOAP11_NS}}}binding")
        if soap_binding is None or soap_binding.attrib != {"style": "document", "transport": EXPECTED_SOAP_TRANSPORT}:
            raise CatalogError("SOAP binding metadata drift")
        binding_ops = binding.findall(f"{{{WSDL_NS}}}operation")
        if tuple(node.attrib.get("name") for node in binding_ops) != EXPECTED_TRANSPORT:
            raise CatalogError("SOAP binding operation order drift")
        for node in binding_ops:
            name = node.attrib["name"]
            soap_op = node.find(f"{{{SOAP11_NS}}}operation")
            input_body = node.find(f"{{{WSDL_NS}}}input/{{{SOAP11_NS}}}body")
            output_body = node.find(f"{{{WSDL_NS}}}output/{{{SOAP11_NS}}}body")
            if soap_op is None or soap_op.attrib.get("soapAction") != f"urn:{name}":
                raise CatalogError(f"SOAP action drift for {name}")
            if input_body is None or output_body is None or input_body.attrib.get("use") != "literal" or output_body.attrib.get("use") != "literal":
                raise CatalogError(f"SOAP literal body drift for {name}")

        service = next(
            (node for node in root.findall(f"{{{WSDL_NS}}}service") if node.attrib.get("name") == EXPECTED_SERVICE),
            None,
        )
        port = None if service is None else next(
            (node for node in service.findall(f"{{{WSDL_NS}}}port") if node.attrib.get("name") == EXPECTED_PORT),
            None,
        )
        address = None if port is None else port.find(f"{{{SOAP11_NS}}}address")
        endpoint = None if address is None else address.attrib.get("location")
        if endpoint != EXPECTED_DOCUMENTED_ENDPOINT or urllib.parse.urlparse(endpoint).hostname != "localhost":
            raise CatalogError(f"documented endpoint drift: {endpoint}")

        operations = []
        matched = set()
        for schema_path in sorted(names):
            filename = PurePosixPath(schema_path).name
            family = FAMILY_BY_FILE.get(filename)
            if family is None:
                continue
            matched.add(filename)
            data = archive.read(schema_path)
            schema = parse_xml(data, schema_path)
            namespace = schema.attrib.get("targetNamespace")
            if not namespace:
                raise CatalogError(f"target namespace missing: {filename}")
            globals_ = [node.attrib["name"] for node in schema.findall(f"{{{XS_NS}}}element") if node.attrib.get("name")]
            requests = {name[7:]: name for name in globals_ if name.startswith("Request")}
            responses = {name[8:]: name for name in globals_ if name.startswith("Response")}
            if set(requests) != set(responses):
                raise CatalogError(f"orphan request/response in {filename}: {sorted(set(requests) ^ set(responses))}")
            for suffix in sorted(requests):
                operations.append({
                    "code": operation_code(suffix, family),
                    "family": family,
                    "kind": mutation_kind(suffix, family),
                    "requestElement": requests[suffix],
                    "responseElement": responses[suffix],
                    "requestQName": qname(namespace, requests[suffix]),
                    "responseQName": qname(namespace, responses[suffix]),
                    "namespace": namespace,
                    "schemaPath": schema_path,
                    "schemaSha256": sha256_bytes(data),
                    "requestTransportOperation": "SendRequest",
                    "responseTransportOperation": "SendResponse",
                    "ackTransportOperation": "Ack",
                })
        if matched != set(FAMILY_BY_FILE):
            raise CatalogError(f"business wrapper schema files missing: {sorted(set(FAMILY_BY_FILE) - matched)}")
        operations.sort(key=lambda item: (item["family"], item["code"]))
        codes = [item["code"] for item in operations]
        duplicates = sorted(code for code in set(codes) if codes.count(code) > 1)
        if len(operations) != EXPECTED_BUSINESS_OPERATION_COUNT:
            raise CatalogError(f"expected 57 operations, got {len(operations)}")
        if duplicates:
            raise CatalogError(f"duplicate operation codes: {duplicates}")
        families = sorted({item["family"] for item in operations})
        if len(families) != EXPECTED_FAMILY_COUNT:
            raise CatalogError(f"expected 8 families, got {len(families)}")
        protocol = read_docx_protocol(archive, docx[0])
        return {
            "schemaVersion": "pc-crop.fgis-grain-operation-catalog.v1",
            "adapterCode": "FGIS_ZERNO",
            "apiVersion": EXPECTED_API_VERSION,
            "sourcePackageSha256": sha256_bytes(archive_bytes),
            "sourceInventorySha256": EXPECTED_SOURCE_INVENTORY_SHA,
            "sourceSchemaManifestSha256": EXPECTED_SOURCE_SCHEMA_MANIFEST_SHA,
            "operationalStatus": "NOT_ATTESTED",
            "honestStatus": "ADAPTER_READY",
            "liveConnection": False,
            "credentialsPresent": False,
            "wsdl": {
                "path": wsdl_path,
                "sha256": sha256_bytes(wsdl_data),
                "targetNamespace": EXPECTED_WSDL_TNS,
                "soapVersion": "1.1",
                "bindingStyle": "document",
                "bodyUse": "literal",
                "soapTransport": EXPECTED_SOAP_TRANSPORT,
                "binding": EXPECTED_BINDING,
                "portType": EXPECTED_PORT_TYPE,
                "service": EXPECTED_SERVICE,
                "port": EXPECTED_PORT,
                "documentedEndpoint": endpoint,
                "documentedEndpointIsPlaceholder": True,
                "runtimeEndpointAllowed": False,
                "transportOperations": transport,
            },
            "protocol": {"exchangePattern": "SYNC_CALL_ASYNC_PROCESSING_QUEUE", **protocol},
            "families": families,
            "operationCount": len(operations),
            "operations": operations,
        }
