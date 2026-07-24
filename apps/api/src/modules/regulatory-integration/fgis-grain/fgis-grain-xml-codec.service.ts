import { Injectable } from '@nestjs/common';
import {
  buildUnsignedFgisGrainSoapEnvelope,
  decodeFgisGrainSoapEnvelope,
  mapDecodedFgisGrainInboundEnvelope,
  type FgisGrainBuildUnsignedSoapEnvelopeInput,
  type FgisGrainInboundMappingContext,
  type FgisGrainSoapDecodeOptions,
} from './fgis-grain-1.0.23.xml-codec';

@Injectable()
export class FgisGrainXmlCodecService {
  decode(
    input: string | Uint8Array,
    options: FgisGrainSoapDecodeOptions = {},
  ) {
    return decodeFgisGrainSoapEnvelope(input, options);
  }

  buildUnsigned(input: FgisGrainBuildUnsignedSoapEnvelopeInput) {
    return buildUnsignedFgisGrainSoapEnvelope(input);
  }

  mapInbound(
    decoded: ReturnType<typeof decodeFgisGrainSoapEnvelope>,
    context: FgisGrainInboundMappingContext,
  ) {
    return mapDecodedFgisGrainInboundEnvelope(decoded, context);
  }
}
