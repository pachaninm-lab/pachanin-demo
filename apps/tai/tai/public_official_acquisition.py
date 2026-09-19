from __future__ import annotations

import hashlib
import html
import ipaddress
import json
import math
import re
import unicodedata
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from html.parser import HTMLParser
from urllib.parse import SplitResult, unquote, urlsplit

from tai.public_official_corpus import SourceLocatorKind

_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_RUN_ID = re.compile(r"^acq_[a-z0-9]{16,64}$")
_SOURCE_ID = re.compile(r"^[a-z0-9][a-z0-9._-]{4,160}$")
_LEASE_TOKEN = re.compile(r"^lease_[a-z0-9]{24,96}$")
_SAFE_CHARSETS = frozenset({"utf-8", "utf8", "windows-1251", "cp1251"})
_TEXT_MEDIA_TYPES = frozenset(
    {"text/plain", "text/html", "application/json", "application/xml", "text/xml"}
)
_BIDI_CONTROLS = frozenset(
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
_PROMPT_MARKERS = (
    "ignore previous instructions",
    "ignore all previous instructions",
    "disregard prior instructions",
    "reveal the system prompt",
    "system prompt:",
    "<|system|>",
    "<|assistant|>",
    "tool_call",
    "function_call",
    "assistant to=",
)
_SECRET_PATTERNS = (
    re.compile(r"-----begin (?:rsa |ec |openssh )?private key-----", re.I),
    re.compile(r"\b(?:api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]", re.I),
    re.compile(r"\bsk-[a-z0-9_-]{20,}\b", re.I),
)
_PII_PATTERNS = (
    re.compile(r"\b\d{3}-\d{3}-\d{3}\s?\d{2}\b"),
    re.compile(r"\b\d{4}\s?\d{6}\b"),
)
_ACTIVE_HTML_TAGS = frozenset({"script", "style", "iframe", "object", "embed", "applet"})
_UNSAFE_SCHEMES = ("javascript:", "data:", "vbscript:", "file:")
_XML_FORBIDDEN = re.compile(r"<!\s*(?:doctype|entity)|\bsystem\s+[\"']|\bpublic\s+[\"']", re.I)
_BINARY_PREFIXES = (
    b"%PDF-",
    b"PK\x03\x04",
    b"\x89PNG\r\n\x1a\n",
    b"\xff\xd8\xff",
    b"\x7fELF",
    b"MZ",
)


class AcquisitionOutcome(StrEnum):
    STARTED = "STARTED"
    NOT_MODIFIED = "NOT_MODIFIED"
    MATERIALIZED = "MATERIALIZED"
    QUARANTINED = "QUARANTINED"
    RETRYABLE_FAILURE = "RETRYABLE_FAILURE"
    PERMANENT_FAILURE = "PERMANENT_FAILURE"


class ParserKind(StrEnum):
    TEXT = "TEXT"
    HTML = "HTML"
    JSON = "JSON"
    XML = "XML"


@dataclass(frozen=True, slots=True)
class ExtractionLimits:
    maximum_depth: int = 32
    maximum_nodes: int = 25_000
    maximum_text_bytes: int = 5_000_000
    maximum_attributes: int = 100_000
    maximum_fragments: int = 20_000

    def __post_init__(self) -> None:
        for name, value in (
            ("maximum_depth", self.maximum_depth),
            ("maximum_nodes", self.maximum_nodes),
            ("maximum_text_bytes", self.maximum_text_bytes),
            ("maximum_attributes", self.maximum_attributes),
            ("maximum_fragments", self.maximum_fragments),
        ):
            if value < 1:
                raise ValueError(f"{name} must be positive")


@dataclass(frozen=True, slots=True)
class SourceRoutePolicy:
    allowed_hosts: frozenset[str]
    allowed_path_prefixes: tuple[str, ...]

    def __post_init__(self) -> None:
        if not self.allowed_hosts or any(host != host.casefold() for host in self.allowed_hosts):
            raise ValueError("allowed_hosts must be non-empty lowercase hostnames")
        normalized: list[str] = []
        for prefix in self.allowed_path_prefixes:
            decoded = _decoded_safe_path(prefix)
            if not decoded.startswith("/") or "?" in prefix or "#" in prefix:
                raise ValueError("allowed path prefixes must be absolute path-only values")
            normalized.append(decoded.rstrip("/") or "/")
        if not normalized:
            raise ValueError("allowed_path_prefixes must not be empty")
        object.__setattr__(self, "allowed_path_prefixes", tuple(sorted(set(normalized))))

    def validate(self, uri: str) -> SplitResult:
        try:
            parsed = urlsplit(uri)
            port = parsed.port
        except ValueError as error:
            raise ValueError("ACQUISITION_URI_INVALID") from error
        host = parsed.hostname
        if parsed.scheme != "https":
            raise ValueError("ACQUISITION_HTTPS_REQUIRED")
        if not host or host.casefold() not in self.allowed_hosts:
            raise ValueError("ACQUISITION_HOST_NOT_ALLOWED")
        if parsed.username or parsed.password or parsed.fragment:
            raise ValueError("ACQUISITION_URI_CREDENTIAL_OR_FRAGMENT")
        if port not in {None, 443}:
            raise ValueError("ACQUISITION_PORT_NOT_ALLOWED")
        if any(ord(character) < 32 for character in uri):
            raise ValueError("ACQUISITION_PATH_INVALID")
        path = _decoded_safe_path(parsed.path or "/")
        if not any(_segment_bounded_prefix(path, prefix) for prefix in self.allowed_path_prefixes):
            raise ValueError("ACQUISITION_PATH_ESCAPE")
        return parsed

    def validate_redirect(self, requested_uri: str, final_uri: str) -> None:
        requested = self.validate(requested_uri)
        final = self.validate(final_uri)
        if requested.hostname != final.hostname:
            raise ValueError("ACQUISITION_CROSS_HOST_REDIRECT")


@dataclass(frozen=True, slots=True)
class AcquisitionLease:
    run_id: str
    source_id: str
    owner_id: str
    lease_token: str
    lease_version: int
    acquired_at: datetime
    expires_at: datetime

    def __post_init__(self) -> None:
        if _RUN_ID.fullmatch(self.run_id) is None:
            raise ValueError("run_id does not satisfy acquisition identity")
        if _SOURCE_ID.fullmatch(self.source_id) is None:
            raise ValueError("source_id does not satisfy acquisition identity")
        if not self.owner_id.strip() or len(self.owner_id) > 160:
            raise ValueError("owner_id must be non-blank and bounded")
        if _LEASE_TOKEN.fullmatch(self.lease_token) is None:
            raise ValueError("lease_token does not satisfy fencing identity")
        if self.lease_version < 1:
            raise ValueError("lease_version must be positive")
        acquired = _aware(self.acquired_at, "acquired_at")
        expires = _aware(self.expires_at, "expires_at")
        if expires <= acquired:
            raise ValueError("lease expiry must follow acquisition")
        object.__setattr__(self, "acquired_at", acquired)
        object.__setattr__(self, "expires_at", expires)

    def assert_valid(self, *, now: datetime, owner_id: str, token: str, version: int) -> None:
        current = _aware(now, "now")
        if current >= self.expires_at:
            raise ValueError("ACQUISITION_LEASE_EXPIRED")
        if owner_id != self.owner_id or token != self.lease_token or version != self.lease_version:
            raise ValueError("ACQUISITION_LEASE_FENCE_MISMATCH")


@dataclass(frozen=True, slots=True)
class RawArtifactManifest:
    run_id: str
    source_id: str
    requested_uri: str
    final_uri: str
    wire_sha256: str
    decoded_sha256: str
    wire_size_bytes: int
    decoded_size_bytes: int
    media_type: str
    charset: str
    response_headers_sha256: str
    resolved_ip: str
    tls_server_name: str
    requested_at: datetime
    received_at: datetime
    transport_result: str

    def __post_init__(self) -> None:
        if _RUN_ID.fullmatch(self.run_id) is None or _SOURCE_ID.fullmatch(self.source_id) is None:
            raise ValueError("manifest identity is invalid")
        for field_name in ("wire_sha256", "decoded_sha256", "response_headers_sha256"):
            raw_value = getattr(self, field_name).strip()
            if raw_value != raw_value.casefold() or _SHA256.fullmatch(raw_value) is None:
                raise ValueError(f"{field_name} must be lowercase SHA-256")
            object.__setattr__(self, field_name, raw_value)
        if self.wire_size_bytes < 0 or self.decoded_size_bytes < 0:
            raise ValueError("manifest sizes must be non-negative")
        media_type = self.media_type.strip().casefold()
        charset = self.charset.strip().casefold()
        if media_type not in _TEXT_MEDIA_TYPES:
            raise ValueError("manifest media_type is not admitted")
        if charset not in _SAFE_CHARSETS:
            raise ValueError("manifest charset is not admitted")
        object.__setattr__(self, "media_type", media_type)
        object.__setattr__(self, "charset", charset)
        address = ipaddress.ip_address(self.resolved_ip)
        if not address.is_global:
            raise ValueError("manifest resolved_ip must be public")
        final_host = (urlsplit(self.final_uri).hostname or "").casefold()
        if self.tls_server_name.casefold() != final_host:
            raise ValueError("manifest TLS server name does not match final URI")
        requested = _aware(self.requested_at, "requested_at")
        received = _aware(self.received_at, "received_at")
        if received < requested:
            raise ValueError("manifest receive time precedes request")
        object.__setattr__(self, "requested_at", requested)
        object.__setattr__(self, "received_at", received)

    @property
    def evidence_sha256(self) -> str:
        payload = "\n".join(
            str(value)
            for value in (
                self.run_id,
                self.source_id,
                self.requested_uri,
                self.final_uri,
                self.wire_sha256,
                self.decoded_sha256,
                self.wire_size_bytes,
                self.decoded_size_bytes,
                self.media_type,
                self.charset,
                self.response_headers_sha256,
                self.resolved_ip,
                self.tls_server_name,
                self.requested_at.isoformat(),
                self.received_at.isoformat(),
                self.transport_result,
            )
        ).encode("utf-8")
        return hashlib.sha256(payload).hexdigest()


@dataclass(frozen=True, slots=True)
class ExtractedFragment:
    locator_kind: SourceLocatorKind
    locator_value: str
    text: str
    ordinal: int

    def __post_init__(self) -> None:
        normalized = _normalize_text(self.text)
        if not normalized:
            raise ValueError("fragment text must not be blank")
        if not self.locator_value.strip() or len(self.locator_value) > 2048:
            raise ValueError("fragment locator must be non-blank and bounded")
        if self.ordinal < 0:
            raise ValueError("fragment ordinal must be non-negative")
        object.__setattr__(self, "text", normalized)

    @property
    def fragment_sha256(self) -> str:
        payload = (
            f"{self.locator_kind.value}\n{self.locator_value}\n{self.ordinal}\n{self.text}"
        ).encode()
        return hashlib.sha256(payload).hexdigest()


@dataclass(frozen=True, slots=True)
class AcquisitionTerminalRecord:
    run_id: str
    outcome: AcquisitionOutcome
    manifest_sha256: str | None
    fragment_sha256s: tuple[str, ...]
    reason_code: str | None
    completed_at: datetime

    def __post_init__(self) -> None:
        if _RUN_ID.fullmatch(self.run_id) is None:
            raise ValueError("terminal run_id is invalid")
        if self.outcome is AcquisitionOutcome.STARTED:
            raise ValueError("terminal outcome cannot be STARTED")
        if self.manifest_sha256 is not None:
            value = self.manifest_sha256.strip()
            if value != value.casefold() or _SHA256.fullmatch(value) is None:
                raise ValueError("terminal manifest digest is invalid")
            object.__setattr__(self, "manifest_sha256", value)
        if tuple(sorted(set(self.fragment_sha256s))) != self.fragment_sha256s:
            raise ValueError("terminal fragment digests must be sorted and unique")
        if any(
            value != value.casefold() or _SHA256.fullmatch(value) is None
            for value in self.fragment_sha256s
        ):
            raise ValueError("terminal fragment digest is invalid")
        object.__setattr__(self, "completed_at", _aware(self.completed_at, "completed_at"))

    @property
    def terminal_sha256(self) -> str:
        payload = "\n".join(
            (
                self.run_id,
                self.outcome.value,
                self.manifest_sha256 or "",
                ",".join(self.fragment_sha256s),
                self.reason_code or "",
                self.completed_at.isoformat(),
            )
        ).encode("utf-8")
        return hashlib.sha256(payload).hexdigest()


@dataclass(slots=True)
class AcquisitionRunAuthority:
    leases: dict[str, AcquisitionLease] = field(default_factory=dict)
    manifests: dict[str, RawArtifactManifest] = field(default_factory=dict)
    terminals: dict[str, AcquisitionTerminalRecord] = field(default_factory=dict)

    def start(self, lease: AcquisitionLease) -> AcquisitionLease:
        existing = self.leases.get(lease.run_id)
        if existing is not None and existing != lease:
            raise ValueError("ACQUISITION_RUN_CONFLICT")
        self.leases[lease.run_id] = existing or lease
        return self.leases[lease.run_id]

    def record_manifest(
        self,
        manifest: RawArtifactManifest,
        *,
        now: datetime,
        owner_id: str,
        lease_token: str,
        lease_version: int,
        route_policy: SourceRoutePolicy,
    ) -> RawArtifactManifest:
        lease = self._lease(manifest.run_id)
        lease.assert_valid(now=now, owner_id=owner_id, token=lease_token, version=lease_version)
        if manifest.source_id != lease.source_id:
            raise ValueError("ACQUISITION_SOURCE_MISMATCH")
        route_policy.validate_redirect(manifest.requested_uri, manifest.final_uri)
        existing = self.manifests.get(manifest.run_id)
        if existing is not None and existing.evidence_sha256 != manifest.evidence_sha256:
            raise ValueError("ACQUISITION_MANIFEST_REPLAY_CONFLICT")
        self.manifests[manifest.run_id] = existing or manifest
        return self.manifests[manifest.run_id]

    def complete(
        self,
        record: AcquisitionTerminalRecord,
        *,
        now: datetime,
        owner_id: str,
        lease_token: str,
        lease_version: int,
        rights_current: bool,
        quarantine_open: bool,
        source_withdrawn: bool,
    ) -> AcquisitionTerminalRecord:
        lease = self._lease(record.run_id)
        lease.assert_valid(now=now, owner_id=owner_id, token=lease_token, version=lease_version)
        if record.outcome is AcquisitionOutcome.MATERIALIZED:
            if not rights_current:
                raise ValueError("ACQUISITION_RIGHTS_EXPIRED")
            if quarantine_open:
                raise ValueError("ACQUISITION_OPEN_QUARANTINE")
            if source_withdrawn:
                raise ValueError("ACQUISITION_SOURCE_WITHDRAWN")
            manifest = self.manifests.get(record.run_id)
            if manifest is None or manifest.evidence_sha256 != record.manifest_sha256:
                raise ValueError("ACQUISITION_MANIFEST_REQUIRED")
            if not record.fragment_sha256s:
                raise ValueError("ACQUISITION_FRAGMENTS_REQUIRED")
        existing = self.terminals.get(record.run_id)
        if existing is not None and existing.terminal_sha256 != record.terminal_sha256:
            raise ValueError("ACQUISITION_TERMINAL_REPLAY_CONFLICT")
        self.terminals[record.run_id] = existing or record
        return self.terminals[record.run_id]

    def _lease(self, run_id: str) -> AcquisitionLease:
        try:
            return self.leases[run_id]
        except KeyError as error:
            raise ValueError("ACQUISITION_RUN_NOT_STARTED") from error


class SafePublicExtractor:
    def __init__(self, limits: ExtractionLimits | None = None) -> None:
        self.limits = limits or ExtractionLimits()

    def extract(
        self,
        *,
        media_type: str,
        decoded_body: bytes,
        charset: str,
    ) -> tuple[ExtractedFragment, ...]:
        media = media_type.strip().casefold()
        encoding = charset.strip().casefold()
        if media not in _TEXT_MEDIA_TYPES or encoding not in _SAFE_CHARSETS:
            raise ValueError("ACQUISITION_MIME_OR_CHARSET_NOT_ALLOWED")
        if len(decoded_body) > self.limits.maximum_text_bytes:
            raise ValueError("ACQUISITION_DECODED_LIMIT_EXCEEDED")
        _reject_binary_or_mime_mismatch(media, decoded_body)
        try:
            text = decoded_body.decode(encoding, errors="strict")
        except UnicodeDecodeError as error:
            raise ValueError("ACQUISITION_DECODE_FAILED") from error
        _content_safety(text)
        if media == "text/plain":
            fragments = self._text(text)
        elif media == "text/html":
            fragments = self._html(text)
        elif media == "application/json":
            fragments = self._json(text)
        else:
            fragments = self._xml(text)
        if len(fragments) > self.limits.maximum_fragments:
            raise ValueError("ACQUISITION_FRAGMENT_LIMIT_EXCEEDED")
        return tuple(fragments)

    def _text(self, text: str) -> list[ExtractedFragment]:
        normalized = _normalize_text(text)
        if not normalized:
            raise ValueError("ACQUISITION_TEXT_EMPTY")
        return [ExtractedFragment(SourceLocatorKind.SECTION, "text://body", normalized, 0)]

    def _html(self, text: str) -> list[ExtractedFragment]:
        parser = _SafeHTMLCollector(self.limits)
        parser.feed(text)
        parser.close()
        if not parser.fragments:
            raise ValueError("ACQUISITION_HTML_EMPTY")
        return [
            ExtractedFragment(
                SourceLocatorKind.SECTION,
                f"html://text[{index + 1}]",
                value,
                index,
            )
            for index, value in enumerate(parser.fragments)
        ]

    def _json(self, text: str) -> list[ExtractedFragment]:
        def pairs(values: list[tuple[str, object]]) -> dict[str, object]:
            result: dict[str, object] = {}
            for key, value in values:
                if key in result:
                    raise ValueError("ACQUISITION_JSON_DUPLICATE_KEY")
                result[key] = value
            return result

        def non_finite(value: str) -> object:
            raise ValueError(f"ACQUISITION_JSON_NON_FINITE:{value}")

        try:
            root = json.loads(text, object_pairs_hook=pairs, parse_constant=non_finite)
        except json.JSONDecodeError as error:
            raise ValueError("ACQUISITION_JSON_INVALID") from error
        counters = _Counters()
        fragments: list[ExtractedFragment] = []

        def walk(value: object, pointer: str, depth: int) -> None:
            counters.node(depth, self.limits)
            if isinstance(value, dict):
                for key in sorted(value):
                    walk(value[key], f"{pointer}/{_json_pointer_token(key)}", depth + 1)
            elif isinstance(value, list):
                for index, item in enumerate(value):
                    walk(item, f"{pointer}/{index}", depth + 1)
            elif value is not None:
                if isinstance(value, float) and not math.isfinite(value):
                    raise ValueError("ACQUISITION_JSON_NON_FINITE")
                rendered = _normalize_text(json.dumps(value, ensure_ascii=False, sort_keys=True))
                if rendered:
                    counters.text(rendered, self.limits)
                    fragments.append(
                        ExtractedFragment(
                            SourceLocatorKind.JSON_POINTER,
                            pointer or "/",
                            rendered,
                            len(fragments),
                        )
                    )

        walk(root, "", 0)
        if not fragments:
            raise ValueError("ACQUISITION_JSON_EMPTY")
        return fragments

    def _xml(self, text: str) -> list[ExtractedFragment]:
        if _XML_FORBIDDEN.search(text):
            raise ValueError("ACQUISITION_XML_DTD_OR_ENTITY_FORBIDDEN")
        try:
            root = ET.fromstring(text)  # noqa: S314 - DTD/entities are rejected above.
        except ET.ParseError as error:
            raise ValueError("ACQUISITION_XML_INVALID") from error
        counters = _Counters()
        fragments: list[ExtractedFragment] = []

        def walk(element: ET.Element, current_path: str, depth: int) -> None:
            counters.node(depth, self.limits)
            counters.attributes += len(element.attrib)
            if counters.attributes > self.limits.maximum_attributes:
                raise ValueError("ACQUISITION_ATTRIBUTE_LIMIT_EXCEEDED")
            text_value = _normalize_text(element.text or "")
            if text_value:
                counters.text(text_value, self.limits)
                fragments.append(
                    ExtractedFragment(
                        SourceLocatorKind.XML_XPATH,
                        current_path,
                        text_value,
                        len(fragments),
                    )
                )
            counts: dict[str, int] = {}
            for child in list(element):
                child_name = _xml_local_name(child.tag)
                counts[child_name] = counts.get(child_name, 0) + 1
                child_path = f"{current_path}/{child_name}[{counts[child_name]}]"
                walk(child, child_path, depth + 1)
                tail = _normalize_text(child.tail or "")
                if tail:
                    counters.text(tail, self.limits)
                    fragments.append(
                        ExtractedFragment(
                            SourceLocatorKind.XML_XPATH,
                            f"{child_path}/tail()",
                            tail,
                            len(fragments),
                        )
                    )

        root_path = f"/{_xml_local_name(root.tag)}"
        walk(root, root_path, 0)
        if not fragments:
            raise ValueError("ACQUISITION_XML_EMPTY")
        return fragments


@dataclass(slots=True)
class _Counters:
    nodes: int = 0
    attributes: int = 0
    text_bytes: int = 0

    def node(self, depth: int, limits: ExtractionLimits) -> None:
        if depth > limits.maximum_depth:
            raise ValueError("ACQUISITION_DEPTH_LIMIT_EXCEEDED")
        self.nodes += 1
        if self.nodes > limits.maximum_nodes:
            raise ValueError("ACQUISITION_NODE_LIMIT_EXCEEDED")

    def text(self, value: str, limits: ExtractionLimits) -> None:
        self.text_bytes += len(value.encode("utf-8"))
        if self.text_bytes > limits.maximum_text_bytes:
            raise ValueError("ACQUISITION_TEXT_LIMIT_EXCEEDED")


class _SafeHTMLCollector(HTMLParser):
    def __init__(self, limits: ExtractionLimits) -> None:
        super().__init__(convert_charrefs=True)
        self.limits = limits
        self.depth = 0
        self.nodes = 0
        self.attributes = 0
        self.text_bytes = 0
        self.fragments: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        normalized_tag = tag.casefold()
        if normalized_tag in _ACTIVE_HTML_TAGS:
            raise ValueError("ACQUISITION_HTML_ACTIVE_CONTENT")
        self.depth += 1
        self.nodes += 1
        self.attributes += len(attrs)
        if self.depth > self.limits.maximum_depth:
            raise ValueError("ACQUISITION_DEPTH_LIMIT_EXCEEDED")
        if self.nodes > self.limits.maximum_nodes:
            raise ValueError("ACQUISITION_NODE_LIMIT_EXCEEDED")
        if self.attributes > self.limits.maximum_attributes:
            raise ValueError("ACQUISITION_ATTRIBUTE_LIMIT_EXCEEDED")
        for raw_name, raw_value in attrs:
            name = raw_name.casefold()
            value = (raw_value or "").strip().casefold()
            if name.startswith("on"):
                raise ValueError("ACQUISITION_HTML_EVENT_HANDLER")
            if name in {"href", "src", "action", "formaction", "xlink:href"} and value.startswith(
                _UNSAFE_SCHEMES
            ):
                raise ValueError("ACQUISITION_HTML_UNSAFE_SCHEME")
            _content_safety(raw_value or "")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag: str) -> None:
        del tag
        self.depth = max(0, self.depth - 1)

    def handle_data(self, data: str) -> None:
        value = _normalize_text(data)
        if not value:
            return
        _content_safety(value)
        self.text_bytes += len(value.encode("utf-8"))
        if self.text_bytes > self.limits.maximum_text_bytes:
            raise ValueError("ACQUISITION_TEXT_LIMIT_EXCEEDED")
        self.fragments.append(value)
        if len(self.fragments) > self.limits.maximum_fragments:
            raise ValueError("ACQUISITION_FRAGMENT_LIMIT_EXCEEDED")


def canonical_header_digest(headers: dict[str, str]) -> str:
    normalized: list[str] = []
    for raw_name, raw_value in headers.items():
        name = raw_name.strip().casefold()
        value = " ".join(raw_value.split())
        if not name or "\r" in raw_value or "\n" in raw_value:
            raise ValueError("ACQUISITION_RESPONSE_HEADER_INVALID")
        normalized.append(f"{name}:{value}")
    payload = "\n".join(sorted(normalized)).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def raw_body_digests(*, wire_body: bytes, decoded_body: bytes) -> tuple[str, str]:
    return hashlib.sha256(wire_body).hexdigest(), hashlib.sha256(decoded_body).hexdigest()


def _decoded_safe_path(raw_path: str) -> str:
    try:
        decoded = unquote(raw_path, encoding="utf-8", errors="strict")
    except UnicodeDecodeError as error:
        raise ValueError("ACQUISITION_PATH_INVALID") from error
    if "\\" in decoded or "\x00" in decoded:
        raise ValueError("ACQUISITION_PATH_INVALID")
    segments = decoded.split("/")
    if any(segment in {".", ".."} for segment in segments):
        raise ValueError("ACQUISITION_PATH_TRAVERSAL")
    return decoded or "/"


def _segment_bounded_prefix(path: str, prefix: str) -> bool:
    if prefix == "/":
        return True
    return path == prefix or path.startswith(f"{prefix}/")


def _aware(value: datetime, field_name: str) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} must be timezone-aware")
    return value.astimezone(UTC)


def _normalize_text(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", html.unescape(value)).split())


def _content_safety(value: str) -> None:
    normalized = unicodedata.normalize("NFKC", value).casefold()
    if any(character in value for character in _BIDI_CONTROLS):
        raise ValueError("ACQUISITION_BIDI_CONTROL_DETECTED")
    if any(marker in normalized for marker in _PROMPT_MARKERS):
        raise ValueError("ACQUISITION_PROMPT_INJECTION_DETECTED")
    if any(pattern.search(value) for pattern in _SECRET_PATTERNS):
        raise ValueError("ACQUISITION_CREDENTIAL_INDICATOR_DETECTED")
    if any(pattern.search(value) for pattern in _PII_PATTERNS):
        raise ValueError("ACQUISITION_PII_INDICATOR_DETECTED")


def _reject_binary_or_mime_mismatch(media_type: str, body: bytes) -> None:
    stripped = body.lstrip()
    if b"\x00" in body or any(stripped.startswith(prefix) for prefix in _BINARY_PREFIXES):
        raise ValueError("ACQUISITION_POLYGLOT_OR_BINARY_MISMATCH")
    if media_type == "application/json" and not stripped.startswith((b"{", b"[")):
        raise ValueError("ACQUISITION_MIME_MISMATCH")
    if media_type in {"application/xml", "text/xml"} and not stripped.startswith(b"<"):
        raise ValueError("ACQUISITION_MIME_MISMATCH")
    if media_type == "text/html" and stripped.startswith((b"{", b"[", b"<?xml")):
        raise ValueError("ACQUISITION_MIME_MISMATCH")


def _json_pointer_token(value: str) -> str:
    return value.replace("~", "~0").replace("/", "~1")


def _xml_local_name(value: str) -> str:
    return value.rsplit("}", 1)[-1]
