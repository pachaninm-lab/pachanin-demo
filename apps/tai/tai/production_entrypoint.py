from __future__ import annotations

import os

from fastapi import FastAPI

from tai.main import create_app
from tai.model_admission import ModelAdmissionAwareReadinessProbe
from tai.postgres_connection import PsycopgConnectionFactory
from tai.postgres_tool_planner import (
    PlannerAwareReadinessProbe,
    PostgreSQLToolPlannerDecisionSink,
)
from tai.production_platform_tools import production_platform_tool_handlers
from tai.production_runtime import (
    ProductionConfigurationError,
    ProductionRuntimeConfig,
    build_production_runtime,
)
from tai.tool_planner import GovernedToolPlanner


def create_production_app(environment: dict[str, str] | None = None) -> FastAPI:
    source = dict(os.environ) if environment is None else dict(environment)
    if source.get("TAI_RUNTIME_MODE", "").strip().lower() != "production":
        return create_app(configuration_error="TAI_RUNTIME_MODE_PRODUCTION_REQUIRED")
    try:
        config = ProductionRuntimeConfig.from_environment(source)
        database = PsycopgConnectionFactory(
            config.database_url,
            connect_timeout_seconds=config.database_connect_timeout_seconds,
        )
        tool_handlers = production_platform_tool_handlers(source, config)
        tool_planner = (
            GovernedToolPlanner(
                available_tools=frozenset(tool_handlers),
                decision_sink=PostgreSQLToolPlannerDecisionSink(database),
            )
            if tool_handlers
            else None
        )
        bundle = build_production_runtime(
            config,
            connection_factory=database,
            tool_handlers=tool_handlers,
            tool_planner=tool_planner,
        )
        planner_readiness = PlannerAwareReadinessProbe(
            delegate=bundle.readiness_probe,
            connection_factory=database,
            planner_required=bool(tool_handlers),
        )
        readiness_probe = ModelAdmissionAwareReadinessProbe(
            delegate=planner_readiness,
            connection_factory=database,
        )
    except ProductionConfigurationError:
        return create_app(configuration_error="TAI_PRODUCTION_CONFIGURATION_INVALID")
    except Exception:
        return create_app(configuration_error="TAI_PRODUCTION_COMPOSITION_FAILED")
    return create_app(
        runtime=bundle.runtime,
        identity_authority=bundle.identity_authority,
        readiness_probe=readiness_probe,
    )


app = create_production_app()
