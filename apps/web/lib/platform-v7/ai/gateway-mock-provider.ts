import type { GatewayProviderPort } from './gateway-provider-port';
import type { GatewayRequest, GatewayResponse, GatewayScope } from './gateway-envelope';

const MOCK_PROVIDER_ID = 'mock-preintegration';

const LIMITATIONS = [
  'pre-integration mock output — requires human review',
  'cannot override bank, document, logistics, quality or dispute statuses',
  'does not make binding decisions or trigger external actions',
] as const;

const SCOPE_COPY: Record<GatewayScope, string> = {
  hint: 'Проверьте текущий блокер, ответственного и ближайшее безопасное действие.',
  summary: 'Сводка сформирована по входному снимку без внешних подтверждений.',
  blocker_explanation: 'Причина остановки должна быть сверена с документами, деньгами, логистикой и ответственным.',
  next_action: 'Следующее действие требует проверки человеком перед применением в контуре сделки.',
  evidence_summary: 'Пакет доказательств требует сверки источника, времени, роли и влияния на деньги.',
  triage: 'Приоритизация предварительная и не заменяет решение оператора, банка или арбитра.',
};

function stableSnapshotKey(snapshot: Record<string, unknown>): string {
  return Object.keys(snapshot)
    .sort()
    .map((key) => `${key}:${JSON.stringify(snapshot[key])}`)
    .join('|');
}

export class MockGatewayProvider implements GatewayProviderPort {
  readonly maturity = 'pre-integration' as const;

  async execute(req: GatewayRequest): Promise<GatewayResponse> {
    const snapshotKey = stableSnapshotKey(req.inputSnapshot);
    const result = [
      `scope=${req.scope}`,
      `role=${req.role}`,
      `deal=${req.dealId}`,
      SCOPE_COPY[req.scope],
      snapshotKey ? `snapshot=${snapshotKey}` : 'snapshot=empty',
    ].join(' | ');

    return {
      result,
      confidence: 0.42,
      limitations: LIMITATIONS,
      auditContext: {
        providerId: MOCK_PROVIDER_ID,
        executedAt: `mock:${req.idempotencyKey}`,
      },
    };
  }
}

export function createMockGatewayProvider(): MockGatewayProvider {
  return new MockGatewayProvider();
}
