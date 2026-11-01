import { types as nodeTypes } from 'node:util';
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

type OwnData = Readonly<{ value: unknown }>;

function readOwnData(value: object, key: PropertyKey): OwnData | null {
  // A Proxy can execute user code even for descriptor reflection. Detect it
  // with Node's native predicate before any reflection, including revoked ones.
  if (nodeTypes.isProxy(value)) return null;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, 'value')
    ? { value: descriptor.value }
    : null;
}

function snapshotBankCapabilities(value: unknown): readonly BankCapability[] | null {
  if (typeof value !== 'object' || value === null || nodeTypes.isProxy(value) || !Array.isArray(value)) {
    return null;
  }
  const length = readOwnData(value, 'length');
  if (!length || typeof length.value !== 'number' || !Number.isSafeInteger(length.value) || length.value < 0) {
    return null;
  }
  const snapshot: BankCapability[] = [];
  // Do not use an input iterator, every(), includes(), or indexed getters.
  for (let index = 0; index < length.value; index += 1) {
    const item = readOwnData(value, String(index));
    if (!item || typeof item.value !== 'string' || !isBankCapability(item.value)) return null;
    snapshot.push(item.value);
  }
  return Object.freeze(snapshot);
}

const AUTHORITY_FIELDS = [
  'providerFamily', 'integrationBindingId', 'bindingKey', 'providerId',
  'providerCapabilityId', 'capabilityCode', 'authorizedBankCapabilities',
  'maturity', 'bindingVersion', 'configurationVersion', 'evidenceMode',
  'credentialReadiness', 'callbackTrustReadiness',
  'productionEnvironmentConfirmed', 'mayCarryRealTraffic',
] as const;

function snapshotAuthorityData(value: object): Record<string, unknown> | null {
  if (nodeTypes.isProxy(value)) return null;
  const snapshot: Record<string, unknown> = Object.create(null);
  for (const key of AUTHORITY_FIELDS) {
    const field = readOwnData(value, key);
    if (!field) return null;
    snapshot[key] = field.value;
  }
  return snapshot;
}

function isRuntimeNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRuntimeProviderFamily(value: unknown): value is BankProviderFamily {
  return typeof value === 'string'
    && (REAL_BANK_PROVIDER_FAMILIES as readonly string[]).includes(value);
}

function readRuntimeProviderFamily(value: unknown): BankProviderFamily | null {
  if (typeof value !== 'object' || value === null || nodeTypes.isProxy(value)) return null;
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
    if (nodeTypes.isProxy(adapters) || !Array.isArray(adapters)) {
      throw new Error('NO_ADAPTER_FOR_SERVER_HELD_PROVIDER');
    }
    const length = readOwnData(adapters, 'length');
    if (!length || typeof length.value !== 'number') {
      throw new Error('NO_ADAPTER_FOR_SERVER_HELD_PROVIDER');
    }
    for (let index = 0; index < length.value; index += 1) {
      const slot = readOwnData(adapters, String(index));
      const adapter = slot?.value as BankReferenceAdapter | undefined;
      const providerFamily = readRuntimeProviderFamily(adapter);
      if (providerFamily === null) {
        throw new Error('NO_ADAPTER_FOR_SERVER_HELD_PROVIDER');
      }
      if (this.byProvider.has(providerFamily)) {
        throw new Error(`DUPLICATE_BANK_ADAPTER:${providerFamily}`);
      }
      this.byProvider.set(providerFamily, adapter!);
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

    if (typeof requiredCapability !== 'string' || !isBankCapability(requiredCapability)) {
      return { status: 'UNSUPPORTED', adapter: null, reason: 'INVALID_REQUIRED_BANK_CAPABILITY' };
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

    const originalAuthority = authority;
    const authorityData = snapshotAuthorityData(authority);
    if (!authorityData) {
      return {
        status: 'CONTRADICTORY', adapter,
        reason: 'INCOMPLETE_SERVER_HELD_BINDING_AUTHORITY',
      };
    }
    const authorizedBankCapabilities = snapshotBankCapabilities(authorityData.authorizedBankCapabilities);
    if (!authorizedBankCapabilities) {
      return {
        status: 'CONTRADICTORY', adapter,
        reason: 'INVALID_SERVER_HELD_CAPABILITY_SET',
      };
    }
    const adapterCapabilityData = readOwnData(adapter, 'capabilities');
    const adapterTransportData = readOwnData(adapter, 'liveTransportImplemented');
    if (!adapterCapabilityData || !adapterTransportData) {
      return {
        status: 'UNAVAILABLE', adapter: null,
        reason: 'NO_ADAPTER_FOR_SERVER_HELD_PROVIDER',
      };
    }
    const adapterCapabilities = snapshotBankCapabilities(adapterCapabilityData.value);
    if (!adapterCapabilities) {
      return {
        status: 'UNAVAILABLE', adapter,
        reason: 'INVALID_ADAPTER_CAPABILITY_SET',
      };
    }
    // Only own data reaches this record. Validate every admission field below
    // against this one immutable view, rather than re-reading mutable input.
    authority = Object.freeze({ ...authorityData, authorizedBankCapabilities }) as unknown as BankRoutingAuthority;

    if (!supportsBankCapability(authority.authorizedBankCapabilities, requiredCapability)) {
      return {
        status: 'UNSUPPORTED',
        adapter,
        reason: `SERVER_HELD_CAPABILITY_NOT_AUTHORIZED:${requiredCapability}`,
      };
    }

    if (!supportsBankCapability(adapterCapabilities, requiredCapability)) {
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

    if (adapterTransportData.value !== true) {
      return {
        status: 'NOT_ACTIVATED',
        adapter,
        reason: 'REFERENCE_ADAPTER_HAS_NO_LIVE_TRANSPORT',
      };
    }

    // Preserve the original provider-identity boundary as well as the snapshot.
    if (readRuntimeProviderFamily(adapter) !== providerFamily || readRuntimeProviderFamily(originalAuthority) !== providerFamily) {
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
