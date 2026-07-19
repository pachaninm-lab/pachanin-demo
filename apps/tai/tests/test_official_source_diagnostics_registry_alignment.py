from __future__ import annotations

import json
from pathlib import Path

from tai import official_source_diagnostics


def test_diagnostic_registry_contains_every_implementation_code() -> None:
    path = (
        Path(__file__).resolve().parents[1]
        / "knowledge-sources"
        / "AP-14D-DIAGNOSTIC-CODES.v1.json"
    )
    payload = json.loads(path.read_text(encoding="utf-8"))
    registered = {entry["code"] for entry in payload["codes"]}
    implemented = set(official_source_diagnostics._OS_ERROR_CODES.values()) | {
        "source_dns_resolution_empty",
        "source_dns_resolution_failed",
        "source_dns_transport_failure",
        "source_http_bad_status_line",
        "source_http_incomplete_read",
        "source_http_protocol_failure",
        "source_http_remote_disconnected",
        "source_tls_certificate_verification_failed",
        "source_tls_handshake_failed",
        "source_transport_timeout",
        "source_transport_unknown",
    }

    assert implemented <= registered
