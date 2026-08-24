import { ONE_C_PROTOCOL_VERSION } from './one-c-connector.protocol';
import {
  OneCHeartbeatDiagnosticCode,
  OneCHeartbeatHealth,
  type OneCHeartbeatReport,
  validateOneCHeartbeatReport,
} from './one-c-heartbeat.contract';

describe('1C heartbeat contract', () => {
  const ready = (): OneCHeartbeatReport => ({
    protocolVersion: ONE_C_PROTOCOL_VERSION,
    connectorVersion: '1.0.0',
    platformVersion: '8.3.27.1234',
    configurationVersion: '3.0.170.31',
    health: OneCHeartbeatHealth.READY,
    diagnosticCodes: [],
  });

  it('accepts only bounded code-based health evidence', () => {
    expect(() => validateOneCHeartbeatReport(ready())).not.toThrow();
    expect(() => validateOneCHeartbeatReport({
      ...ready(),
      health: OneCHeartbeatHealth.DEGRADED,
      diagnosticCodes: [OneCHeartbeatDiagnosticCode.NETWORK_DEGRADED],
    })).not.toThrow();
  });

  it('rejects free text, duplicates and inconsistent READY diagnostics', () => {
    expect(() => validateOneCHeartbeatReport({
      ...ready(), health: OneCHeartbeatHealth.DEGRADED, diagnosticCodes: [],
    })).toThrow('ONE_C_HEARTBEAT_DIAGNOSTICS_REQUIRED');
    expect(() => validateOneCHeartbeatReport({
      ...ready(), diagnosticCodes: [OneCHeartbeatDiagnosticCode.CLOCK_SKEW],
    })).toThrow('ONE_C_HEARTBEAT_DIAGNOSTICS_INVALID');
    expect(() => validateOneCHeartbeatReport({
      ...ready(), health: OneCHeartbeatHealth.BLOCKED,
      diagnosticCodes: ['password=secret' as OneCHeartbeatDiagnosticCode],
    })).toThrow('ONE_C_HEARTBEAT_DIAGNOSTICS_INVALID');
  });
});
