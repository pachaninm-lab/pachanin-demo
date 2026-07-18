from __future__ import annotations

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RELEASE = ROOT / "apps/tai/tai/release_acceptance.py"
WORKFLOW = ROOT / ".github/workflows/tai-ap11-commit-patch.yml"


def main() -> None:
    text = RELEASE.read_text()
    text = text.replace(
        "from collections.abc import Mapping, Sequence\n",
        "from collections.abc import Mapping\n",
        1,
    )
    text = text.replace(
        "from dataclasses import dataclass, field\n",
        "from dataclasses import dataclass\n",
        1,
    )
    text = text.replace(
        "    minimum_migration_version: int = 10\n",
        "    minimum_migration_version: int = 11\n",
        1,
    )

    lines = text.splitlines()
    application_class = lines.index("class ApplicationReleaseAttestation:")
    application_post = next(
        index
        for index, line in enumerate(lines[application_class:], application_class)
        if line == "    def __post_init__(self) -> None:"
    )
    release_digest = next(
        index
        for index, line in enumerate(lines[application_post:], application_post)
        if line == '        _digest(self.release_id, "release_id")'
    )
    validation = [
        "        if _REPOSITORY.fullmatch(self.repository) is None:",
        '            raise ValueError("repository must use owner/name form")',
        "        if self.accepted and self.reasons:",
        '            raise ValueError("accepted application attestation must not contain reasons")',
        "        if not self.accepted and not self.reasons:",
        '            raise ValueError("rejected application attestation requires reasons")',
        "        if (",
        "            self.production_operational_status",
        "            is not ProductionOperationalStatus.NOT_ATTESTED",
        "        ):",
        "            raise ValueError(",
        '                "application attestation cannot claim production operational acceptance"',
        "            )",
    ]
    lines[release_digest + 1 : release_digest + 1] = validation
    text = "\n".join(lines) + "\n"

    start = text.index(
        "@dataclass(frozen=True, slots=True)\nclass ProductionReleaseAttestation:"
    )
    end = text.index("\n\nclass ProductionReleaseAuthority:", start)
    block = '''@dataclass(frozen=True, slots=True)
class ProductionReleaseAttestation:
    release_id: str
    exact_main_sha: str
    application_attestation_sha256: str
    evaluation_report_sha256: str
    operational_decision_sha256: str
    status: ProductionOperationalStatus
    reasons: tuple[str, ...]
    attested_at: datetime
    attestation_sha256: str

    def __post_init__(self) -> None:
        _digest(self.release_id, "release_id")
        _digest(self.exact_main_sha, "exact_main_sha")
        _digest(
            self.application_attestation_sha256,
            "application_attestation_sha256",
        )
        _digest(self.evaluation_report_sha256, "evaluation_report_sha256")
        _digest(
            self.operational_decision_sha256,
            "operational_decision_sha256",
        )
        _aware(self.attested_at, "attested_at")
        _digest(self.attestation_sha256, "attestation_sha256")
        if self.status is ProductionOperationalStatus.NOT_ATTESTED:
            raise ValueError("production attestation must be ACCEPTED or REJECTED")
        if self.status is ProductionOperationalStatus.ACCEPTED and self.reasons:
            raise ValueError("accepted production attestation must not contain reasons")
        if self.status is ProductionOperationalStatus.REJECTED and not self.reasons:
            raise ValueError("rejected production attestation requires reasons")
        expected = production_attestation_sha256(
            release_id=self.release_id,
            exact_main_sha=self.exact_main_sha,
            application_attestation_sha256=self.application_attestation_sha256,
            evaluation_report_sha256=self.evaluation_report_sha256,
            operational_decision_sha256=self.operational_decision_sha256,
            status=self.status,
            reasons=self.reasons,
            attested_at=self.attested_at,
        )
        if self.attestation_sha256 != expected:
            raise ValueError("production attestation digest does not match fields")


def production_attestation_sha256(
    *,
    release_id: str,
    exact_main_sha: str,
    application_attestation_sha256: str,
    evaluation_report_sha256: str,
    operational_decision_sha256: str,
    status: ProductionOperationalStatus,
    reasons: tuple[str, ...],
    attested_at: datetime,
) -> str:
    return _sha256_json(
        {
            "application_attestation_sha256": application_attestation_sha256,
            "attested_at": attested_at.isoformat(),
            "evaluation_report_sha256": evaluation_report_sha256,
            "exact_main_sha": exact_main_sha,
            "operational_decision_sha256": operational_decision_sha256,
            "reasons": list(reasons),
            "release_id": release_id,
            "status": status.value,
        }
    )
'''
    text = text[:start] + block + text[end:]
    ast.parse(text, filename=str(RELEASE))
    RELEASE.write_text(text)
    Path(__file__).unlink()
    WORKFLOW.unlink()


if __name__ == "__main__":
    main()
