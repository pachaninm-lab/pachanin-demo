from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Final

from tai.knowledge_chunking import ChunkingPolicy, DeterministicKnowledgeChunker
from tai.public_official_corpus import (
    PublicArtifactProvenance,
    PublicCorpusArtifact,
    PublicCorpusSnapshot,
    PublicOfficialCorpusBuilder,
    PublicSourceAdmission,
    SourceClass,
    SourceLocatorKind,
)

SOURCE_ID: Final = "official.rosstat.opendata.7708234640-vshp2016254"
DATASET_CODE: Final = "7708234640-VSHP2016254"
RIGHTS_DECISION_ID: Final = "AP14F0-ROSSTAT-OPEN-DATA-7708234640-VSHP2016254"
DATA_URI: Final = (
    "https://rosstat.gov.ru/opendata/7708234640-VSHP2016254/"
    "data-20181211T0212-structure-20181211T0212.xml"
)
STRUCTURE_URI: Final = (
    "https://rosstat.gov.ru/opendata/7708234640-VSHP2016254/"
    "structure-20181211T0212.xsd"
)
DATASET_URI: Final = "https://rosstat.gov.ru/opendata/7708234640-VSHP2016254"
RIGHTS_URI: Final = "https://rosstat.gov.ru/opendata/"
HOST_PIN: Final = "rosstat.gov.ru"
PASSPORT_SHA256: Final = "f3aa83bc421d56e5951e0c499686fc919d0fa73efcdc3d98a1012b3c827fb89e"
STRUCTURE_SHA256: Final = "c969338269a3dcf2b2e4949685e7e75d86e8ef587289df95fedd9a1054ddc2bc"
DATA_SHA256: Final = "fa9a5313d783acd6ba5075f2d673492db720f10968c2b18edb54cd95293e60cd"
RIGHTS_SEMANTIC_SHA256: Final = (
    "01f432c3c32a878db89329878c2d679f84302ca0006ea192f78e4ea1bce21ad7"
)
DATASET_SEMANTIC_SHA256: Final = (
    "dd9ecb1f3921fb387d2d87ae9dfd26cddbe037510365d501d82e08c20b62b055"
)
HISTORICAL_LABEL: Final = (
    "Исторические данные Всероссийской сельскохозяйственной переписи 2016 года; "
    "не являются текущими рыночными или хозяйственными данными."
)
ATTRIBUTION: Final = (
    "Источник: Росстат, набор 7708234640-VSHP2016254, опубликован 11.12.2018."
)
PUBLICATION_DATE: Final = date(2018, 12, 11)
EFFECTIVE_DATE: Final = date(2018, 12, 11)
PERIOD_START: Final = date(2016, 1, 1)
PERIOD_END: Final = date(2016, 12, 31)
RIGHTS_REVIEW_DUE_AT: Final = datetime(2026, 10, 29, tzinfo=UTC)
FRESHNESS_DUE_AT: Final = datetime(2031, 1, 1, tzinfo=UTC)
_SDMX_NAMESPACE_PREFIX: Final = "http://www.sdmx.org/resources/sdmxml/schemas/v2_0/"
_FORBIDDEN_XML: Final = re.compile(
    r"<!\s*(?:doctype|entity)|<\s*xi:include\b|\bsystem\s+[\"']|\bpublic\s+[\"']",
    re.IGNORECASE,
)
_PROMPT_MARKERS: Final = (
    "ignore previous instructions",
    "ignore all previous instructions",
    "disregard prior instructions",
    "reveal the system prompt",
    "system prompt:",
    "<|system|>",
    "<|assistant|>",
    "tool_call",
    "function_call",
)
_SECRET_PATTERNS: Final = (
    re.compile(r"-----begin (?:rsa |ec |openssh )?private key-----", re.IGNORECASE),
    re.compile(
        r"\b(?:api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]",
        re.IGNORECASE,
    ),
    re.compile(r"\bsk-[a-z0-9_-]{20,}\b", re.IGNORECASE),
)
_PII_PATTERNS: Final = (
    re.compile(r"\b\d{3}-\d{3}-\d{3}\s?\d{2}\b"),
    re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE),
)
_BIDI_CONTROLS: Final = frozenset(
    {
        "\u061c",
        "\u200e",
        "\u200f",
        "\u202a",
        "\u202b",
        "\u202c",
        "\u202d",
        "\u202e",
        "\u2066",
        "\u2067",
        "\u2068",
        "\u2069",
    }
)


@dataclass(frozen=True, slots=True)
class RosstatSdmxRecord:
    ordinal: int
    xpath: str
    value: str
    value_sha256: str
    fragment_sha256: str

    def __post_init__(self) -> None:
        if self.ordinal < 0:
            raise ValueError("record ordinal must be non-negative")
        if not self.xpath.startswith("/") or len(self.xpath) > 1024:
            raise ValueError("record XPath must be absolute and bounded")
        normalized = _normalize(self.value)
        if not normalized:
            raise ValueError("record value must not be blank")
        if len(normalized.encode("utf-8")) > 1024:
            raise ValueError("record value is too large")
        expected_value = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        if self.value_sha256 != expected_value:
            raise ValueError("record value digest mismatch")
        expected_fragment = hashlib.sha256(
            f"XML_XPATH\n{self.xpath}\n{self.ordinal}\n{normalized}".encode("utf-8")
        ).hexdigest()
        if self.fragment_sha256 != expected_fragment:
            raise ValueError("record fragment digest mismatch")
        object.__setattr__(self, "value", normalized)


@dataclass(frozen=True, slots=True)
class RosstatMaterialization:
    observed_at: datetime
    artifact_sha256: str
    artifact_size_bytes: int
    artifact_text: str
    records: tuple[RosstatSdmxRecord, ...]
    admission: PublicSourceAdmission
    provenance: PublicArtifactProvenance
    artifact: PublicCorpusArtifact
    snapshot: PublicCorpusSnapshot

    @property
    def snapshot_sha256(self) -> str:
        return self.snapshot.snapshot_sha256

    @property
    def chunks(self) -> tuple[dict[str, object], ...]:
        valid_until = min(
            self.admission.rights_review_due_at,
            self.provenance.freshness_due_at,
        )
        return tuple(
            {
                "ordinal": chunk.ordinal,
                "chunkId": chunk.chunk_id,
                "text": chunk.text,
                "tokenEstimate": chunk.token_estimate,
                "artifactSha256": self.artifact_sha256,
                "sourceId": SOURCE_ID,
                "validUntil": valid_until.isoformat(),
            }
            for chunk in self.snapshot.chunks
        )

    def to_json(self) -> dict[str, object]:
        return {
            "schemaVersion": "tai.ap14f1c-rosstat-materialization.v2",
            "sourceId": SOURCE_ID,
            "datasetCode": DATASET_CODE,
            "rightsDecisionId": RIGHTS_DECISION_ID,
            "officialUri": DATA_URI,
            "structureUri": STRUCTURE_URI,
            "datasetUri": DATASET_URI,
            "rightsUri": RIGHTS_URI,
            "hostPin": HOST_PIN,
            "publicationDate": PUBLICATION_DATE.isoformat(),
            "effectiveDate": EFFECTIVE_DATE.isoformat(),
            "periodStart": PERIOD_START.isoformat(),
            "periodEnd": PERIOD_END.isoformat(),
            "declaredActualThrough": "2030-12-31",
            "historicalLabel": HISTORICAL_LABEL,
            "attribution": ATTRIBUTION,
            "rawEvidence": {
                "passportSha256": PASSPORT_SHA256,
                "structureSha256": STRUCTURE_SHA256,
                "dataSha256": DATA_SHA256,
                "rightsSemanticSha256": RIGHTS_SEMANTIC_SHA256,
                "datasetSemanticSha256": DATASET_SEMANTIC_SHA256,
            },
            "observedAt": self.observed_at.isoformat(),
            "artifactSha256": self.artifact_sha256,
            "artifactSizeBytes": self.artifact_size_bytes,
            "artifactText": self.artifact_text,
            "records": [
                {
                    "ordinal": record.ordinal,
                    "xpath": record.xpath,
                    "value": record.value,
                    "valueSha256": record.value_sha256,
                    "fragmentSha256": record.fragment_sha256,
                    "publicationDate": PUBLICATION_DATE.isoformat(),
                    "periodStart": PERIOD_START.isoformat(),
                    "periodEnd": PERIOD_END.isoformat(),
                    "sourceUri": DATA_URI,
                }
                for record in self.records
            ],
            "snapshotSha256": self.snapshot_sha256,
            "chunks": list(self.chunks),
            "rawBytesPersisted": False,
            "tenantId": None,
            "sharedRagCandidate": True,
            "sharedRagActivated": False,
            "operationalStatus": "NOT_ATTESTED",
            "productionHosting": "REG_RU_VPS_ONLY",
        }


class RosstatVshp2016254Materializer:
    def __init__(
        self,
        *,
        maximum_depth: int = 32,
        maximum_nodes: int = 100_000,
        maximum_attributes: int = 500_000,
        maximum_records: int = 100_000,
        maximum_text_bytes: int = 20_000_000,
    ) -> None:
        self.maximum_depth = maximum_depth
        self.maximum_nodes = maximum_nodes
        self.maximum_attributes = maximum_attributes
        self.maximum_records = maximum_records
        self.maximum_text_bytes = maximum_text_bytes
        for name, value in (
            ("maximum_depth", maximum_depth),
            ("maximum_nodes", maximum_nodes),
            ("maximum_attributes", maximum_attributes),
            ("maximum_records", maximum_records),
            ("maximum_text_bytes", maximum_text_bytes),
        ):
            if value < 1:
                raise ValueError(f"{name} must be positive")

    def materialize(
        self,
        *,
        passport_csv: bytes,
        structure_xml: bytes,
        data_xml: bytes,
        observed_at: datetime,
    ) -> RosstatMaterialization:
        observed = _aware(observed_at)
        if observed >= RIGHTS_REVIEW_DUE_AT:
            raise ValueError("ROSSTAT_RIGHTS_REVIEW_EXPIRED")
        _require_digest(passport_csv, PASSPORT_SHA256, "passport")
        _require_digest(structure_xml, STRUCTURE_SHA256, "structure")
        _require_digest(data_xml, DATA_SHA256, "data")
        self._validate_passport(passport_csv)
        self._validate_structure(structure_xml)
        records = self._records(data_xml)
        artifact_text = self._artifact_text(records)
        artifact_bytes = artifact_text.encode("utf-8")
        if len(artifact_bytes) > 20_000_000:
            raise ValueError("ROSSTAT_ARTIFACT_SIZE_LIMIT_EXCEEDED")
        artifact_sha256 = hashlib.sha256(artifact_bytes).hexdigest()

        admission = PublicSourceAdmission(
            source_id=SOURCE_ID,
            source_class=SourceClass.OPEN_DATASET,
            rights_decision_id=RIGHTS_DECISION_ID,
            official_uri=DATA_URI,
            host_pin=HOST_PIN,
            rights_review_due_at=RIGHTS_REVIEW_DUE_AT,
            admitted_at=observed,
            trust_score=0.97,
        )
        provenance = PublicArtifactProvenance(
            record_id=f"prov_{artifact_sha256[:32]}",
            source_id=SOURCE_ID,
            source_class=SourceClass.OPEN_DATASET,
            rights_decision_id=RIGHTS_DECISION_ID,
            official_uri=DATA_URI,
            host_pin=HOST_PIN,
            content_sha256=artifact_sha256,
            media_type="text/plain",
            size_bytes=len(artifact_bytes),
            publication_date=PUBLICATION_DATE,
            effective_date=EFFECTIVE_DATE,
            observed_at=observed,
            locator_kind=SourceLocatorKind.XML_XPATH,
            locator_value="/GenericData[1]/DataSet[1]",
            freshness_due_at=FRESHNESS_DUE_AT,
            period_start=PERIOD_START,
            period_end=PERIOD_END,
        )
        artifact = PublicCorpusArtifact(provenance=provenance, normalized_text=artifact_text)
        chunker = DeterministicKnowledgeChunker(
            ChunkingPolicy(max_chars=4096, overlap_chars=0, min_chars=1)
        )
        snapshot = PublicOfficialCorpusBuilder(chunker).build(
            admissions=(admission,),
            artifacts=(artifact,),
            now=observed,
        )
        for chunk in snapshot.chunks:
            if (
                HISTORICAL_LABEL not in chunk.text
                or DATA_URI not in chunk.text
                or "XPath:" not in chunk.text
            ):
                raise ValueError("ROSSTAT_CHUNK_CITATION_CONTRACT_FAILED")
        return RosstatMaterialization(
            observed_at=observed,
            artifact_sha256=artifact_sha256,
            artifact_size_bytes=len(artifact_bytes),
            artifact_text=artifact_text,
            records=records,
            admission=admission,
            provenance=provenance,
            artifact=artifact,
            snapshot=snapshot,
        )

    @staticmethod
    def _validate_passport(payload: bytes) -> None:
        text = payload.decode("utf-8-sig", errors="strict")
        for marker in (
            DATASET_CODE,
            "structure-20181211T0212.xsd",
            "data-20181211T0212-structure-20181211T0212.xml",
        ):
            if marker not in text:
                raise ValueError("ROSSTAT_PASSPORT_PROVENANCE_INCOMPLETE")

    def _validate_structure(self, payload: bytes) -> None:
        text = _decode_xml(payload)
        _reject_unsafe_xml(text)
        try:
            root = ET.fromstring(text)  # noqa: S314 - DTD/entities are rejected first.
        except ET.ParseError as error:
            raise ValueError("ROSSTAT_SDMX_STRUCTURE_INVALID") from error
        namespace, local = _expanded_name(root.tag)
        if local != "Structure" or namespace != f"{_SDMX_NAMESPACE_PREFIX}message":
            raise ValueError("ROSSTAT_SDMX_STRUCTURE_ROOT_MISMATCH")
        rendered = text.casefold()
        for suffix in ("message", "structure", "common"):
            if f"{_SDMX_NAMESPACE_PREFIX}{suffix}" not in rendered:
                raise ValueError("ROSSTAT_SDMX_STRUCTURE_NAMESPACE_MISSING")
        expected_dataset_id = DATASET_CODE.casefold().replace("vshp2016254", "vshp2016-254")
        if expected_dataset_id not in rendered:
            raise ValueError("ROSSTAT_SDMX_STRUCTURE_DATASET_ID_MISSING")
        if re.search(r"<(?:xs|xsd):schema(?:\s|>)", text, re.IGNORECASE):
            raise ValueError("ROSSTAT_SDMX_RESOURCE_IS_UNEXPECTED_XSD")

    def _records(self, payload: bytes) -> tuple[RosstatSdmxRecord, ...]:
        text = _decode_xml(payload)
        _reject_unsafe_xml(text)
        try:
            root = ET.fromstring(text)  # noqa: S314 - DTD/entities are rejected first.
        except ET.ParseError as error:
            raise ValueError("ROSSTAT_SDMX_DATA_INVALID") from error
        namespace, root_local = _expanded_name(root.tag)
        if not namespace.startswith(_SDMX_NAMESPACE_PREFIX):
            raise ValueError("ROSSTAT_SDMX_DATA_NAMESPACE_MISMATCH")
        if root_local.casefold() in {"html", "error", "structure"}:
            raise ValueError("ROSSTAT_SDMX_DATA_ROOT_MISMATCH")

        records: list[RosstatSdmxRecord] = []
        counters = {"nodes": 0, "attributes": 0, "text_bytes": 0}

        def append(xpath: str, raw_value: str) -> None:
            value = _normalize(raw_value)
            if not value:
                return
            _content_safety(value)
            counters["text_bytes"] += len(value.encode("utf-8"))
            if counters["text_bytes"] > self.maximum_text_bytes:
                raise ValueError("ROSSTAT_SDMX_TEXT_LIMIT_EXCEEDED")
            if len(records) >= self.maximum_records:
                raise ValueError("ROSSTAT_SDMX_RECORD_LIMIT_EXCEEDED")
            ordinal = len(records)
            records.append(
                RosstatSdmxRecord(
                    ordinal=ordinal,
                    xpath=xpath,
                    value=value,
                    value_sha256=hashlib.sha256(value.encode("utf-8")).hexdigest(),
                    fragment_sha256=hashlib.sha256(
                        f"XML_XPATH\n{xpath}\n{ordinal}\n{value}".encode("utf-8")
                    ).hexdigest(),
                )
            )

        def walk(element: ET.Element, path: str, depth: int) -> None:
            if depth > self.maximum_depth:
                raise ValueError("ROSSTAT_SDMX_DEPTH_LIMIT_EXCEEDED")
            counters["nodes"] += 1
            if counters["nodes"] > self.maximum_nodes:
                raise ValueError("ROSSTAT_SDMX_NODE_LIMIT_EXCEEDED")
            counters["attributes"] += len(element.attrib)
            if counters["attributes"] > self.maximum_attributes:
                raise ValueError("ROSSTAT_SDMX_ATTRIBUTE_LIMIT_EXCEEDED")
            for raw_name, raw_value in sorted(
                element.attrib.items(), key=lambda item: _expanded_name(item[0])[1]
            ):
                attribute_name = _expanded_name(raw_name)[1]
                append(f"{path}/@{attribute_name}", raw_value)
            append(f"{path}/text()", element.text or "")

            sibling_counts: dict[str, int] = {}
            for child in list(element):
                child_local = _expanded_name(child.tag)[1]
                sibling_counts[child_local] = sibling_counts.get(child_local, 0) + 1
                child_path = f"{path}/{child_local}[{sibling_counts[child_local]}]"
                walk(child, child_path, depth + 1)
                append(f"{child_path}/tail()", child.tail or "")

        walk(root, f"/{root_local}[1]", 0)
        if not records:
            raise ValueError("ROSSTAT_SDMX_DATA_EMPTY")
        if len({record.xpath for record in records}) != len(records):
            raise ValueError("ROSSTAT_SDMX_DUPLICATE_LOCATOR")
        return tuple(records)

    @staticmethod
    def _artifact_text(records: tuple[RosstatSdmxRecord, ...]) -> str:
        paragraphs: list[str] = []
        for record in records:
            paragraph = "\n".join(
                (
                    HISTORICAL_LABEL,
                    ATTRIBUTION,
                    f"Официальный URI данных: {DATA_URI}",
                    f"URI структуры SDMX: {STRUCTURE_URI}",
                    f"Дата публикации: {PUBLICATION_DATE.isoformat()}",
                    f"Период данных: {PERIOD_START.isoformat()} — {PERIOD_END.isoformat()}",
                    f"SHA-256 исходного XML: {DATA_SHA256}",
                    f"XPath: {record.xpath}",
                    f"Значение: {record.value}",
                )
            )
            if len(paragraph) > 3900:
                raise ValueError("ROSSTAT_RECORD_RENDER_LIMIT_EXCEEDED")
            paragraphs.append(paragraph)
        return "\n\n".join(paragraphs)


def _normalize(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).split())


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("observed_at must be timezone-aware")
    return value.astimezone(UTC)


def _require_digest(payload: bytes, expected: str, label: str) -> None:
    actual = hashlib.sha256(payload).hexdigest()
    if actual != expected:
        raise ValueError(f"ROSSTAT_{label.upper()}_DIGEST_MISMATCH")


def _decode_xml(payload: bytes) -> str:
    if payload.startswith(b"\xef\xbb\xbf"):
        return payload[3:].decode("utf-8", errors="strict")
    if payload.startswith(b"\xff\xfe"):
        return payload[2:].decode("utf-16-le", errors="strict")
    if payload.startswith(b"\xfe\xff"):
        return payload[2:].decode("utf-16-be", errors="strict")
    if payload.startswith(b"<\x00?\x00"):
        return payload.decode("utf-16-le", errors="strict")
    if payload.startswith(b"\x00<\x00?"):
        return payload.decode("utf-16-be", errors="strict")
    return payload.decode("utf-8", errors="strict")


def _expanded_name(value: str) -> tuple[str, str]:
    if value.startswith("{") and "}" in value:
        namespace, local = value[1:].split("}", 1)
        return namespace, local
    return "", value


def _reject_unsafe_xml(value: str) -> None:
    if _FORBIDDEN_XML.search(value):
        raise ValueError("ROSSTAT_XML_EXTERNAL_OR_ENTITY_FORBIDDEN")
    _content_safety(value)


def _content_safety(value: str) -> None:
    normalized = unicodedata.normalize("NFKC", value).casefold()
    if any(character in value for character in _BIDI_CONTROLS):
        raise ValueError("ROSSTAT_BIDI_CONTROL_DETECTED")
    if any(marker in normalized for marker in _PROMPT_MARKERS):
        raise ValueError("ROSSTAT_PROMPT_INJECTION_DETECTED")
    if any(pattern.search(value) for pattern in _SECRET_PATTERNS):
        raise ValueError("ROSSTAT_CREDENTIAL_INDICATOR_DETECTED")
    if any(pattern.search(value) for pattern in _PII_PATTERNS):
        raise ValueError("ROSSTAT_PII_INDICATOR_DETECTED")


def _parse_datetime(value: str) -> datetime:
    return _aware(datetime.fromisoformat(value.replace("Z", "+00:00")))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--passport-csv", type=Path, required=True)
    parser.add_argument("--structure-xml", type=Path, required=True)
    parser.add_argument("--data-xml", type=Path, required=True)
    parser.add_argument("--observed-at", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    materialization = RosstatVshp2016254Materializer().materialize(
        passport_csv=args.passport_csv.read_bytes(),
        structure_xml=args.structure_xml.read_bytes(),
        data_xml=args.data_xml.read_bytes(),
        observed_at=_parse_datetime(args.observed_at),
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(materialization.to_json(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "artifactSha256": materialization.artifact_sha256,
                "recordCount": len(materialization.records),
                "chunkCount": len(materialization.chunks),
                "snapshotSha256": materialization.snapshot_sha256,
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
