/**
 * OpenTelemetry SDK инициализация — должна быть импортирована первой в main.ts
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';

const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://otel-collector:4317';

const resource = new Resource({
  [SEMRESATTRS_SERVICE_NAME]: 'grainflow-api',
  [SEMRESATTRS_SERVICE_VERSION]: process.env.APP_VERSION || '3.0.0',
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
});

const traceExporter = new OTLPTraceExporter({
  url: OTEL_ENDPOINT,
});

const metricExporter = new OTLPMetricExporter({
  url: OTEL_ENDPOINT,
});

export const sdk = new NodeSDK({
  resource,
  spanProcessor: new BatchSpanProcessor(traceExporter),
  metricReader: new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 15000,
  }),
  instrumentations: [
    new HttpInstrumentation({
      ignoreIncomingRequestHook: (req) => {
        const url = req.url || '';
        return url === '/health' || url === '/ready' || url === '/metrics';
      },
    }),
    new ExpressInstrumentation(),
    new NestInstrumentation(),
    new PgInstrumentation(),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().catch(() => {}).finally(() => process.exit(0));
});
