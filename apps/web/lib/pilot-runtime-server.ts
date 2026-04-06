import { sourceOfTruthMatrix } from '../../../packages/domain-core/src';
import { resolveRunMode } from '../../../shared/runtime-modes';
import { serverApiUrl, serverAuthHeaders } from './server-api';
import { logOpsEvent } from './observability';
import { resolveRuntimeGapMode, runtimeGapSource, shouldFailClosed } from './runtime-gap-policy';

function withMeta<T extends Record<string, any>>(substituteValue: T, path: string, message: string) {
  const mode = resolveRuntimeGapMode();
  const provenance = sourceOfTruthMatrix({ runMode: resolveRunMode(), sourceOfTruth: runtimeGapSource(mode) });
  return {
    ...substituteValue,
    meta: {
      ...(substituteValue.meta || {}),
      source: runtimeGapSource(mode),
      provenance,
      uiLabel: provenance.uiLabel,
      failClosed: shouldFailClosed(mode),
      degraded: true,
      runtimePath: path,
      warning: message,
      gapMode: mode,
    },
  };
}

async function safeFetch(path: string, substituteValue: Record<string, any>) {
  const mode = resolveRuntimeGapMode();
  try {
    const response = await fetch(serverApiUrl(path), { cache: 'no-store', headers: serverAuthHeaders() });
    if (!response.ok) throw new Error(`${path} ${response.status}`);
    return response.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'pilot_runtime_fetch_failed';
    await logOpsEvent({
      severity: mode === 'strict' ? 'ERROR' : 'WARN',
      scope: 'pilot_runtime_fetch',
      action: 'runtime_substitute',
      message: `Применён ${mode} pilot substitute для ${path}`,
      details: { path, error: message, mode },
    });
    return withMeta(substituteValue, path, message);
  }
}

export async function getPilotCabinet(roleId: string) {
  return safeFetch(`/pilot-runtime/cabinets/${roleId}`, { meta: { source: 'snapshot-seed-runtime' }, role: null, widgets: { queue: [], documents: [], payments: [], deals: [], alerts: [], chats: [], supportTickets: [], quickActions: [], restrictions: [], requiredEvidence: [] } });
}

export async function getDriverMobilePayload(shipmentId: string) {
  return safeFetch(`/pilot-runtime/driver-mobile/${shipmentId}`, { meta: { source: 'snapshot-seed-runtime' }, shipment: null, dispatch: null, weighbridges: { options: [] }, shipmentPlan: { checkpoints: [], roadConditions: [] }, supportTickets: [], chat: null, checklist: [] });
}

export async function getDispatchBoardPayload() {
  return safeFetch('/pilot-runtime/dispatch-board', { meta: { source: 'snapshot-seed-runtime' }, dispatchRequests: [], carriers: [], shipments: [], supportTickets: [], alerts: [] });
}

export async function getDealConsolePayload(dealId: string) {
  return safeFetch(`/pilot-runtime/deal-console/${dealId}`, { meta: { source: 'snapshot-seed-runtime' }, deal: null, linked: {}, operationalView: null, concurrency: {}, settlement: { lines: [], totals: {} }, driverTrips: [], recommendedActions: [] });
}

export async function getConnectorSandboxPayload() {
  return safeFetch('/pilot-runtime/connector-sandbox', { meta: { source: 'snapshot-seed-runtime' }, connectors: [] });
}
