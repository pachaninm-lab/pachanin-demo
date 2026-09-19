import { Injectable } from '@nestjs/common';
import {
  mapDecodedFgisGrainInboundEnvelope,
  type FgisGrainBuildUnsignedSoapEnvelopeInput,
  type FgisGrainInboundMappingContext,
  type FgisGrainSoapDecodeOptions,
} from './fgis-grain-1.0.23.xml-codec';
import {
  buildGovernedUnsignedFgisGrainSoapEnvelope,
  decodeGovernedFgisGrainSoapEnvelope,
} from './fgis-grain-1.0.23.xml-policy';

@Injectable()
export class FgisGrainXmlCodecService {
  decode(
    input: string | Uint8Array,
    options: FgisGrainSoapDecodeOptions = {},
  ) {
    return decodeGovernedFgisGrainSoapEnvelope(input, options);
  }

  buildUnsigned(input: FgisGrainBuildUnsignedSoapEnvelopeInput) {
    return buildGovernedUnsignedFgisGrainSoapEnvelope(input);
  }

  mapInbound(
    decoded: ReturnType<typeof decodeGovernedFgisGrainSoapEnvelope>,
    context: FgisGrainInboundMappingContext,
  ) {
    return mapDecodedFgisGrainInboundEnvelope(decoded, context);
  }
}
