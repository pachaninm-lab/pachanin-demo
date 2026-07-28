"""The Gateway acceptance evidence must be re-derivable, and must catch regressions.

A verifier that only ever passes proves nothing: it would keep reporting success
after the property it claims to check had been deleted. Every check here is
exercised twice — once against the real tree, and once against a tree where the
property was removed — so a green run means the check can still fail.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from tai.gateway_acceptance import (
    GATEWAY_ACCEPTANCE_SCHEMA,
    GATEWAY_EVENT_NAMES,
    GATEWAY_SOURCES,
    verify_gateway_acceptance,
)
from tai.gateway_acceptance_cli import main as cli_main

REPO_ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = REPO_ROOT / "apps/tai/governance/gateway-exact-main-acceptance.v1.json"
EXACT_MAIN = json.loads(EVIDENCE.read_text(encoding="utf-8"))["exact_main_sha"]


def _report():
    return verify_gateway_acceptance(REPO_ROOT, EXACT_MAIN)


def test_the_working_tree_satisfies_every_gateway_acceptance_check() -> None:
    report = _report()

    assert report.passed, [check.check_id for check in report.failures]
    assert report.accepted_items() == ("H.01", "H.02", "H.03", "H.04", "H.05")


def test_the_stored_evidence_describes_the_tree_it_claims_to_describe() -> None:
    stored = json.loads(EVIDENCE.read_text(encoding="utf-8"))

    assert stored["schema"] == GATEWAY_ACCEPTANCE_SCHEMA
    assert stored == _report().to_json_object()


def test_the_read_only_event_set_is_exactly_six_events() -> None:
    # H.02 used to name prepared_action and decision as protocol events. The
    # read-only contract has neither, and an event it cannot describe cannot be
    # emitted, so the acceptance item had to be corrected rather than accepted.
    assert GATEWAY_EVENT_NAMES == ("meta", "token", "citation", "assessment", "done", "error")
    assert "prepared_action" not in GATEWAY_EVENT_NAMES
    assert "decision" not in GATEWAY_EVENT_NAMES


def test_an_exact_main_sha_is_required_and_must_be_a_full_commit() -> None:
    with pytest.raises(ValueError, match="40-character"):
        verify_gateway_acceptance(REPO_ROOT, "d790643")


def test_a_missing_gateway_source_is_an_error_rather_than_a_silent_pass() -> None:
    with pytest.raises(FileNotFoundError, match="gateway source is missing"):
        verify_gateway_acceptance(REPO_ROOT / "apps", EXACT_MAIN)


@pytest.fixture
def tree(tmp_path: Path) -> Path:
    """A copy of just the gateway sources, so a regression can be simulated."""
    root = tmp_path / "tree"
    for relative in GATEWAY_SOURCES:
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(REPO_ROOT / relative, target)
    return root


def _fails_with(root: Path, check_id: str) -> bool:
    report = verify_gateway_acceptance(root, EXACT_MAIN)
    return check_id in {check.check_id for check in report.failures}


def _rewrite(root: Path, relative: str, old: str, new: str) -> None:
    path = root / relative
    source = path.read_text(encoding="utf-8")
    assert old in source, f"regression fixture is stale: {old!r} not in {relative}"
    path.write_text(source.replace(old, new, 1), encoding="utf-8")


CONTRACT = "apps/api/src/modules/ai-insights/ai-assistant-stream.contract.ts"
CONTROLLER = "apps/api/src/modules/ai-insights/ai-assistant.controller.ts"
PUBLIC_ROUTE = "apps/web/app/api/public-platform-assistant/route.ts"
PROXY = "apps/web/app/api/proxy/[...path]/route.ts"
CLIENT = "apps/web/lib/platform-v7/ai-gateway-stream.ts"
ADMISSION = "apps/api/src/modules/ai-insights/ai-assistant-admission.manifest.ts"


def test_the_baseline_copy_still_passes(tree: Path) -> None:
    assert verify_gateway_acceptance(tree, EXACT_MAIN).passed


def test_it_catches_a_consumer_that_stops_importing_the_shared_contract(tree: Path) -> None:
    _rewrite(tree, PUBLIC_ROUTE, "@pc/ai-assistant-stream-contract", "./local-copy-of-the-contract")

    assert _fails_with(tree, "H01.single-contract-module")


def test_it_catches_a_browser_that_imports_the_validator_but_never_calls_it(tree: Path) -> None:
    # Importing `validateFrame` and not calling it would read as validation
    # while validating nothing, so the check looks for the call site.
    _rewrite(tree, CLIENT, "validateFrame(parsed, options.mode)", "{ ok: true, frame: parsed }")

    assert _fails_with(tree, "H01.runtime-validation-both-ends")


def test_it_catches_a_write_verb_being_dropped_from_the_refusal_list(tree: Path) -> None:
    _rewrite(tree, CONTRACT, "  'prepared_action',\n", "")

    assert _fails_with(tree, "H02.write-verbs-refused")


def test_it_catches_a_refusal_that_stops_recursing_into_nested_objects(tree: Path) -> None:
    # A nested prepared_action is the same capability as a top-level one.
    _rewrite(tree, CONTRACT, "findForbiddenKey(nested, depth + 1)", "null")

    assert _fails_with(tree, "H02.write-verbs-refused-at-any-depth")


def test_it_catches_prepared_action_reappearing_outside_the_refusal(tree: Path) -> None:
    _rewrite(
        tree,
        CONTROLLER,
        "stream.complete();",
        "stream.emit({ prepared_action: 'CONFIRM' });",
    )

    assert _fails_with(tree, "H02.no-prepared-action-outside-the-refusal")


def test_it_catches_an_event_being_added_to_the_protocol(tree: Path) -> None:
    _rewrite(tree, CONTRACT, "'done', 'error'] as const", "'done', 'error', 'confirm'] as const")

    assert _fails_with(tree, "H02.event-set-is-closed")


def test_it_catches_truncated_text_becoming_showable(tree: Path) -> None:
    _rewrite(
        tree,
        CONTRACT,
        "sawDone && complete && refusal === null && text.length > 0",
        "text.length > 0",
    )

    assert _fails_with(tree, "H03.outcome-requires-completion")


def test_it_catches_a_rejected_frame_being_skipped_instead_of_sealing(tree: Path) -> None:
    _rewrite(
        tree,
        CONTRACT,
        "sealWithRefusal('UPSTREAM_ERROR'",
        "ignoreAndContinue('UPSTREAM_ERROR'",
    )

    assert _fails_with(tree, "H03.rejected-frame-seals-the-stream")


def test_it_catches_an_identity_key_being_dropped_from_the_refusal_list(tree: Path) -> None:
    _rewrite(tree, CONTRACT, "'tenantId', 'roleId'", "'roleId'")

    assert _fails_with(tree, "H04.identity-keys-refused-in-frames")


def test_it_catches_the_public_boundary_reaching_account_data(tree: Path) -> None:
    _rewrite(
        tree,
        PUBLIC_ROUTE,
        "import { createHash",
        "import { ACCESS_COOKIE } from '@/lib/auth-cookies';\nimport { createHash",
    )

    assert _fails_with(tree, "H04.public-route-reaches-no-account-data")


def test_it_catches_the_proxy_buffering_the_stream_again(tree: Path) -> None:
    _rewrite(
        tree,
        PROXY,
        "new NextResponse(response.body",
        "new NextResponse(await response.text()",
    )

    assert _fails_with(tree, "H05.proxy-does-not-buffer-the-stream")


def test_it_catches_cancellation_being_replaced_by_a_fixed_deadline(tree: Path) -> None:
    _rewrite(
        tree,
        PROXY,
        "streamPath ? request.signal : AbortSignal.timeout(8_000)",
        "AbortSignal.timeout(8_000)",
    )

    assert _fails_with(tree, "H05.proxy-forwards-cancellation")


def test_it_catches_the_stream_gaining_a_demo_form(tree: Path) -> None:
    _rewrite(tree, PROXY, "!streamPath && (!API_URL || demoToken)", "!API_URL || demoToken")

    assert _fails_with(tree, "H05.stream-has-no-demo-form")


def test_it_catches_a_feature_flag_that_stops_being_an_exact_opt_in(tree: Path) -> None:
    _rewrite(
        tree,
        CONTROLLER,
        "(env.TAI_GATEWAY_STREAM_ENABLED || '').trim() === 'true'",
        "env.TAI_GATEWAY_STREAM_ENABLED !== 'false'",
    )

    assert _fails_with(tree, "ADM.flags-default-to-off")


def test_it_catches_a_mock_answer_appearing_on_a_streaming_path(tree: Path) -> None:
    _rewrite(
        tree,
        CONTROLLER,
        "const streamId = randomUUID();",
        "const mockAnswer = () => 'ok';\n    const streamId = randomUUID();",
    )

    assert _fails_with(tree, "ADM.no-mock-or-static-fallback")


def test_it_catches_generation_running_before_the_admission_gate(tree: Path) -> None:
    path = tree / CONTROLLER
    source = path.read_text(encoding="utf-8")
    gate = "    if (!admission.allowed) {"
    call = "      answer = await this.assistant.chat(request, user);"
    assert gate in source and call in source
    # Move the generation call above the gate: the refusal would then hide an
    # answer that had already been produced, rather than prevent one.
    path.write_text(source.replace(call, "").replace(gate, f"{call}\n{gate}", 1), encoding="utf-8")

    assert _fails_with(tree, "ADM.generation-service-not-called")


def test_it_catches_admission_going_back_to_an_environment_word(tree: Path) -> None:
    # The switch this change exists to remove: a deployment that can type
    # ADMITTED can claim benchmarks and a licence review that never happened.
    _rewrite(
        tree,
        CONTROLLER,
        "const verdict = readAdmissionManifest(env);",
        "const verdict = { modelIdentity: env.TAI_GATEWAY_MODEL_ADMISSION ?? null,"
        " admitted: true };",
    )

    assert _fails_with(tree, "ADM.admission-comes-from-a-verified-decision")


def test_it_catches_the_public_contour_keeping_its_own_admission_variable(tree: Path) -> None:
    _rewrite(
        tree,
        PUBLIC_ROUTE,
        "const verdict = readAdmissionManifest(env, PUBLIC_ADMISSION_SOURCE);",
        "const verdict = { modelIdentity: env.TAI_GATEWAY_PUBLIC_MODEL_ADMISSION ?? null,"
        " admitted: true };",
    )

    assert _fails_with(tree, "ADM.admission-comes-from-a-verified-decision")


def test_it_catches_a_digest_that_is_read_instead_of_recomputed(tree: Path) -> None:
    # Trusting the field would accept a decision whose status was edited to
    # ADMITTED after the authority signed it.
    _rewrite(tree, ADMISSION, "if (recomputed !== declared) return REFUSED('DIGEST_MISMATCH');", "")

    assert _fails_with(tree, "ADM.decision-digest-is-recomputed")


def test_it_catches_a_decision_for_another_model_being_accepted(tree: Path) -> None:
    _rewrite(
        tree,
        ADMISSION,
        "if (expectedModelIdentity !== null && expectedModelIdentity !== modelId) {",
        "if (false) {",
    )

    assert _fails_with(tree, "ADM.decision-must-name-this-model")


def test_the_cli_reports_a_clean_derivation(capsys: pytest.CaptureFixture[str]) -> None:
    exit_code = cli_main(
        [
            "verify",
            "--root",
            str(REPO_ROOT),
            "--exact-main-sha",
            EXACT_MAIN,
            "--evidence",
            str(EVIDENCE),
        ]
    )

    assert exit_code == 0
    assert "29 checks, all passed" in capsys.readouterr().out


def test_the_cli_refuses_evidence_that_does_not_match_the_tree(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    stale = tmp_path / "stale.json"
    stale.write_text('{"schema": "tai.gateway-exact-main-acceptance.v1"}\n', encoding="utf-8")

    exit_code = cli_main(
        [
            "verify",
            "--root",
            str(REPO_ROOT),
            "--exact-main-sha",
            EXACT_MAIN,
            "--evidence",
            str(stale),
        ]
    )

    assert exit_code == 1
    assert "does not match the tree" in capsys.readouterr().err
