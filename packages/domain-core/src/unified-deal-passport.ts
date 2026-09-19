import { evaluateDocumentCompletenessV2 } from './document-requirements';
import { evaluateProviderComplianceGate, type ProviderComplianceContext, type ProviderRegistryEvidence } from './provider-compliance-gates';
import { normalizeConnectorHealth } from './integration-hardening';

export type UnifiedDealPassportProvider = {
  id: string;
  name: string;
  context: ProviderComplianceContext;
  evidence?: ProviderRegistryEvidence;
};

export type UnifiedDealPassportConnector = {
  provider: string;
  mode?: string | null;
  configured?: boolean;
  status?: string | null;
  lastError?: string | null;
  backlog?: number | null;
  lateCallbacks?: number | null;
};

export function buildUnifiedDealPassport(input: {
  dealId: string;
  lotId?: string | null;
  shipmentIds?: string[];
  documents?: any[];
  providers?: UnifiedDealPassportProvider[];
  connectors?: UnifiedDealPassportConnector[];
  role?: string | null;
  scenario?: string | null;
}) {
  const documentGate = evaluateDocumentCompletenessV2({
    scenario: input.scenario || 'hold_release',
    role: input.role,
    documents: input.documents || []
  });

  const providerGates = (input.providers || []).map((provider) => ({
    id: provider.id,
    name: provider.name,
    decision: evaluateProviderComplianceGate({ context: provider.context, evidence: provider.evidence })
  }));

  const connectorGates = (input.connectors || []).map((connector) => normalizeConnectorHealth(connector));

  const blockers = [
    ...documentGate.blockers,
    ...providerGates.filter((item) => item.decision.status !== 'READY').map((item) => `provider_${item.id}_${item.decision.status.toLowerCase()}`),
    ...connectorGates.filter((item) => item.health === 'RED').map((item) => `${item.provider}_connector_red`)
  ];

  return {
    passportId: `passport:${input.dealId}`,
    dealId: input.dealId,
    lotId: input.lotId || null,
    shipmentIds: input.shipmentIds || [],
    documentGate,
    providerGates,
    connectorGates,
    gateState: blockers.length === 0 ? 'GREEN' : blockers.some((item) => item.includes('red') || item.startsWith('missing_') || item.includes('blocked')) ? 'RED' : 'AMBER',
    blockers,
    nextAction: blockers.length === 0
      ? 'Паспорт сделки собран. Можно продолжать следующий шаг.'
      : `Осталось снять блокеры: ${blockers.join(', ')}`
  };
}
