from __future__ import annotations

import json
from pathlib import Path


def test_certificate_verification_is_the_only_registered_permanent_transport_code() -> None:
    path = (
        Path(__file__).resolve().parents[1]
        / "knowledge-sources"
        / "AP-14D-DIAGNOSTIC-CODES.v1.json"
    )
    payload = json.loads(path.read_text(encoding="utf-8"))
    permanent = {
        entry["code"]
        for entry in payload["codes"]
        if entry["retryable"] is False
    }

    assert permanent == {"source_tls_certificate_verification_failed"}
