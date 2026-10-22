import {
  isBankCapability,
  supportsBankCapability,
  type BankCapability,
} from '../../../../../packages/domain-core/src/bank-capability';
import type { IntegrationCapabilityMaturity } from '../../../../../packages/domain-core/src/integration-capability';
import {
  REAL_BANK_PROVIDER_FAMILIES,
  type BankProviderFamily,
  type BankReferenceAdapter,
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

function isRuntimeCapabilitySet(values: unknown): values is readonly BankCapability[] {
  return Array.isArray(values)
    && values.every((value) => typeof value === 'string' && isBankCapability(value));
}

function isRuntimeNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRuntimeProviderFamily(value: unknown): value is BankProviderFamily {
  return typeof value === 'string'
    && (REAL_BANK_PROVIDER_FAMILIES as readonly string[]).includes(value);
}

function readRuntimeProviderFamily(value: unknown): BankProviderFamily | null {
  if (typeof value !== 'object' || value === null) return null;
  // Provider identity must be an own data field, as on reference adapters and
  // server-held DTOs. Reading an identity getter could mutate an already checked
  // adapter/authority pair, including during the final readiness check itself.
  const identity = Object.getOwnPropertyDescriptor(value, 'providerFamily');
  return identity && Object.hasOwn(identity, 'value') && isRuntimeProviderFamily(identity.value)
    ? identity.value
    : null;
}

export class BankCapabilityRouter {
  private readonly byProvider = new Map<BankProviderFamily, BankReferenceAdapter>();

  constructor(adapters: readonly BankReferenceAdapter[]) {
    for (const adapter of adapters) {
      const providerFamily = readRuntimeProviderFamily(adapter);
      if (providerFamily === null) {
        throw new Error('NO_ADAPTER_FOR_SERVER_HELD_PROVIDER');
      }
      if (this.byProvider.has(providerFamily)) {
        throw new Error(`DUPLICATE_BANK_ADAPTER:${providerFamily}`);
      }
      this.byProvider.set(providerFamily, adapter);
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

    const providerFamily = readRuntimeProviderFamily(authority);
    const adapter = providerFamily !== null
      ? this.byProvider.get(providerFamily) ?? null
      : null;
    if (!adapter || readRuntimeProviderFamily(adapter) !== providerFamily) {
      return {
        status: 'UNAVAILABLE',
        adapter: null,
        reason: 'NO_ADAPTER_FOR_SERVER_HELD_PROVIDER',
      };
    }

    if (!isRuntimeCapabilitySet(authority.authorizedBankCapabilities)) {
      return {
        status: 'CONTRADICTORY',
        adapter,
        reason: 'INVALID_SERVER_HELD_CAPABILITY_SET',
      };
    }

    if (!isRuntimeCapabilitySet(adapter.capabilities)) {
      return {
        status: 'UNAVAILABLE',
        adapter,
        reason: 'INVALID_ADAPTER_CAPABILITY_SET',
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
      || !isRuntimeNonBlankString(authority.integrationBindingId)
      || !isRuntimeNonBlankString(authority.providerId)
      || !isRuntimeNonBlankString(authority.providerCapabilityId)
      || !isRuntimeNonBlankString(authority.capabilityCode)
      || !isRuntimeNonBlankString(authority.bindingKey)
      || !isRuntimeNonBlankString(authority.bindingVersion)
      || !isRuntimeNonBlankString(authority.configurationVersion)
    ) {
      return {
        status: 'CONTRADICTORY',
        adapter,
        reason: 'INCOMPLETE_SERVER_HELD_BINDING_AUTHORITY',
      };
    }

    // A server-held binding for another integration capability must never be
    // reusable as bank-routing authority merely because it carries a bank-like
    // capability list. Keep the integration-capability identity exact.
    if (authority.capabilityCode !== 'BANK') {
      return {
        status: 'CONTRADICTORY',
        adapter,
        reason: 'SERVER_HELD_CAPABILITY_CODE_MISMATCH',
      };
    }

    if (authority.maturity !== 'LIVE_ACCEPTED' || authority.mayCarryRealTraffic !== true) {
      return {
        status: 'NOT_ACTIVATED',
        adapter,
        reason: 'SERVER_HELD_MATURITY_DOES_NOT_ALLOW_REAL_TRAFFIC',
      };
    }

    if (authority.productionEnvironmentConfirmed !== true) {
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

    if (adapter.liveTransportImplemented !== true) {
      return {
        status: 'NOT_ACTIVATED',
        adapter,
        reason: 'REFERENCE_ADAPTER_HAS_NO_LIVE_TRANSPORT',
      };
    }

    // Capability/readiness properties may be accessors. Revalidate identity
    // without invoking identity getters those reads may have installed.
    if (readRuntimeProviderFamily(adapter) !== providerFamily || readRuntimeProviderFamily(authority) !== providerFamily) {
      return {
        status: 'UNAVAILABLE',
        adapter: null,
        reason: 'NO_ADAPTER_FOR_SERVER_HELD_PROVIDER',
      };
    }

    return {
      status: 'READY_FOR_REAL_TRAFFIC',
      adapter,
      authority,
    };
  }
}
