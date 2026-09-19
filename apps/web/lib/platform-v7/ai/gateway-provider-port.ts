import type {
  GatewayMaturity,
  GatewayRequest,
  GatewayResponse,
} from './gateway-envelope';

export type { GatewayRequest, GatewayResponse, GatewayMaturity };
export * from './gateway-envelope';

export const GATEWAY_MATURITY: GatewayMaturity = 'pre-integration';

export interface GatewayProviderPort {
  execute(req: GatewayRequest): Promise<GatewayResponse>;
}

export class DisabledGatewayProvider implements GatewayProviderPort {
  readonly maturity: GatewayMaturity = 'pre-integration';

  async execute(_req: GatewayRequest): Promise<GatewayResponse> {
    return {
      result: null,
      confidence: 0,
      limitations: ['provider not configured — requires credentials and live integration'],
      auditContext: {
        providerId: 'disabled',
        executedAt: new Date().toISOString(),
      },
    };
  }
}
