import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import {
  DEFAULT_DEV_TRACE_SAMPLE_RATIO,
  DEFAULT_OTEL_ENDPOINT,
  DEFAULT_PROD_TRACE_SAMPLE_RATIO,
  TELEMETRY_SERVICE_NAME,
  createTelemetryResource,
  resolveOtelEndpoint,
  resolveTraceSampleRatio,
  shouldIgnoreIncomingTelemetryRequest,
} from './telemetry-config';

describe('telemetry configuration', () => {
  it('builds a resource with stable service identity and environment attributes', () => {
    const resource = createTelemetryResource({
      APP_VERSION: '3.7.4',
      NODE_ENV: 'staging',
    });

    expect(resource.attributes[ATTR_SERVICE_NAME]).toBe(TELEMETRY_SERVICE_NAME);
    expect(resource.attributes[ATTR_SERVICE_VERSION]).toBe('3.7.4');
    expect(resource.attributes[ATTR_DEPLOYMENT_ENVIRONMENT_NAME]).toBe('staging');
    expect(resource.attributes['telemetry.sdk.language']).toBe('nodejs');
  });

  it('uses deterministic defaults and normalizes configured values', () => {
    const resource = createTelemetryResource({ APP_VERSION: '  ', NODE_ENV: '  ' });

    expect(resource.attributes[ATTR_SERVICE_VERSION]).toBe('3.0.0');
    expect(resource.attributes[ATTR_DEPLOYMENT_ENVIRONMENT_NAME]).toBe('development');
    expect(resolveOtelEndpoint({ OTEL_EXPORTER_OTLP_ENDPOINT: '  ' })).toBe(DEFAULT_OTEL_ENDPOINT);
    expect(resolveOtelEndpoint({ OTEL_EXPORTER_OTLP_ENDPOINT: '  http://collector:4317/  ' })).toBe(
      'http://collector:4317',
    );
  });

  it.each(['collector:4317', 'grpc://collector:4317', 'file:///tmp/telemetry'])(
    'rejects unsafe or non-absolute OTLP endpoint %s',
    (endpoint) => {
      expect(() => resolveOtelEndpoint({ OTEL_EXPORTER_OTLP_ENDPOINT: endpoint })).toThrow(
        'OTEL_EXPORTER_OTLP_ENDPOINT',
      );
    },
  );

  it.each(['/health', '/ready', '/metrics', '/metrics?format=prometheus'])(
    'excludes operational probe %s from incoming request traces',
    (url) => {
      expect(shouldIgnoreIncomingTelemetryRequest(url)).toBe(true);
    },
  );

  it.each(['/health/details', '/api/deals', undefined])('keeps business request %s traceable', (url) => {
    expect(shouldIgnoreIncomingTelemetryRequest(url)).toBe(false);
  });

  describe('trace sampling ratio', () => {
    it('samples a fraction of root spans in production and all in development', () => {
      expect(resolveTraceSampleRatio({ NODE_ENV: 'production' })).toBe(DEFAULT_PROD_TRACE_SAMPLE_RATIO);
      expect(resolveTraceSampleRatio({ NODE_ENV: 'development' })).toBe(DEFAULT_DEV_TRACE_SAMPLE_RATIO);
      expect(resolveTraceSampleRatio({})).toBe(DEFAULT_DEV_TRACE_SAMPLE_RATIO);
    });

    it('honours the standard OTEL_TRACES_SAMPLER_ARG and the project alias, even in production', () => {
      expect(resolveTraceSampleRatio({ NODE_ENV: 'production', OTEL_TRACES_SAMPLER_ARG: '0.25' })).toBe(0.25);
      expect(resolveTraceSampleRatio({ NODE_ENV: 'production', TRACING_SAMPLE_RATIO: '0' })).toBe(0);
      expect(resolveTraceSampleRatio({ OTEL_TRACES_SAMPLER_ARG: '1' })).toBe(1);
    });

    it.each(['-0.1', '1.5', 'off', 'NaN'])('rejects an out-of-range sampling ratio %s', (arg) => {
      expect(() => resolveTraceSampleRatio({ OTEL_TRACES_SAMPLER_ARG: arg })).toThrow(
        'OTEL_TRACES_SAMPLER_ARG',
      );
    });
  });
});
