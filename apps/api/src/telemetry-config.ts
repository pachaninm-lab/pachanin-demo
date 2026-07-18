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
  OTEL_TRACES_SAMPLER_ARG?: string;
  TRACING_SAMPLE_RATIO?: string;
}

export const DEFAULT_OTEL_ENDPOINT = 'http://otel-collector:4317';
export const TELEMETRY_SERVICE_NAME = 'grainflow-api';

// Root-span sampling ratio. Tracing every request is a per-request CPU tax that
// is unnecessary at federal request volumes: a fraction of traces is
// statistically sufficient for latency/error diagnosis. Production therefore
// samples 10% of root spans by default while keeping full sampling in
// development; a `ParentBasedSampler` still keeps 100% of any trace already
// sampled upstream (e.g. by the gateway), so end-to-end traces stay intact.
export const DEFAULT_PROD_TRACE_SAMPLE_RATIO = 0.1;
export const DEFAULT_DEV_TRACE_SAMPLE_RATIO = 1;

export function resolveTraceSampleRatio(environment: TelemetryEnvironment = process.env): number {
  // Honour the standard OpenTelemetry knob first, then a project-local alias.
  const raw = (environment.OTEL_TRACES_SAMPLER_ARG ?? environment.TRACING_SAMPLE_RATIO)?.trim();
  if (raw !== undefined && raw !== '') {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
      throw new Error('OTEL_TRACES_SAMPLER_ARG must be a number between 0 and 1.');
    }
    return parsed;
  }
  const production = environment.NODE_ENV?.trim().toLowerCase() === 'production';
  return production ? DEFAULT_PROD_TRACE_SAMPLE_RATIO : DEFAULT_DEV_TRACE_SAMPLE_RATIO;
}

function validateOtelEndpoint(endpoint: string): string {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error('OTEL_EXPORTER_OTLP_ENDPOINT must be an absolute HTTP(S) URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('OTEL_EXPORTER_OTLP_ENDPOINT must use HTTP or HTTPS.');
  }
  return endpoint.replace(/\/+$/, '');
}

export function resolveOtelEndpoint(environment: TelemetryEnvironment = process.env): string {
  const endpoint = environment.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  return validateOtelEndpoint(endpoint || DEFAULT_OTEL_ENDPOINT);
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
