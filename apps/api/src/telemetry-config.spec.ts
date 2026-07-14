import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import {
  DEFAULT_OTEL_ENDPOINT,
  TELEMETRY_SERVICE_NAME,
  createTelemetryResource,
  resolveOtelEndpoint,
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

  it('uses deterministic defaults and trims configured values', () => {
    const resource = createTelemetryResource({ APP_VERSION: '  ', NODE_ENV: '  ' });

    expect(resource.attributes[ATTR_SERVICE_VERSION]).toBe('3.0.0');
    expect(resource.attributes[ATTR_DEPLOYMENT_ENVIRONMENT_NAME]).toBe('development');
    expect(resolveOtelEndpoint({ OTEL_EXPORTER_OTLP_ENDPOINT: '  ' })).toBe(DEFAULT_OTEL_ENDPOINT);
    expect(resolveOtelEndpoint({ OTEL_EXPORTER_OTLP_ENDPOINT: '  http://collector:4317  ' })).toBe(
      'http://collector:4317',
    );
  });

  it.each(['/health', '/ready', '/metrics', '/metrics?format=prometheus'])(
    'excludes operational probe %s from incoming request traces',
    (url) => {
      expect(shouldIgnoreIncomingTelemetryRequest(url)).toBe(true);
    },
  );

  it.each(['/health/details', '/api/deals', undefined])('keeps business request %s traceable', (url) => {
    expect(shouldIgnoreIncomingTelemetryRequest(url)).toBe(false);
  });
});
