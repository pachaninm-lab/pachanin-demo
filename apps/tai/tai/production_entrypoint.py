from __future__ import annotations

import os

from fastapi import FastAPI

from tai.main import create_app
from tai.production_runtime import (
    ProductionConfigurationError,
    ProductionRuntimeConfig,
    build_production_runtime,
)


def create_production_app(environment: dict[str, str] | None = None) -> FastAPI:
    source = dict(os.environ) if environment is None else dict(environment)
    if source.get("TAI_RUNTIME_MODE", "").strip().lower() != "production":
        return create_app(configuration_error="TAI_RUNTIME_MODE_PRODUCTION_REQUIRED")
    try:
        config = ProductionRuntimeConfig.from_environment(source)
        bundle = build_production_runtime(config)
    except ProductionConfigurationError:
        return create_app(configuration_error="TAI_PRODUCTION_CONFIGURATION_INVALID")
    except Exception:
        return create_app(configuration_error="TAI_PRODUCTION_COMPOSITION_FAILED")
    return create_app(
        runtime=bundle.runtime,
        identity_authority=bundle.identity_authority,
        readiness_probe=bundle.readiness_probe,
    )


app = create_production_app()
