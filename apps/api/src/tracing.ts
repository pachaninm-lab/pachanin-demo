/**
 * OpenTelemetry SDK initialization — must be imported before application modules.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import {
  createTelemetryResource,
  resolveOtelEndpoint,
  shouldIgnoreIncomingTelemetryRequest,
} from './telemetry-config';

const otelEndpoint = resolveOtelEndpoint();
const traceExporter = new OTLPTraceExporter({ url: otelEndpoint });
const metricExporter = new OTLPMetricExporter({ url: otelEndpoint });

export const sdk = new NodeSDK({
  resource: createTelemetryResource(),
  spanProcessors: [new BatchSpanProcessor(traceExporter)],
  metricReaders: [
    new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 15_000,
    }),
  ],
  instrumentations: [
    new HttpInstrumentation({
      ignoreIncomingRequestHook: (request) => shouldIgnoreIncomingTelemetryRequest(request.url),
    }),
    new ExpressInstrumentation(),
    new NestInstrumentation(),
    new PgInstrumentation(),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .catch((error: unknown) => {
      // Shutdown errors must be observable without leaking request or credential data.
      console.error('OpenTelemetry shutdown failed', error);
      process.exitCode = 1;
    })
    .finally(() => process.exit());
});
