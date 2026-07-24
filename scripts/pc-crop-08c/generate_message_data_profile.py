#!/usr/bin/env python3
"""Generate the governed FGIS Grain 1.0.23 MessageData/signing profile."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import pathlib
import zipfile
from typing import Any
from xml.etree import ElementTree as ET

XSD_NS = "http://www.w3.org/2001/XMLSchema"
WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
PACKAGE_SHA256 = "085e22c50b6564219585c96e814b0793d906f4c5e401cbb7446a949c26f0bcd7"
PROTOCOL_DOCUMENT_SHA256 = "b195a9928970761dde282c4789ebe71b6095435973028688fefbb1beb8e1de9a"
API_TYPES_SHA256 = "76638c5c7ccedc6c58000d38e7f4001c274596fb19db9692d8aeccc738d9c422"
CATALOG_SHA256 = "4fc7cc075b956f0adca26331a99627d07cde77d63ec2fc017d0cbbc5f701c87a"
PROFILE_VERSION = "fgis-zerno-1.0.23-message-data.v1"


class ProfileError(RuntimeError):
    """Fail-closed profile generation error."""


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_json_bytes(value: Any) -> bytes:
    return (
        json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        + b"\n"
    )


def members_by_basename(archive: zipfile.ZipFile) -> dict[str, str]:
    result: dict[str, str] = {}
    for member in archive.namelist():
        if member.endswith("/"):
            continue
        basename = pathlib.PurePosixPath(member).name
        if basename in result:
            raise ProfileError(f"duplicate package basename: {basename}")
        result[basename] = member
    return result


def sequence_fields(sequence: ET.Element) -> list[dict[str, Any]]:
    fields: list[dict[str, Any]] = []
    for order, element in enumerate(
        sequence.findall(f"{{{XSD_NS}}}element"),
    ):
        fields.append(
            {
                "order": order,
                "name": element.attrib["name"],
                "typeQName": element.attrib.get("type"),
                "minOccurs": int(element.attrib.get("minOccurs", "1")),
                "maxOccurs": element.attrib.get("maxOccurs", "1"),
            }
        )
    return fields


def protocol_paragraphs(document_bytes: bytes) -> list[str]:
    with zipfile.ZipFile(io.BytesIO(document_bytes)) as document:
        xml_bytes = document.read("word/document.xml")
    root = ET.fromstring(xml_bytes)
    paragraphs: list[str] = []
    for paragraph in root.iter(f"{{{WORD_NS}}}p"):
        text = "".join(
            node.text or "" for node in paragraph.iter(f"{{{WORD_NS}}}t")
        ).strip()
        if text:
            paragraphs.append(" ".join(text.split()))
    return paragraphs


def evidence(
    paragraphs: list[str],
    key: str,
    needle: str,
) -> dict[str, Any]:
    matches = [
        (index, paragraph)
        for index, paragraph in enumerate(paragraphs)
        if needle in paragraph
    ]
    if len(matches) != 1:
        raise ProfileError(
            f"official evidence {key} expected once, found {len(matches)}"
        )
    index, paragraph = matches[0]
    return {
        "paragraphIndex": index,
        "paragraphSha256": sha256_bytes(paragraph.encode("utf-8")),
        "match": needle,
    }


def required_element(root: ET.Element, name: str) -> ET.Element:
    matches = [
        element
        for element in root.findall(f"{{{XSD_NS}}}element")
        if element.attrib.get("name") == name
    ]
    if len(matches) != 1:
        raise ProfileError(f"global element {name} expected once")
    return matches[0]


def required_complex_type(root: ET.Element, name: str) -> ET.Element:
    matches = [
        element
        for element in root.findall(f"{{{XSD_NS}}}complexType")
        if element.attrib.get("name") == name
    ]
    if len(matches) != 1:
        raise ProfileError(f"complexType {name} expected once")
    return matches[0]


def required_child(parent: ET.Element, path: str, label: str) -> ET.Element:
    child = parent.find(path)
    if child is None:
        raise ProfileError(f"missing {label}")
    return child


def build_profile(archive_path: pathlib.Path) -> dict[str, Any]:
    package_bytes = archive_path.read_bytes()
    if sha256_bytes(package_bytes) != PACKAGE_SHA256:
        raise ProfileError("official package SHA-256 mismatch")

    with zipfile.ZipFile(io.BytesIO(package_bytes)) as archive:
        members = members_by_basename(archive)
        api_types_member = members.get("fgis-zerno-api-types-1.0.23.xsd")
        protocol_member = next(
            (
                member
                for basename, member in members.items()
                if basename.lower().endswith(".docx")
            ),
            None,
        )
        if api_types_member is None or protocol_member is None:
            raise ProfileError("required official profile sources are missing")
        api_types_bytes = archive.read(api_types_member)
        protocol_document_bytes = archive.read(protocol_member)

    if sha256_bytes(api_types_bytes) != API_TYPES_SHA256:
        raise ProfileError("API types XSD SHA-256 mismatch")
    if sha256_bytes(protocol_document_bytes) != PROTOCOL_DOCUMENT_SHA256:
        raise ProfileError("protocol DOCX SHA-256 mismatch")

    root = ET.fromstring(api_types_bytes)
    types_namespace = root.attrib.get("targetNamespace")
    if not types_namespace:
        raise ProfileError("API types XSD targetNamespace is missing")

    message_data_type = required_complex_type(root, "MessageDataType")
    message_data_sequence = required_child(
        message_data_type,
        f"{{{XSD_NS}}}sequence",
        "MessageDataType sequence",
    )
    message_data_id = required_child(
        message_data_type,
        f"{{{XSD_NS}}}attribute",
        "MessageDataType Id attribute",
    )
    primary_content_any = required_child(
        required_complex_type(root, "MessagePrimaryContentType"),
        f"{{{XSD_NS}}}sequence/{{{XSD_NS}}}any",
        "MessagePrimaryContent wildcard",
    )
    signature_any = required_child(
        required_complex_type(root, "XMLDSigSignatureType"),
        f"{{{XSD_NS}}}sequence/{{{XSD_NS}}}any",
        "XMLDSig signature wildcard",
    )

    wrappers: list[dict[str, Any]] = []
    for name in (
        "SendRequestRequest",
        "SendRequestResponse",
        "SendResponseRequest",
        "SendResponseResponse",
        "AckRequest",
        "AckResponse",
    ):
        sequence = required_child(
            required_element(root, name),
            f"{{{XSD_NS}}}complexType/{{{XSD_NS}}}sequence",
            f"{name} sequence",
        )
        wrappers.append(
            {
                "name": name,
                "qname": f"{{{types_namespace}}}{name}",
                "fields": sequence_fields(sequence),
            }
        )

    response_code_type = required_complex_type(root, "MessageDataType")
    del response_code_type
    response_simple_types = [
        simple_type
        for simple_type in root.findall(f"{{{XSD_NS}}}simpleType")
        if simple_type.attrib.get("name") == "ResponseCodeType"
    ]
    if len(response_simple_types) != 1:
        raise ProfileError("ResponseCodeType expected once")
    response_codes = [
        enumeration.attrib["value"]
        for enumeration in response_simple_types[0].findall(
            f".//{{{XSD_NS}}}enumeration"
        )
    ]
    if response_codes != ["success", "accepted", "queue-is-empty", "ignored"]:
        raise ProfileError("response code authority drift")

    paragraphs = protocol_paragraphs(protocol_document_bytes)
    evidence_map = {
        "utf8": evidence(
            paragraphs,
            "utf8",
            "Электронные сообщения передаются в формате XML в кодировке UTF-8",
        ),
        "uuidV1": evidence(
            paragraphs,
            "uuidV1",
            "обязательный идентификатор сообщения в виде UUID версии 1",
        ),
        "referenceEquality": evidence(
            paragraphs,
            "referenceEquality",
            "Если отправляется запрос SendRequestRequest, то RefMessageID идентичен MessageID",
        ),
        "signatureTarget": evidence(
            paragraphs,
            "signatureTarget",
            "подписывается содержимое элемента, заключённое между открывающим и закрывающим тегами элемента",
        ),
        "digestUri": evidence(
            paragraphs,
            "digestUri",
            "urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34112012-256",
        ),
        "signatureUri": evidence(
            paragraphs,
            "signatureUri",
            "urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34102012-gostr34112012-256",
        ),
        "canonicalizationUri": evidence(
            paragraphs,
            "canonicalizationUri",
            "http://www.w3.org/2001/10/xml-exc-c14n#",
        ),
        "smevTransform": evidence(
            paragraphs,
            "smevTransform",
            "При подписании XML-фрагментов ЭЦП в формате XMLDSig, обязательно использование трансформации urn://smev-gov-ru/xmldsig/transform",
        ),
        "pkcs7Version": evidence(
            paragraphs,
            "pkcs7Version",
            "Формат подписи: версия 1.5 спецификации PKCS#7",
        ),
        "detached": evidence(
            paragraphs,
            "detached",
            "Подпись должна быть detached",
        ),
        "x509Only": evidence(
            paragraphs,
            "x509Only",
            "Разрешено применять только X-509 сертификаты",
        ),
        "singleSignature": evidence(
            paragraphs,
            "singleSignature",
            "Запрещено размещать более одной ЭЦП",
        ),
        "authenticatedAttributes": evidence(
            paragraphs,
            "authenticatedAttributes",
            "В элементе SignerInfo должны присутствовать следующие authenticated attributes",
        ),
        "rfc5652Order": evidence(
            paragraphs,
            "rfc5652Order",
            "должны быть упорядочены согласно формату RFC 5652",
        ),
    }

    return {
        "schemaVersion": "pc-crop.fgis-grain-message-data-profile.v1",
        "profileVersion": PROFILE_VERSION,
        "adapter": {
            "code": "FGIS_ZERNO",
            "apiVersion": "1.0.23",
            "mappingVersion": "fgis-zerno-1.0.23-catalog.v1",
            "catalogSha256": CATALOG_SHA256,
            "operationalStatus": "NOT_ATTESTED",
        },
        "sourceAuthority": {
            "packageFilename": "fgis-zerno-api-1.0.23.zip",
            "packageSha256": PACKAGE_SHA256,
            "protocolDocumentFilename": pathlib.PurePosixPath(
                protocol_member
            ).name,
            "protocolDocumentSha256": PROTOCOL_DOCUMENT_SHA256,
            "apiTypesFilename": "fgis-zerno-api-types-1.0.23.xsd",
            "apiTypesSha256": API_TYPES_SHA256,
            "evidence": evidence_map,
        },
        "xml": {
            "encoding": "UTF-8",
            "typesNamespace": types_namespace,
            "messageData": {
                "qname": f"{{{types_namespace}}}MessageData",
                "typeName": "MessageDataType",
                "fields": sequence_fields(message_data_sequence),
                "idAttribute": {
                    "name": message_data_id.attrib["name"],
                    "typeQName": message_data_id.attrib.get("type"),
                    "use": message_data_id.attrib.get("use", "optional"),
                },
                "primaryContentWildcard": {
                    "namespace": primary_content_any.attrib["namespace"],
                    "processContents": primary_content_any.attrib[
                        "processContents"
                    ],
                    "minOccurs": int(
                        primary_content_any.attrib.get("minOccurs", "1")
                    ),
                    "maxOccurs": primary_content_any.attrib.get(
                        "maxOccurs", "1"
                    ),
                },
            },
            "signatureWildcard": {
                "namespace": signature_any.attrib["namespace"],
                "processContents": signature_any.attrib["processContents"],
                "minOccurs": int(signature_any.attrib.get("minOccurs", "1")),
                "maxOccurs": signature_any.attrib.get("maxOccurs", "1"),
            },
            "wrappers": wrappers,
            "responseCodes": response_codes,
        },
        "signingPolicy": {
            "target": "MESSAGE_DATA_CONTENT",
            "targetElementQName": f"{{{types_namespace}}}MessageData",
            "xmlIdAttribute": "Id",
            "digestAlgorithm": {
                "name": "GOST_R_34_11_2012_256",
                "uri": "urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34112012-256",
            },
            "signatureAlgorithm": {
                "name": "GOST_R_34_10_2012_256",
                "uri": "urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34102012-gostr34112012-256",
            },
            "canonicalization": {
                "name": "EXCLUSIVE_XML_CANONICALIZATION_1_0",
                "uri": "http://www.w3.org/2001/10/xml-exc-c14n#",
                "implemented": False,
            },
            "transforms": [
                {
                    "name": "SMEV_XML_TRANSFORM",
                    "uri": "urn://smev-gov-ru/xmldsig/transform",
                    "implemented": False,
                }
            ],
            "container": {
                "format": "PKCS7",
                "version": "1.5",
                "detached": True,
                "certificateType": "X509",
                "maxSignatures": 1,
                "embeddedContent": False,
                "authenticatedAttributes": [
                    "1.2.840.113549.1.9.3",
                    "1.2.840.113549.1.9.4",
                ],
                "orderingStandard": "RFC5652",
            },
            "statuses": {
                "preparation": "PREPARED_NOT_CANONICALIZED",
                "signature": "NOT_SIGNED",
                "verification": "NOT_VERIFIED",
                "operational": "NOT_ATTESTED",
            },
            "platformEvidenceDigest": {
                "algorithm": "SHA-256",
                "purpose": "BYTE_IDENTITY_ONLY",
                "isGostDigest": False,
            },
        },
        "limits": {
            "maxBytes": 1_048_576,
            "maxDepth": 64,
            "maxNodes": 10_000,
            "maxAttributesPerElement": 64,
            "maxNamespaceDeclarations": 256,
            "maxNameLength": 256,
            "maxIdCount": 10_000,
        },
        "boundaries": {
            "fullSoapEnvelope": False,
            "mtomOrXop": False,
            "xmlCanonicalization": False,
            "smevTransform": False,
            "gostDigestOrSigning": False,
            "xmlDsigOrPkcs7Assembly": False,
            "credentialOrCertificateMaterial": False,
            "providerCall": False,
            "domainMutation": False,
            "secondInboxOutboxOrRelay": False,
            "confirmedLive": False,
            "productionHosting": "REG_RU_VPS_ONLY",
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", required=True, type=pathlib.Path)
    parser.add_argument("--profile-output", required=True, type=pathlib.Path)
    parser.add_argument("--lock-output", required=True, type=pathlib.Path)
    args = parser.parse_args()
    try:
        profile = build_profile(args.archive)
        profile_payload = canonical_json_bytes(profile)
        profile_sha256 = sha256_bytes(profile_payload)
        lock = {
            "schemaVersion": "pc-crop.fgis-grain-message-data-profile-lock.v1",
            "profileVersion": PROFILE_VERSION,
            "profileSha256": profile_sha256,
            "packageSha256": PACKAGE_SHA256,
            "protocolDocumentSha256": PROTOCOL_DOCUMENT_SHA256,
            "apiTypesSha256": API_TYPES_SHA256,
            "operationalStatus": "NOT_ATTESTED",
            "productionHosting": "REG_RU_VPS_ONLY",
        }
        args.profile_output.parent.mkdir(parents=True, exist_ok=True)
        args.profile_output.write_bytes(profile_payload)
        args.lock_output.parent.mkdir(parents=True, exist_ok=True)
        args.lock_output.write_bytes(canonical_json_bytes(lock))
    except (ProfileError, OSError, ET.ParseError, zipfile.BadZipFile) as error:
        print(f"PC-CROP-08C profile generation failed: {error}")
        return 1
    print(
        json.dumps(
            {
                "profileSha256": profile_sha256,
                "evidenceCount": len(profile["sourceAuthority"]["evidence"]),
                "wrapperCount": len(profile["xml"]["wrappers"]),
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
