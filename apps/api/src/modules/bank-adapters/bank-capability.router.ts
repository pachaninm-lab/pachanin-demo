import {
  supportsBankCapability,
  type BankCapability,
} from '../../../../../packages/domain-core/src/bank-capability';
import type { IntegrationCapabilityMaturity } from '../../../../../packages/domain-core/src/integration-capability';
import type {
  BankProviderFamily,
  BankReferenceAdapter,
} from './bank-adapter.port';

export type BankRoutingReadiness = 'VERIFIED_CURRENT' | 'MISSING_OR_UNKNOWN' | 'EXPIRED_OR_REVOKED';

export type BankRoutingAuthority = Readonly<{
  providerFamily: BankProviderFamily;
  integrationBindingId: string;
  bindingKey: string;
  providerId: string;
  providerCapabilityId: string;
  capabilityCode: string;
  authorizedBankCapabilities: readonly BankCapability[];
  maturity: IntegrationCapabilityMaturity;
  bindingVersion: string;
  configurationVersion: string;
  evidenceMode: 'SERVER_HELD';
  credentialReadiness: BankRoutingReadiness;
  callbackTrustReadiness: BankRoutingReadiness;
  productionEnvironmentConfirmed: boolean;
  mayCarryRealTraffic: boolean;
}>;

export type BankRouteDecision =
  | Readonly<{
      status: 'READY_FOR_REAL_TRAFFIC';
      adapter: BankReferenceAdapter;
      authority: BankRoutingAuthority;
    }>
  | Readonly<{
      status: 'NOT_ACTIVATED' | 'UNSUPPORTED' | 'CONTRADICTORY' | 'UNAVAILABLE';
      adapter: BankReferenceAdapter | null;
      reason: string;
    }>;

export class BankCapabilityRouter {
  private readonly byProvider = new Map<BankProviderFamily, BankReferenceAdapter>();

  constructor(adapters: readonly BankReferenceAdapter[]) {
    for (const adapter of adapters) {
      if (this.byProvider.has(adapter.providerFamily)) {
        throw new Error(`DUPLICATE_BANK_ADAPTER:${adapter.providerFamily}`);
      }
      this.byProvider.set(adapter.providerFamily, adapter);
    }
  }

  route(
    authority: BankRoutingAuthority | null,
    requiredCapability: BankCapability,
  ): BankRouteDecision {
    if (!authority) {
      return {
        status: 'NOT_ACTIVATED',
        adapter: null,
        reason: 'SERVER_HELD_PROVIDER_BINDING_REQUIRED',
      };
    }

    const adapter = this.byProvider.get(authority.providerFamily) ?? null;
    if (!adapter) {
      return {
        status: 'UNAVAILABLE',
        adapter: null,
        reason: 'NO_ADAPTER_FOR_SERVER_HELD_PROVIDER',
      };
    }

    if (!supportsBankCapability(authority.authorizedBankCapabilities, requiredCapability)) {
      return {
        status: 'UNSUPPORTED',
        adapter,
        reason: `SERVER_HELD_CAPABILITY_NOT_AUTHORIZED:${requiredCapability}`,
      };
    }

    if (!supportsBankCapability(adapter.capabilities, requiredCapability)) {
      return {
        status: 'UNSUPPORTED',
        adapter,
        reason: `CAPABILITY_NOT_SUPPORTED:${requiredCapability}`,
      };
    }

    if (
      authority.evidenceMode !== 'SERVER_HELD'
      || !authority.integrationBindingId.trim()
      || !authority.providerId.trim()
      || !authority.providerCapabilityId.trim()
      || !authority.bindingKey.trim()
      || !authority.bindingVersion.trim()
      || !authority.configurationVersion.trim()
    ) {
      return {
        status: 'CONTRADICTORY',
        adapter,
        reason: 'INCOMPLETE_SERVER_HELD_BINDING_AUTHORITY',
      };
    }

    if (authority.maturity !== 'LIVE_ACCEPTED' || !authority.mayCarryRealTraffic) {
      return {
        status: 'NOT_ACTIVATED',
        adapter,
        reason: 'SERVER_HELD_MATURITY_DOES_NOT_ALLOW_REAL_TRAFFIC',
      };
    }

    if (!authority.productionEnvironmentConfirmed) {
      return {
        status: 'NOT_ACTIVATED',
        adapter,
        reason: 'PRODUCTION_ENVIRONMENT_NOT_CONFIRMED',
      };
    }

    if (
      authority.credentialReadiness !== 'VERIFIED_CURRENT'
      || authority.callbackTrustReadiness !== 'VERIFIED_CURRENT'
    ) {
      return {
        status: 'NOT_ACTIVATED',
        adapter,
        reason: 'CREDENTIAL_OR_CALLBACK_TRUST_NOT_VERIFIED',
      };
    }

    if (!adapter.liveTransportImplemented) {
      return {
        status: 'NOT_ACTIVATED',
        adapter,
        reason: 'REFERENCE_ADAPTER_HAS_NO_LIVE_TRANSPORT',
      };
    }

    return {
      status: 'READY_FOR_REAL_TRAFFIC',
      adapter,
      authority,
    };
  }
}
