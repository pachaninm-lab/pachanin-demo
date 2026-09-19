"""Retired ML reference contour.

This package is intentionally not an executable service. The former FastAPI
runtime, dependency manifest, image and deployment authority were removed by
#2605 because they were not part of the canonical Deal execution authority and
had no accepted model lifecycle or security evidence.
"""

from __future__ import annotations

RUNTIME_STATUS = {
    "status": "NOT_DEPLOYABLE",
    "ticket": "#2605",
    "releaseAuthority": False,
    "reason": (
        "ML runtime requires a separate product, data-lineage, model-lifecycle, "
        "tenant-authorization, dependency and operational acceptance."
    ),
}


def create_app():
    """Fail closed instead of silently starting an unaccepted service."""
    raise RuntimeError("ML_RUNTIME_NOT_DEPLOYABLE:#2605")


if __name__ == "__main__":
    create_app()
