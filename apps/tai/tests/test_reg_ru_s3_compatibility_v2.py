from __future__ import annotations

import copy
import json
import subprocess
from pathlib import Path

import pytest

from tai import reg_ru_s3_compatibility_v2 as probe

ROOT = Path(__file__).resolve().parents[1]
AUTHORITY = ROOT / "model-artifacts" / "reg-ru-s3-compatibility-authority.v2.json"


def authority() -> dict[str, object]:
    return json.loads(AUTHORITY.read_text(encoding="utf-8"))


def exact_policy() -> dict[str, object]:
    statements: list[dict[str, object]] = []
    for index, rule in enumerate(probe.EXPECTED_RULES):
        statement: dict[str, object] = {
            "Sid": rule["name"],
            "Effect": rule["effect"],
            "Principal": {"AWS": f"arn:reg:test:key-set/{index}"},
            "Action": copy.deepcopy(rule["actions"]),
            "Resource": copy.deepcopy(rule["resources"]),
        }
        if rule["condition"]:
            statement["Condition"] = copy.deepcopy(rule["condition"])
        statements.append(statement)
    return {"Version": "2012-10-17", "Statement": statements}


def test_committed_authority_v2_is_exact() -> None:
    payload = probe.load_authority(AUTHORITY)
    assert payload["schema_version"] == probe.SCHEMA
    assert len(payload["panel_rules"]) == 7
    assert payload["key_sets"]["control_has_policy_rules"] is True


def test_exact_seven_rule_policy_validates() -> None:
    digest = probe.validate_policy(exact_policy())
    assert len(digest) == 64


def test_policy_rejects_missing_control_deny() -> None:
    policy = exact_policy()
    statements = policy["Statement"]
    assert isinstance(statements, list)
    statements.pop()
    with pytest.raises(probe.Fail, match="TAI-07-control-object-deny"):
        probe.validate_policy(policy)


def test_policy_rejects_public_allow() -> None:
    policy = exact_policy()
    statements = policy["Statement"]
    assert isinstance(statements, list)
    first = statements[0]
    assert isinstance(first, dict)
    first["Principal"] = "*"
    with pytest.raises(probe.Fail, match="PUBLIC_ALLOW_ON_TARGET"):
        probe.validate_policy(policy)


def test_expected_denial_uses_raw_http_when_cli_formatter_crashes(monkeypatch) -> None:
    runner = probe.AWS({
        "admin": ("a", "b"),
        "finalizer": ("c", "d"),
        "control": ("e", "f"),
    })
    results = iter(
        [
            subprocess.CompletedProcess(
                args=["aws"],
                returncode=255,
                stdout=b"",
                stderr=b"aws: [ERROR]: argument of type 'NoneType' is not a container or iterable\n",
            ),
            subprocess.CompletedProcess(
                args=["aws", "--debug"],
                returncode=255,
                stdout=b"",
                stderr=b"HTTP/1.1 403 Forbidden\n<Code>AccessDenied</Code>\n",
            ),
        ]
    )
    monkeypatch.setattr(runner, "run", lambda *args, **kwargs: next(results))
    runner.denied("control", ["s3api", "list-objects-v2"], "CONTROL_LIST")


def test_transport_failure_is_not_accepted_as_denial(monkeypatch) -> None:
    runner = probe.AWS({
        "admin": ("a", "b"),
        "finalizer": ("c", "d"),
        "control": ("e", "f"),
    })
    result = subprocess.CompletedProcess(
        args=["aws"],
        returncode=255,
        stdout=b"",
        stderr=b"SSL validation failed: certificate verify failed\n",
    )
    monkeypatch.setattr(runner, "run", lambda *args, **kwargs: result)
    with pytest.raises(probe.Fail, match="TRANSPORT_FAILURE"):
        runner.denied("control", ["s3api", "list-objects-v2"], "CONTROL_LIST")
