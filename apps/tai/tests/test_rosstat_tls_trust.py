from __future__ import annotations

import hashlib
import importlib.resources
import ssl
import tomllib
from dataclasses import replace
from pathlib import Path

import pytest

from tai.official_source_diagnostics import (
    _rosstat_tls_context,
    _verified_ca_context,
    diagnostic_live_definitions,
)
from tai.official_source_fetcher import StdlibPinnedHTTPSFetchTransport
from tai.source_coverage import OfficialSourceCatalog, load_official_source_catalog

EXPECTED_FINGERPRINTS = frozenset(
    {
        "d26d2d0231b7c39f92cc738512ba54103519e4405d68b5bd703e9788ca8ecf31",
        "2155785036c900dbb5f1bb2a1569c80c55595bd6bf94867a29bbddbc7d88a3f2",
    }
)


def _catalog() -> OfficialSourceCatalog:
    return load_official_source_catalog(
        Path(__file__).resolve().parents[1]
        / "knowledge-sources"
        / "official-sources.v1.json"
    )


def _fingerprints(context: ssl.SSLContext) -> frozenset[str]:
    return frozenset(
        hashlib.sha256(certificate).hexdigest()
        for certificate in context.get_ca_certs(binary_form=True)
    )


def test_rosstat_context_contains_only_audited_ca_chain_and_verifies_host() -> None:
    context = _rosstat_tls_context()

    assert context.verify_mode == ssl.CERT_REQUIRED
    assert context.check_hostname is True
    assert context.minimum_version == ssl.TLSVersion.TLSv1_2
    assert _fingerprints(context) == EXPECTED_FINGERPRINTS


def test_trust_bundle_fails_closed_on_invalid_or_unexpected_certificate() -> None:
    with pytest.raises(ValueError, match="invalid certificate"):
        _verified_ca_context(
            certificate_pems=("not a certificate",),
            expected_fingerprints=frozenset({"a" * 64}),
        )

    root_pem = (
        importlib.resources.files("tai")
        .joinpath("trust", "russian_trusted_root_ca.pem")
        .read_text(encoding="ascii")
    )
    with pytest.raises(ValueError, match="fingerprint mismatch"):
        _verified_ca_context(
            certificate_pems=(root_pem,),
            expected_fingerprints=frozenset({"a" * 64}),
        )


def test_custom_trust_is_scoped_to_exact_rosstat_source_and_host() -> None:
    catalog = _catalog()
    definitions = diagnostic_live_definitions(catalog=catalog, timeout_seconds=20)
    by_source = {definition.source.source_id: definition for definition in definitions}

    rosstat_fetcher = by_source["official.rosstat.agriculture"].fetcher
    assert isinstance(rosstat_fetcher.transport, StdlibPinnedHTTPSFetchTransport)
    assert _fingerprints(rosstat_fetcher.transport._context) == EXPECTED_FINGERPRINTS
    for source_id, definition in by_source.items():
        if source_id == "official.rosstat.agriculture":
            continue
        assert isinstance(definition.fetcher.transport, StdlibPinnedHTTPSFetchTransport)
        assert _fingerprints(definition.fetcher.transport._context) != EXPECTED_FINGERPRINTS

    sources = tuple(
        replace(
            source,
            entrypoint_uri="https://evil.example/agriculture",
            allowed_hosts=frozenset({"evil.example"}),
        )
        if source.source_id == "official.rosstat.agriculture"
        else source
        for source in catalog.sources
    )
    unsafe_catalog = OfficialSourceCatalog(
        sources=sources,
        requirements=catalog.requirements,
    )
    with pytest.raises(ValueError, match="exact governed host"):
        diagnostic_live_definitions(catalog=unsafe_catalog, timeout_seconds=20)


def test_audited_pems_are_declared_as_wheel_package_data() -> None:
    package_root = importlib.resources.files("tai")
    for resource_name in (
        "russian_trusted_root_ca.pem",
        "russian_trusted_sub_ca_2024.pem",
    ):
        assert package_root.joinpath("trust", resource_name).is_file()

    pyproject = tomllib.loads(
        (Path(__file__).resolve().parents[1] / "pyproject.toml").read_text(
            encoding="utf-8"
        )
    )
    assert pyproject["tool"]["setuptools"]["package-data"]["tai"] == [
        "trust/*.pem"
    ]


def test_autopilot_guard_allows_only_exact_audited_public_ca_files() -> None:
    guard = (
        Path(__file__).resolve().parents[3] / "scripts" / "p7-autopilot-guard.sh"
    ).read_text(encoding="utf-8")

    assert 'GITHUB_HEAD_REF:-}" = "agent/tai-ap-14d7-live-remediation"' in guard
    assert "apps/tai/tai/trust/russian_trusted_root_ca\\.pem" in guard
    assert "apps/tai/tai/trust/russian_trusted_sub_ca_2024\\.pem" in guard
    for fingerprint in EXPECTED_FINGERPRINTS:
        assert fingerprint in guard
    assert "openssl x509" in guard
    assert "Audited public CA fingerprint mismatch" in guard
