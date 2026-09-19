import { Injectable } from '@nestjs/common';
import {
  FgisGrainCanonicalizationPort,
  FgisGrainDispatchError,
  FgisGrainImmutablePayloadStorePort,
  FgisGrainProviderConfigurationPort,
  FgisGrainSignedEnvelopeAssemblerPort,
  FgisGrainSigningProviderPort,
  FgisGrainSoapTransportPort,
  type FgisGrainAssemblyRequest,
  type FgisGrainCanonicalizationRequest,
  type FgisGrainSigningRequest,
  type FgisGrainTransportRequest,
} from './fgis-grain-1.0.23.dispatch.contract';

function unavailable(
  code:
    | 'PROVIDER_CONFIG_NOT_CONFIGURED'
    | 'PAYLOAD_NOT_FOUND'
    | 'CANONICALIZATION_UNAVAILABLE'
    | 'SIGNING_PROVIDER_UNAVAILABLE'
    | 'ENVELOPE_ASSEMBLY_UNAVAILABLE'
    | 'TRANSPORT_UNAVAILABLE',
): never {
  throw new FgisGrainDispatchError(
    code,
    'FGIS Grain provider capability is not configured or attested',
    code === 'TRANSPORT_UNAVAILABLE',
  );
}

@Injectable()
export class FailClosedFgisGrainProviderConfigurationPort
  extends FgisGrainProviderConfigurationPort {
  async resolve(_reference: string): Promise<unknown> {
    return unavailable('PROVIDER_CONFIG_NOT_CONFIGURED');
  }
}

@Injectable()
export class FailClosedFgisGrainImmutablePayloadStorePort
  extends FgisGrainImmutablePayloadStorePort {
  async load(_reference: string) {
    return unavailable('PAYLOAD_NOT_FOUND');
  }
}

@Injectable()
export class FailClosedFgisGrainCanonicalizationPort
  extends FgisGrainCanonicalizationPort {
  async canonicalize(_request: FgisGrainCanonicalizationRequest) {
    return unavailable('CANONICALIZATION_UNAVAILABLE');
  }
}

@Injectable()
export class FailClosedFgisGrainSigningProviderPort
  extends FgisGrainSigningProviderPort {
  async sign(_request: FgisGrainSigningRequest) {
    return unavailable('SIGNING_PROVIDER_UNAVAILABLE');
  }
}

@Injectable()
export class FailClosedFgisGrainSignedEnvelopeAssemblerPort
  extends FgisGrainSignedEnvelopeAssemblerPort {
  async assemble(_request: FgisGrainAssemblyRequest) {
    return unavailable('ENVELOPE_ASSEMBLY_UNAVAILABLE');
  }
}

@Injectable()
export class FailClosedFgisGrainSoapTransportPort
  extends FgisGrainSoapTransportPort {
  async send(_request: FgisGrainTransportRequest) {
    return unavailable('TRANSPORT_UNAVAILABLE');
  }
}
