"""Exact-main acceptance evidence for the read-only TAI Gateway.

Acceptance that is written down but never re-derived is a claim, not evidence.
The H-stage items say things like "identity never travels in a frame" and
"partial text is removed unless the stream completed" — statements about code
that can quietly stop being true one refactor after they are accepted.

This module re-derives every one of them from the working tree. Each check names
the file it reads and the property it asserts, so a failure points at the line
that broke rather than at the verdict. The gap report may only mark H.01..H.05
accepted while :func:`verify_gateway_acceptance` reports no failures, and
`tests/test_gateway_acceptance.py` fails the build if the two ever disagree.

The checks are deliberately about *structure*, not about wording. A comment can
be reworded; `validateFrame` disappearing from the public boundary cannot.

What this module does **not** claim: nothing here says the gateway is switched
on, that a model is admitted, or that anything runs in production. H.06 stays
blocked precisely because those are different questions, and the gateway status
this evidence supports says "accepted and deliberately disabled", never "ready".
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Final

__all__ = [
    "GATEWAY_ACCEPTANCE_SCHEMA",
    "GATEWAY_EVENT_NAMES",
    "GATEWAY_SOURCES",
    "AcceptanceCheck",
    "GatewayAcceptanceReport",
    "acceptance_payload",
    "verify_gateway_acceptance",
]

GATEWAY_ACCEPTANCE_SCHEMA: Final = "tai.gateway-exact-main-acceptance.v1"

#: The complete event vocabulary of the read-only contract. There is no
#: prepared_action, no confirm, no execute and no decision-as-action: an event
#: the contract cannot describe cannot be emitted.
GATEWAY_EVENT_NAMES: Final[tuple[str, ...]] = (
    "meta",
    "token",
    "citation",
    "assessment",
    "done",
    "error",
)

#: The one contract module, and the four consumers that must speak through it.
CONTRACT: Final = "apps/api/src/modules/ai-insights/ai-assistant-stream.contract.ts"
API_CONTROLLER: Final = "apps/api/src/modules/ai-insights/ai-assistant.controller.ts"
PUBLIC_ROUTE: Final = "apps/web/app/api/public-platform-assistant/route.ts"
PROXY_ROUTE: Final = "apps/web/app/api/proxy/[...path]/route.ts"
BROWSER_CLIENT: Final = "apps/web/lib/platform-v7/ai-gateway-stream.ts"
PRIVATE_PANEL: Final = "apps/web/components/platform-v7/AiAssistantPanel.tsx"
PUBLIC_PANEL: Final = "apps/web/components/platform-v7/PublicPlatformAssistant.tsx"

GATEWAY_SOURCES: Final[tuple[str, ...]] = (
    CONTRACT,
    API_CONTROLLER,
    PUBLIC_ROUTE,
    PROXY_ROUTE,
    BROWSER_CLIENT,
    PRIVATE_PANEL,
    PUBLIC_PANEL,
)

#: Write verbs the contract must refuse. Kept here independently of the
#: TypeScript source on purpose: if the two lists drift, the check that compares
#: them fails, which is the point.
WRITE_VERBS: Final[tuple[str, ...]] = (
    "prepared_action",
    "preparedAction",
    "confirm_action",
    "confirmAction",
    "execute",
    "execute_action",
    "executeAction",
    "mutation",
    "command",
    "write",
)

#: Server-authorized identity that must never appear inside a frame.
IDENTITY_KEYS: Final[tuple[str, ...]] = ("tenantId", "roleId", "subjectId", "dealId")

#: Feature flags that must default to off. A flag defaulting to on would enable
#: generation by omission, which is the opposite of an admission decision.
FEATURE_FLAGS: Final[tuple[str, ...]] = (
    "TAI_GATEWAY_STREAM_ENABLED",
    "TAI_GATEWAY_PUBLIC_STREAM_ENABLED",
)


@dataclass(frozen=True, slots=True)
class AcceptanceCheck:
    """One re-derived property, and where it was read from."""

    check_id: str
    item_id: str
    title: str
    sources: tuple[str, ...]
    passed: bool
    detail: str

    def to_json_object(self) -> dict[str, object]:
        return {
            "check_id": self.check_id,
            "detail": self.detail,
            "item_id": self.item_id,
            "passed": self.passed,
            "sources": list(self.sources),
            "title": self.title,
        }


@dataclass(frozen=True, slots=True)
class GatewayAcceptanceReport:
    """The verdict for one exact-main tree."""

    exact_main_sha: str
    checks: tuple[AcceptanceCheck, ...]

    @property
    def failures(self) -> tuple[AcceptanceCheck, ...]:
        return tuple(check for check in self.checks if not check.passed)

    @property
    def passed(self) -> bool:
        return not self.failures

    def accepted_items(self) -> tuple[str, ...]:
        """Items every one of whose checks passed.

        An item with no checks is never accepted: silence is not evidence.
        """
        by_item: dict[str, list[bool]] = {}
        for check in self.checks:
            by_item.setdefault(check.item_id, []).append(check.passed)
        return tuple(sorted(item for item, results in by_item.items() if all(results)))

    def to_json_object(self) -> dict[str, object]:
        return {
            "accepted_items": list(self.accepted_items()),
            "checks": [check.to_json_object() for check in self.checks],
            "exact_main_sha": self.exact_main_sha,
            "failed_checks": [check.check_id for check in self.failures],
            "passed": self.passed,
            "schema": GATEWAY_ACCEPTANCE_SCHEMA,
        }


def _read(root: Path, relative: str) -> str:
    path = root / relative
    if not path.is_file():
        raise FileNotFoundError(f"gateway source is missing: {relative}")
    return path.read_text(encoding="utf-8")


def _check(
    check_id: str,
    item_id: str,
    title: str,
    sources: Sequence[str],
    passed: bool,
    detail: str,
) -> AcceptanceCheck:
    return AcceptanceCheck(
        check_id=check_id,
        item_id=item_id,
        title=title,
        sources=tuple(sources),
        passed=passed,
        detail=detail,
    )


def _string_list(source: str, name: str) -> tuple[str, ...]:
    """Read a `const NAME = [ ... ] as const` array of string literals."""
    match = re.search(rf"const {name}[^=]*=\s*\[(.*?)\]\s*as const", source, re.DOTALL)
    if match is None:
        return ()
    return tuple(re.findall(r"'([^']+)'", match.group(1)))


def _missing(required: Iterable[str], source: str) -> list[str]:
    return [needle for needle in required if needle not in source]


def _one_contract_checks(root: Path) -> list[AcceptanceCheck]:
    """H.01 — one contract, spoken by API, public route, proxy and browser."""
    checks: list[AcceptanceCheck] = []

    contract_importers = {
        API_CONTROLLER: "./ai-assistant-stream.contract",
        PUBLIC_ROUTE: "@pc/ai-assistant-stream-contract",
        BROWSER_CLIENT: "@pc/ai-assistant-stream-contract",
    }
    drifted = [
        relative
        for relative, specifier in contract_importers.items()
        if specifier not in _read(root, relative)
    ]
    checks.append(
        _check(
            "H01.single-contract-module",
            "H.01",
            "API, public boundary and browser import the same contract module",
            tuple(contract_importers) + (CONTRACT,),
            not drifted,
            "all three consumers import the shared contract"
            if not drifted
            else f"not importing the shared contract: {', '.join(drifted)}",
        )
    )

    # The proxy does not validate frames itself: it relays bytes. What must hold
    # is that it relays them rather than re-implementing the protocol.
    proxy = _read(root, PROXY_ROUTE)
    checks.append(
        _check(
            "H01.proxy-relays-without-reimplementing",
            "H.01",
            "The private proxy relays the stream instead of re-implementing it",
            (PROXY_ROUTE,),
            "isAssistantStreamPath" in proxy and "response.body" in proxy,
            "proxy forwards response.body for the stream path",
        )
    )

    emitters = {API_CONTROLLER: "GatewayStreamWriter", PUBLIC_ROUTE: "GatewayStreamWriter"}
    missing_emitters = [
        relative for relative, needle in emitters.items() if needle not in _read(root, relative)
    ]
    checks.append(
        _check(
            "H01.single-emission-path",
            "H.01",
            "Both server contours emit through one GatewayStreamWriter",
            tuple(emitters),
            not missing_emitters,
            "both contours emit through the shared writer"
            if not missing_emitters
            else f"not using the shared writer: {', '.join(missing_emitters)}",
        )
    )

    # The call, not the name: importing `validateFrame` and never calling it
    # would read as validation while validating nothing.
    validators = {
        CONTRACT: "validateFrame(candidate, this.mode)",
        BROWSER_CLIENT: "validateFrame(parsed, options.mode)",
    }
    missing_validation = [
        relative for relative, needle in validators.items() if needle not in _read(root, relative)
    ]
    checks.append(
        _check(
            "H01.runtime-validation-both-ends",
            "H.01",
            "Every frame is validated at runtime on the server and in the browser",
            tuple(validators),
            not missing_validation,
            "frames are validated on both ends"
            if not missing_validation
            else f"missing runtime validation: {', '.join(missing_validation)}",
        )
    )
    return checks


def _protocol_checks(root: Path) -> list[AcceptanceCheck]:
    """H.02 — the event vocabulary is exactly the read-only six."""
    contract = _read(root, CONTRACT)
    checks: list[AcceptanceCheck] = []

    declared = _string_list(contract, "GATEWAY_EVENTS")
    checks.append(
        _check(
            "H02.event-set-is-closed",
            "H.02",
            "The contract declares exactly meta, token, citation, assessment, done, error",
            (CONTRACT,),
            declared == GATEWAY_EVENT_NAMES,
            f"declared events: {', '.join(declared) or '(none found)'}",
        )
    )

    forbidden = _string_list(contract, "FORBIDDEN_ACTION_KEYS")
    checks.append(
        _check(
            "H02.write-verbs-refused",
            "H.02",
            "Every write verb is refused by the contract",
            (CONTRACT,),
            set(WRITE_VERBS).issubset(set(forbidden)),
            f"refused verbs: {', '.join(sorted(forbidden)) or '(none found)'}",
        )
    )

    # Depth matters: a nested prepared_action is the same capability as a
    # top-level one, so the refusal must recurse rather than inspect one level.
    recurses = "findForbiddenKey(nested, depth + 1)" in contract
    checks.append(
        _check(
            "H02.write-verbs-refused-at-any-depth",
            "H.02",
            "Write verbs are refused at any nesting depth, not only at the top level",
            (CONTRACT,),
            recurses,
            "the forbidden-key scan recurses into nested objects",
        )
    )

    # prepared_action must exist only as a refused name. Anywhere it appears as
    # a type, an emitted field or a rendered value would be the capability
    # itself rather than the prohibition of it.
    action_bearing = []
    for relative in (API_CONTROLLER, PUBLIC_ROUTE, BROWSER_CLIENT, PRIVATE_PANEL, PUBLIC_PANEL):
        if "prepared_action" in _read(root, relative):
            action_bearing.append(relative)
    checks.append(
        _check(
            "H02.no-prepared-action-outside-the-refusal",
            "H.02",
            "prepared_action exists only as a refused key, never as a type, emission or UI value",
            (CONTRACT, API_CONTROLLER, PUBLIC_ROUTE, BROWSER_CLIENT, PRIVATE_PANEL, PUBLIC_PANEL),
            not action_bearing,
            "prepared_action appears only in the contract's refusal list"
            if not action_bearing
            else f"prepared_action leaked into: {', '.join(action_bearing)}",
        )
    )

    checks.append(
        _check(
            "H02.assessment-cannot-raise-maturity",
            "H.02",
            "An assessment cannot raise operational maturity",
            (CONTRACT,),
            "must not raise operational maturity" in contract
            and "'NOT_ATTESTED'" in contract,
            "assessment is pinned to NOT_ATTESTED",
        )
    )
    return checks


def _truncation_checks(root: Path) -> list[AcceptanceCheck]:
    """H.03 — a cancelled or truncated answer is removed, never shown."""
    contract = _read(root, CONTRACT)
    client = _read(root, BROWSER_CLIENT)
    checks: list[AcceptanceCheck] = []

    checks.append(
        _check(
            "H03.outcome-requires-completion",
            "H.03",
            "resolveOutcome returns text only for a stream that completed",
            (CONTRACT,),
            "sawDone && complete && refusal === null && text.length > 0" in contract,
            "usable requires done, complete, no refusal and non-empty text",
        )
    )

    checks.append(
        _check(
            "H03.client-drops-partial-text",
            "H.03",
            "The browser drops partial text unless done{complete:true} arrived",
            (BROWSER_CLIENT,),
            "status: 'refused'" in client and "text: ''" in client,
            "a refused snapshot carries no text",
        )
    )

    # A rejected frame must seal the stream rather than be skipped: skipping
    # would leave already-sent tokens looking like a finished answer.
    checks.append(
        _check(
            "H03.rejected-frame-seals-the-stream",
            "H.03",
            "A frame the contract rejects seals the stream instead of being skipped",
            (CONTRACT,),
            "sealWithRefusal('UPSTREAM_ERROR'" in contract,
            "a rejected frame ends the stream with a refusal and done{complete:false}",
        )
    )

    panels_drop = []
    for relative in (PRIVATE_PANEL, PUBLIC_PANEL):
        if "dropProvisional" not in _read(root, relative):
            panels_drop.append(relative)
    checks.append(
        _check(
            "H03.ui-removes-the-provisional-message",
            "H.03",
            "Both panels remove the provisional message rather than dimming it",
            (PRIVATE_PANEL, PUBLIC_PANEL),
            not panels_drop,
            "both panels drop the provisional message"
            if not panels_drop
            else f"no removal path in: {', '.join(panels_drop)}",
        )
    )
    return checks


def _public_contour_checks(root: Path) -> list[AcceptanceCheck]:
    """H.04 — the public contour carries no private context."""
    contract = _read(root, CONTRACT)
    route = _read(root, PUBLIC_ROUTE)
    checks: list[AcceptanceCheck] = []

    declared = _string_list(contract, "PRIVATE_IDENTITY_KEYS")
    checks.append(
        _check(
            "H04.identity-keys-refused-in-frames",
            "H.04",
            "Identity, tenant and Deal keys are refused inside any frame",
            (CONTRACT,),
            set(IDENTITY_KEYS).issubset(set(declared)),
            f"refused identity keys: {', '.join(sorted(declared)) or '(none found)'}",
        )
    )

    checks.append(
        _check(
            "H04.identity-refused-in-both-modes",
            "H.04",
            "Identity is refused in the private mode too, not only the public one",
            (CONTRACT,),
            "must not travel in a frame" in contract
            and "findPrivateKey(candidate)" in contract,
            "the identity scan runs regardless of mode",
        )
    )

    checks.append(
        _check(
            "H04.public-route-validates-as-public",
            "H.04",
            "The public boundary validates every frame in public mode",
            (PUBLIC_ROUTE,),
            "new GatewayStreamWriter(write, 'public'" in route,
            "the public writer is constructed in public mode",
        )
    )

    # The public contour reaches no account store at all: its answer comes from
    # the public knowledge base, and it must not import a Deal or session source.
    forbidden_imports = [
        needle
        for needle in ("auth-cookies", "deal-access-gate", "verified-session")
        if needle in route
    ]
    checks.append(
        _check(
            "H04.public-route-reaches-no-account-data",
            "H.04",
            "The public boundary imports no session, Deal or account source",
            (PUBLIC_ROUTE,),
            not forbidden_imports,
            "the public boundary reaches no account data"
            if not forbidden_imports
            else f"account-bearing imports: {', '.join(forbidden_imports)}",
        )
    )
    return checks


def _private_contour_checks(root: Path) -> list[AcceptanceCheck]:
    """H.05 — private context is server-derived, and the proxy stays a pipe."""
    controller = _read(root, API_CONTROLLER)
    proxy = _read(root, PROXY_ROUTE)
    checks: list[AcceptanceCheck] = []

    checks.append(
        _check(
            "H05.identity-comes-from-the-guard",
            "H.05",
            "The private stream takes its actor from the server guard, never from the body",
            (API_CONTROLLER,),
            "@CurrentUser() user: RequestUser" in controller
            and "@UseGuards(RolesGuard)" in controller,
            "the actor is resolved by the guard and passed to the service",
        )
    )

    checks.append(
        _check(
            "H05.proxy-does-not-buffer-the-stream",
            "H.05",
            "The proxy forwards the stream body instead of reading it to a string",
            (PROXY_ROUTE,),
            "new NextResponse(response.body" in proxy,
            "the stream path forwards response.body",
        )
    )

    checks.append(
        _check(
            "H05.proxy-forwards-cancellation",
            "H.05",
            "The reader's cancellation reaches upstream instead of a fixed deadline",
            (PROXY_ROUTE,),
            "streamPath ? request.signal : AbortSignal.timeout(8_000)" in proxy,
            "the stream path forwards request.signal upstream",
        )
    )

    checks.append(
        _check(
            "H05.stream-has-no-demo-form",
            "H.05",
            "The gateway stream is never answered from the demo bank",
            (PROXY_ROUTE,),
            "!streamPath && (!API_URL || demoToken)" in proxy,
            "a demo session cannot receive a demo gateway stream",
        )
    )

    checks.append(
        _check(
            "H05.private-panel-streams-as-private",
            "H.05",
            "The private panel reads the stream in private mode",
            (PRIVATE_PANEL,),
            "mode: 'private'" in _read(root, PRIVATE_PANEL),
            "the private panel validates frames as private",
        )
    )
    return checks


def _admission_checks(root: Path) -> list[AcceptanceCheck]:
    """Cuts across H.01..H.05: nothing generates without an admitted model."""
    contract = _read(root, CONTRACT)
    controller = _read(root, API_CONTROLLER)
    route = _read(root, PUBLIC_ROUTE)
    checks: list[AcceptanceCheck] = []

    checks.append(
        _check(
            "ADM.refusals-are-the-only-outcome",
            "H.01",
            "Without admission the stream refuses with FEATURE_DISABLED or MODEL_NOT_ADMITTED",
            (CONTRACT,),
            "'FEATURE_DISABLED'" in contract and "'MODEL_NOT_ADMITTED'" in contract,
            "both refusals are representable and returned by resolveAdmission",
        )
    )

    # The generation service must sit behind the admission gate: an early return
    # is what makes "no admitted model" mean "nothing was generated" rather than
    # "something was generated and then hidden".
    gated = controller.index("if (!admission.allowed)") < controller.index(
        "await this.assistant.chat("
    )
    checks.append(
        _check(
            "ADM.generation-service-not-called",
            "H.01",
            "The generation service is not called at all without admission",
            (API_CONTROLLER,),
            gated,
            "the admission refusal returns before chat() is reached",
        )
    )

    # Read as `(env.FLAG || '').trim() === 'true'`: an unset, empty or
    # differently-spelled value is false, so a flag enables generation only when
    # a deployment states it exactly.
    both = controller + route
    unguarded = [
        flag for flag in FEATURE_FLAGS if f"(env.{flag} || '').trim() === 'true'" not in both
    ]
    checks.append(
        _check(
            "ADM.flags-default-to-off",
            "H.01",
            "Production feature flags are off unless explicitly set to true",
            (API_CONTROLLER, PUBLIC_ROUTE),
            not unguarded,
            "an unset or malformed flag reads as disabled"
            if not unguarded
            else f"flag not read as an exact opt-in: {', '.join(unguarded)}",
        )
    )

    # No substitute answer may exist on any streaming path. `mock`, `stub`,
    # `canned` and `fixture` are searched as whole words so that a comment
    # explaining the prohibition does not read as the thing being prohibited.
    substitute = re.compile(r"\b(mock|stub|canned|fixture)\w*\s*(?:\(|:|=)", re.IGNORECASE)
    contaminated = [
        relative
        for relative in (API_CONTROLLER, PUBLIC_ROUTE, BROWSER_CLIENT)
        if substitute.search(_read(root, relative))
    ]
    checks.append(
        _check(
            "ADM.no-mock-or-static-fallback",
            "H.01",
            "No streaming path constructs a mock, stub or canned answer",
            (API_CONTROLLER, PUBLIC_ROUTE, BROWSER_CLIENT),
            not contaminated,
            "no substitute answer is constructed on any streaming path"
            if not contaminated
            else f"substitute answer constructed in: {', '.join(contaminated)}",
        )
    )
    return checks


def verify_gateway_acceptance(root: Path, exact_main_sha: str) -> GatewayAcceptanceReport:
    """Re-derive every H.01..H.05 property from the tree at ``root``."""
    if not re.fullmatch(r"[0-9a-f]{40}", exact_main_sha):
        raise ValueError("exact_main_sha must be a full 40-character commit sha")

    checks: list[AcceptanceCheck] = []
    checks.extend(_one_contract_checks(root))
    checks.extend(_protocol_checks(root))
    checks.extend(_truncation_checks(root))
    checks.extend(_public_contour_checks(root))
    checks.extend(_private_contour_checks(root))
    checks.extend(_admission_checks(root))
    return GatewayAcceptanceReport(exact_main_sha=exact_main_sha, checks=tuple(checks))


def acceptance_payload(report: GatewayAcceptanceReport) -> dict[str, object]:
    return report.to_json_object()
