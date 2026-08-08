import {
  encodeTelemetryLog,
  isTelemetryRejection,
  type TelemetryVerdict,
} from '@pc/tai-telemetry';

/**
 * Emit one validated telemetry record as a structured log line.
 *
 * Telemetry describes a request; it must never be able to fail one. Every path
 * here swallows its own errors, because a metrics sink that throws would turn an
 * observability problem into an outage of the thing being observed.
 *
 * A rejected record is itself reportable: the reason code is a fixed string from
 * the contract, carries no request content, and a silent drop would hide the one
 * signal that says the instrumentation is wrong.
 */
export type TelemetrySink = (line: string) => void;

const defaultSink: TelemetrySink = (line) => {
  // eslint-disable-next-line no-console -- structured stdout line is the metrics transport
  console.info(line);
};

export function emitTaiTelemetry(verdict: TelemetryVerdict, sink: TelemetrySink = defaultSink): void {
  try {
    if (isTelemetryRejection(verdict)) {
      sink(JSON.stringify({ schemaVersion: 'tai.latency.rejected.v1', reason: verdict.reason }));
      return;
    }
    sink(encodeTelemetryLog(verdict.record));
  } catch {
    // A telemetry failure is never allowed to surface to the caller.
  }
}
