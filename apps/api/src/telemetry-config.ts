import { defaultResource, resourceFromAttributes, type Resource } from '@opentelemetry/resources';
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

export interface TelemetryEnvironment {
  APP_VERSION?: string;
  NODE_ENV?: string;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
}

export const DEFAULT_OTEL_ENDPOINT = 'http://otel-collector:4317';
export const TELEMETRY_SERVICE_NAME = 'grainflow-api';

export function resolveOtelEndpoint(environment: TelemetryEnvironment = process.env): string {
  const endpoint = environment.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  return endpoint || DEFAULT_OTEL_ENDPOINT;
}

export function createTelemetryResource(environment: TelemetryEnvironment = process.env): Resource {
  return defaultResource().merge(
    resourceFromAttributes({
      [ATTR_SERVICE_NAME]: TELEMETRY_SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: environment.APP_VERSION?.trim() || '3.0.0',
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: environment.NODE_ENV?.trim() || 'development',
    }),
  );
}

export function shouldIgnoreIncomingTelemetryRequest(url: string | undefined): boolean {
  const pathname = (url ?? '').split('?', 1)[0];
  return pathname === '/health' || pathname === '/ready' || pathname === '/metrics';
}
