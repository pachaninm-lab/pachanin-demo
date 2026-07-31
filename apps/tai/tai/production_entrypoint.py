from __future__ import annotations

import os

from fastapi import FastAPI

from tai.always_on_core import (
    AlwaysOnConfig,
    AlwaysOnConfigurationError,
    AlwaysOnModelSupervisor,
    AsyncModelAdmissionGate,
    install_always_on_core,
)
from tai.local_model_invoker import LocalEndpointPolicy
from tai.main import create_app
from tai.model_admission import ModelAdmissionAwareReadinessProbe
from tai.postgres_connection import PsycopgConnectionFactory
from tai.postgres_model_runtime import PostgreSQLModelRuntimeRepository
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
        always_on_config = AlwaysOnConfig.from_environment(
            source,
            maximum_inflight=config.model_maximum_inflight,
        )
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
        always_on_gate = AsyncModelAdmissionGate(always_on_config)
        always_on_supervisor = AlwaysOnModelSupervisor(
            config=always_on_config,
            bindings=config.model_endpoints,
            gate=always_on_gate,
            model_repository=PostgreSQLModelRuntimeRepository(database),
            endpoint_policy=LocalEndpointPolicy(
                allowed_hosts=config.allowed_model_hosts,
            ),
        )
    except (ProductionConfigurationError, AlwaysOnConfigurationError):
        return create_app(configuration_error="TAI_PRODUCTION_CONFIGURATION_INVALID")
    except Exception:
        return create_app(configuration_error="TAI_PRODUCTION_COMPOSITION_FAILED")

    application = create_app(
        runtime=bundle.runtime,
        identity_authority=bundle.identity_authority,
        readiness_probe=readiness_probe,
    )
    install_always_on_core(
        application,
        gate=always_on_gate,
        supervisor=always_on_supervisor,
    )
    return application


app = create_production_app()
