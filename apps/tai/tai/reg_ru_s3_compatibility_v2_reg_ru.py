from __future__ import annotations

import re
from collections.abc import Callable

from tai import reg_ru_s3_compatibility_v2 as verifier

_PROVIDER_LOCATION_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")


def validate_reg_ru_bucket_configuration(
    location_response: object,
    versioning_response: object,
    object_lock_response: object,
    signing_region: str,
) -> dict[str, object]:
    """Validate REG.RU controls without conflating location and signing region."""

    location = verifier._mapping(location_response).get("LocationConstraint")
    if location in (None, ""):
        location_status = "EMPTY_OR_ABSENT"
        location_value: str | None = None
    elif isinstance(location, str) and _PROVIDER_LOCATION_RE.fullmatch(location):
        location_status = "PROVIDER_VALUE_PRESENT"
        location_value = location
    else:
        raise verifier.ProbeFailure("BUCKET_LOCATION_RESPONSE_INVALID")

    if verifier._mapping(versioning_response).get("Status") != "Enabled":
        raise verifier.ProbeFailure("VERSIONING_NOT_ENABLED")
    lock = verifier._mapping(
        verifier._mapping(object_lock_response).get("ObjectLockConfiguration")
    )
    if lock.get("ObjectLockEnabled") != "Enabled":
        raise verifier.ProbeFailure("OBJECT_LOCK_NOT_ENABLED")
    retention = verifier._mapping(
        verifier._mapping(lock.get("Rule")).get("DefaultRetention")
    )
    if retention != {"Mode": "COMPLIANCE", "Days": 90}:
        raise verifier.ProbeFailure("DEFAULT_RETENTION_NOT_COMPLIANCE_90D")

    return {
        "location_constraint": location_value,
        "location_observation_status": location_status,
        "location_semantics": "OBSERVED_NOT_PINNED_TO_SIGNING_REGION",
        "signing_region": signing_region,
        "versioning_status": "Enabled",
        "object_lock_status": "Enabled",
        "retention_mode": "COMPLIANCE",
        "retention_days": 90,
    }


def install_reg_ru_location_semantics() -> None:
    """Install the narrow provider adapter before the existing v2 main executes."""

    validator: Callable[[object, object, object, str], dict[str, object]] = (
        validate_reg_ru_bucket_configuration
    )
    setattr(verifier, "_validate_bucket_configuration", validator)


def main(argv: list[str] | None = None) -> int:
    install_reg_ru_location_semantics()
    return verifier.main(argv)


if __name__ == "__main__":
    raise SystemExit(main())
