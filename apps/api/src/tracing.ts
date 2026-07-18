/**
 * OpenTelemetry SDK initialization — must be imported before application modules.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-node';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import {
  createTelemetryResource,
  resolveOtelEndpoint,
  resolveTraceSampleRatio,
  shouldIgnoreIncomingTelemetryRequest,
} from './telemetry-config';

const otelEndpoint = resolveOtelEndpoint();
const traceExporter = new OTLPTraceExporter({ url: otelEndpoint });
const metricExporter = new OTLPMetricExporter({ url: otelEndpoint });

// Sample root spans by ratio (parent-sampled traces are always kept) instead of
// the SDK default of tracing every request, which is a measurable per-request
// CPU cost on this CPU-bound API path.
const traceSampler = new ParentBasedSampler({
  root: new TraceIdRatioBasedSampler(resolveTraceSampleRatio()),
});

export const sdk = new NodeSDK({
  resource: createTelemetryResource(),
  sampler: traceSampler,
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

let shutdownPromise: Promise<void> | undefined;

export function shutdownTelemetry(): Promise<void> {
  shutdownPromise ??= sdk.shutdown();
  return shutdownPromise;
}

// The standalone outbox worker owns its complete shutdown sequence so it can
// stop claims, finish the active drain, close Prisma/Kafka, then flush telemetry.
// Retain the existing API behavior until the API lifecycle is migrated to the
// same explicit ownership model in its own authority slice.
if (process.env.RUNTIME_COMPONENT !== 'outbox-worker') {
  process.on('SIGTERM', () => {
    shutdownTelemetry()
      .catch((error: unknown) => {
        // Shutdown errors must be observable without leaking request or credential data.
        console.error('OpenTelemetry shutdown failed', error);
        process.exitCode = 1;
      })
      .finally(() => process.exit());
  });
}
