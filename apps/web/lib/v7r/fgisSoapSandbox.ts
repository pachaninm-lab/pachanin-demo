export const FGIS_SOAP_SANDBOX = {
  wsdlVersion: '1.0.23',
  namespace: 'urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/1.0.23',
  transport: 'SOAP 1.1',
  exchangeMethods: ['SendRequest', 'SendResponse', 'Ack'] as const,
  wsdlAddressPlaceholder: 'http://localhost/api/ws/1.0.23',
  note: 'В WSDL адрес заглушечный. Для live нужен внешний endpoint и реальные доступы.',
};

export type FgisSandboxDocumentType =
  | 'RequestCreateSDIZType'
  | 'RequestGetListSDIZType'
  | 'RequestCreateExtinctionType'
  | 'RequestGetListExtinctionType'
  | 'RequestCreateExtinctionRefusalType';

export function buildFgisSoapEnvelope(documentType: FgisSandboxDocumentType, payloadXml: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="${FGIS_SOAP_SANDBOX.namespace}">
  <soapenv:Header />
  <soapenv:Body>
    <ws:SendRequestRequest>
      <ws:MessageData>
        <ws:DocumentType>${documentType}</ws:DocumentType>
        <ws:DocumentPayload>${escapeXml(payloadXml)}</ws:DocumentPayload>
      </ws:MessageData>
    </ws:SendRequestRequest>
  </soapenv:Body>
</soapenv:Envelope>`;
}

export function buildFgisSandboxCreateSdizPayload(params: {
  sellerInn: string;
  buyerInn: string;
  lotId: string;
  volumeTons: number;
  culture: string;
}) {
  return `<RequestCreateSDIZType>
  <SellerINN>${params.sellerInn}</SellerINN>
  <BuyerINN>${params.buyerInn}</BuyerINN>
  <LotId>${params.lotId}</LotId>
  <VolumeTons>${params.volumeTons}</VolumeTons>
  <Culture>${escapeXml(params.culture)}</Culture>
</RequestCreateSDIZType>`;
}

export function buildFgisSandboxExtinctionPayload(params: { sdizNumber: string; acceptanceActId: string }) {
  return `<RequestCreateExtinctionType>
  <SDIZNumber>${params.sdizNumber}</SDIZNumber>
  <AcceptanceActId>${params.acceptanceActId}</AcceptanceActId>
</RequestCreateExtinctionType>`;
}

export function buildFgisSandboxRefusalPayload(params: { sdizNumber: string; reason: string }) {
  return `<RequestCreateExtinctionRefusalType>
  <SDIZNumber>${params.sdizNumber}</SDIZNumber>
  <Reason>${escapeXml(params.reason)}</Reason>
</RequestCreateExtinctionRefusalType>`;
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
