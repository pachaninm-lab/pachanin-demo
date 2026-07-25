from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pytest

from tai.contracts import ToolMode
from tai.platform_tools import _PLATFORM_TOOL_MODES
from tai.read_tool_contracts import (
    FORBIDDEN_ARGUMENTS,
    PLATFORM_TOOL_NAMES,
    PLATFORM_TOOL_SPECS,
    ReadToolArgumentError,
    normalize_platform_tool_arguments,
    platform_tool_spec,
    read_tool_names,
)
from tai.tool_planner import _validate_arguments

SERVER_REGISTRY = (
    Path(__file__).resolve().parents[3]
    / "apps/api/src/modules/tai-tools/tai-tool-assertion.ts"
)

DEAL = "deal-1"


def _server_tool_modes() -> dict[str, str]:
    """Parse TAI_PLATFORM_TOOL_MODES out of the authoritative server registry."""
    source = SERVER_REGISTRY.read_text(encoding="utf-8")
    block = re.search(
        r"TAI_PLATFORM_TOOL_MODES\s*=\s*\{(.*?)\}\s*as const", source, re.DOTALL
    )
    assert block is not None, "server tool registry could not be located"
    return {
        name: mode
        for name, mode in re.findall(r"(\w+):\s*'([A-Z_]+)'", block.group(1))
    }


class TestRegistryMatchesTheServer:
    def test_tai_never_advertises_a_tool_the_platform_cannot_serve(self) -> None:
        """A tool signed here but absent there would 401 — a capability that only looks real."""
        assert set(PLATFORM_TOOL_NAMES) <= set(_server_tool_modes())

    def test_declared_modes_match_the_server(self) -> None:
        server = _server_tool_modes()
        for spec in PLATFORM_TOOL_SPECS:
            assert server[spec.tool_name] == spec.mode.value, spec.tool_name

    def test_adapter_registry_is_derived_from_the_specs(self) -> None:
        derived = {spec.tool_name: spec.mode for spec in PLATFORM_TOOL_SPECS}
        assert derived == _PLATFORM_TOOL_MODES

    def test_adapter_exposes_no_write_mode(self) -> None:
        assert set(_PLATFORM_TOOL_MODES.values()) <= {ToolMode.READ_ONLY, ToolMode.DRAFT}

    def test_read_tool_subset_excludes_drafts(self) -> None:
        assert read_tool_names() == (
            "getDealSummary",
            "getRoleNextActions",
            "getDealRisks",
            "getDocumentStatus",
            "getLogisticsStatus",
            "getLaboratoryStatus",
            "getMoneyReadiness",
            "getDisputeStatus",
            "getEvidenceTimeline",
        )

    def test_integration_status_stays_unregistered_until_it_has_a_read_path(self) -> None:
        """The catalogue asks for ten; nine are served.

        getIntegrationStatus needs outbox delivery state, which is not part of the
        deal workspace projection the other nine read. Registering it before the
        platform can answer it would sign requests that come back 401 — a capability
        that only looks real.
        """
        assert "getIntegrationStatus" not in PLATFORM_TOOL_NAMES
        assert "getIntegrationStatus" not in _server_tool_modes()
        assert len(read_tool_names()) == 9

    def test_registry_names_are_unique(self) -> None:
        assert len(set(PLATFORM_TOOL_NAMES)) == len(PLATFORM_TOOL_NAMES)

    def test_every_tool_requires_a_deal(self) -> None:
        for spec in PLATFORM_TOOL_SPECS:
            required = [argument.name for argument in spec.arguments if argument.required]
            assert required == ["dealId"], spec.tool_name

    def test_no_tool_declares_a_server_derived_argument(self) -> None:
        for spec in PLATFORM_TOOL_SPECS:
            for argument in spec.arguments:
                assert argument.name not in FORBIDDEN_ARGUMENTS, spec.tool_name

    def test_role_is_never_a_declared_argument(self) -> None:
        """getRoleNextActions must take its role from the session, not the caller."""
        spec = platform_tool_spec("getRoleNextActions")
        assert [argument.name for argument in spec.arguments] == ["dealId"]

    def test_unknown_tool_fails_closed(self) -> None:
        with pytest.raises(ReadToolArgumentError, match="not a registered platform tool"):
            platform_tool_spec("getEverything")


class TestForbiddenArguments:
    @pytest.mark.parametrize(
        "name",
        ["tenantId", "tenant_id", "role", "roles", "userId", "organizationId", "impersonate"],
    )
    def test_identity_arguments_are_refused(self, name: str) -> None:
        with pytest.raises(ReadToolArgumentError, match="server-derived"):
            normalize_platform_tool_arguments("getDealSummary", {"dealId": DEAL, name: "x"})

    @pytest.mark.parametrize("name", ["expectedVersion", "expected_version"])
    def test_concurrency_tokens_are_refused(self, name: str) -> None:
        with pytest.raises(ReadToolArgumentError, match="server-derived"):
            normalize_platform_tool_arguments("getDealSummary", {"dealId": DEAL, name: "3"})

    @pytest.mark.parametrize("tool_name", PLATFORM_TOOL_NAMES)
    def test_tenant_selection_is_refused_for_every_tool(self, tool_name: str) -> None:
        with pytest.raises(ReadToolArgumentError, match="server-derived"):
            normalize_platform_tool_arguments(
                tool_name, {"dealId": DEAL, "tenantId": "tenant-9"}
            )


class TestUnknownAndMissingArguments:
    def test_undeclared_argument_is_refused(self) -> None:
        with pytest.raises(ReadToolArgumentError, match="not a declared argument"):
            normalize_platform_tool_arguments("getDealSummary", {"dealId": DEAL, "extra": "1"})

    def test_missing_required_argument_is_refused(self) -> None:
        with pytest.raises(ReadToolArgumentError, match="dealId is required"):
            normalize_platform_tool_arguments("getDealSummary", {})

    def test_optional_argument_may_be_omitted(self) -> None:
        assert normalize_platform_tool_arguments("prepareCommandDraft", {"dealId": DEAL}) == {
            "dealId": DEAL
        }

    def test_optional_argument_is_kept_when_supplied(self) -> None:
        assert normalize_platform_tool_arguments(
            "prepareCommandDraft", {"dealId": DEAL, "actionId": "action-7"}
        ) == {"dealId": DEAL, "actionId": "action-7"}

    def test_non_string_argument_name_is_refused(self) -> None:
        arguments: dict[Any, Any] = {"dealId": DEAL, 7: "x"}
        with pytest.raises(ReadToolArgumentError, match="argument names must be strings"):
            normalize_platform_tool_arguments("getDealSummary", arguments)

    @pytest.mark.parametrize("tool_name", PLATFORM_TOOL_NAMES)
    def test_free_form_payload_is_refused_for_every_tool(self, tool_name: str) -> None:
        with pytest.raises(ReadToolArgumentError):
            normalize_platform_tool_arguments(
                tool_name, {"dealId": DEAL, "sql": "SELECT 1"}
            )


class TestPlannerAndAdapterShareOneContract:
    """The planner used to keep its own copy of the allowlist; the two must not drift."""

    def test_planner_accepts_exactly_what_the_adapter_accepts(self) -> None:
        for tool_name in PLATFORM_TOOL_NAMES:
            _validate_arguments(tool_name, {"dealId": DEAL})

    def test_planner_refuses_what_the_adapter_refuses(self) -> None:
        with pytest.raises(ValueError, match="invalid argument schema"):
            _validate_arguments("getDealSummary", {"dealId": DEAL, "tenantId": "t-1"})

    def test_planner_still_requires_a_deal(self) -> None:
        with pytest.raises(ValueError, match="invalid argument schema"):
            _validate_arguments("getDealSummary", {})

    def test_planner_still_refuses_non_portable_values(self) -> None:
        with pytest.raises(ValueError, match="invalid argument schema"):
            _validate_arguments("getDealSummary", {"dealId": "deal 1"})

    def test_command_draft_payload_stays_undeclared(self) -> None:
        """The platform accepts a payload here; TAI deliberately does not offer one.

        Declaring it would put an arbitrary object back on the path to a prepared
        write, and the deterministic planner has never produced one.
        """
        with pytest.raises(ReadToolArgumentError, match="payload is not a declared argument"):
            normalize_platform_tool_arguments(
                "prepareCommandDraft", {"dealId": DEAL, "payload": {"documentId": "doc-1"}}
            )


class TestIdentifierNormalization:
    def test_surrounding_whitespace_is_tolerated(self) -> None:
        assert normalize_platform_tool_arguments(
            "getDealSummary", {"dealId": f"  {DEAL} "}
        ) == {"dealId": DEAL}

    def test_equivalent_identifiers_produce_one_canonical_body(self) -> None:
        """Signed bodies must not differ just because of incidental whitespace."""
        assert normalize_platform_tool_arguments(
            "getDealSummary", {"dealId": DEAL}
        ) == normalize_platform_tool_arguments("getDealSummary", {"dealId": f"{DEAL}  "})

    @pytest.mark.parametrize(
        "value",
        [
            "",
            "   ",
            "1 OR 1=1",
            "../../etc/passwd",
            "deal 1",
            "deal/1",
            "deal\n1",
            "деал-1",
            "x" * 161,
        ],
    )
    def test_non_portable_identifier_is_refused(self, value: str) -> None:
        with pytest.raises(ReadToolArgumentError, match="portable identifier"):
            normalize_platform_tool_arguments("getDealSummary", {"dealId": value})

    @pytest.mark.parametrize("value", [7, None, True, ["a"], {"a": 1}, 1.5])
    def test_non_string_identifier_is_refused(self, value: Any) -> None:
        with pytest.raises(ReadToolArgumentError, match="portable identifier"):
            normalize_platform_tool_arguments("getDealSummary", {"dealId": value})

    def test_maximum_length_identifier_is_accepted(self) -> None:
        value = "d" * 160
        assert normalize_platform_tool_arguments("getDealSummary", {"dealId": value}) == {
            "dealId": value
        }
