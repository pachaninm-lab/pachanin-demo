export type TransportPackStatus =
  | 'required_not_created'
  | 'created'
  | 'awaiting_signatures'
  | 'partially_signed'
  | 'fully_signed'
  | 'sent_to_gis_epd'
  | 'registered_in_gis_epd'
  | 'completed'
  | 'provider_error'
  | 'manual_review'
  | 'cancelled';

export type TransportDocumentType =
  | 'etrn'
  | 'transport_request'
  | 'transport_order'
  | 'expeditor_order'
  | 'expeditor_receipt'
  | 'warehouse_receipt';

export type TransportDocumentStatus =
  | 'draft'
  | 'generated'
  | 'sent_for_signature'
  | 'partially_signed'
  | 'fully_signed'
  | 'gis_registered'
  | 'completed'
  | 'declined';

export type TransportSignatureStatus = 'requested' | 'signed' | 'failed';
export type TransportSignatureType = 'simple' | 'unep' | 'ukep' | 'provider_managed';
export type LegalRouteClass = 'gis_epd_required' | 'provider_legal_only' | 'adjacent_logistics_doc';
export type MoneyImpactStatus = 'no_impact' | 'blocks_release' | 'partially_blocks_release' | 'release_allowed';

export interface TransportSignature {
  id: string;
  role: 'shipper' | 'carrier' | 'driver' | 'consignee' | 'expeditor' | 'warehouse_operator';
  actor: string;
  signatureType: TransportSignatureType;
  status: TransportSignatureStatus;
  signedAt?: string;
}

export interface TransportDocumentItem {
  id: string;
  type: TransportDocumentType;
  title: string;
  status: TransportDocumentStatus;
  providerDocumentId: string;
  gisStatus?: 'pending' | 'registered' | 'error' | 'not_required';
  externalUrl: string;
  signatures: TransportSignature[];
}

export interface TransportDocumentPack {
  id: string;
  dealId: string;
  shipmentId: string;
  provider: 'SBER_KORUS';
  providerPackId: string;
  legalRouteClass: LegalRouteClass;
  status: TransportPackStatus;
  moneyImpactStatus: MoneyImpactStatus;
  summary: string;
  blockers: string[];
  oneCStatus: 'ready' | 'not_linked' | 'exported';
  driverActionUrl?: string;
  documents: TransportDocumentItem[];
}

export const TRANSPORT_PACKS: TransportDocumentPack[] = [
  {
    id: 'TDP-9102',
    dealId: 'DL-9102',
    shipmentId: 'SHIP-9102',
    provider: 'SBER_KORUS',
    providerPackId: 'SK-PACK-9102',
    legalRouteClass: 'gis_epd_required',
    status: 'partially_signed',
    moneyImpactStatus: 'blocks_release',
    summary: 'ЭТрН и заявка созданы в СберКорус, но пакет не закрыт: не хватает подписи грузополучателя и финального юридического статуса по рейсу.',
    blockers: ['Нет полной цепочки подписей', 'Пакет тормозит финальный release денег'],
    oneCStatus: 'ready',
    driverActionUrl: 'sberkorus://transport/sign/SK-PACK-9102',
    documents: [
      {
        id: 'TD-ETRN-9102',
        type: 'etrn',
        title: 'ЭТрН',
        status: 'partially_signed',
        providerDocumentId: 'SK-DOC-ETRN-9102',
        gisStatus: 'pending',
        externalUrl: '/platform-v7/deals/DL-9102/transport-documents',
        signatures: [
          { id: 'SIG-1', role: 'shipper', actor: 'Агро-Юг ООО', signatureType: 'ukep', status: 'signed', signedAt: '2026-04-03T07:55:00Z' },
          { id: 'SIG-2', role: 'carrier', actor: 'ТрансЛогистик', signatureType: 'ukep', status: 'signed', signedAt: '2026-04-03T08:02:00Z' },
          { id: 'SIG-3', role: 'driver', actor: 'Ковалёв А.С.', signatureType: 'simple', status: 'signed', signedAt: '2026-04-03T08:07:00Z' },
          { id: 'SIG-4', role: 'consignee', actor: 'Агрохолдинг СК', signatureType: 'ukep', status: 'requested' }
        ]
      },
      {
        id: 'TD-REQ-9102',
        type: 'transport_request',
        title: 'Заявка на перевозку',
        status: 'fully_signed',
        providerDocumentId: 'SK-DOC-REQ-9102',
        gisStatus: 'not_required',
        externalUrl: '/platform-v7/deals/DL-9102/transport-documents',
        signatures: [
          { id: 'SIG-5', role: 'shipper', actor: 'Агро-Юг ООО', signatureType: 'ukep', status: 'signed', signedAt: '2026-04-02T12:10:00Z' },
          { id: 'SIG-6', role: 'carrier', actor: 'ТрансЛогистик', signatureType: 'ukep', status: 'signed', signedAt: '2026-04-02T12:18:00Z' }
        ]
      },
      {
        id: 'TD-EXP-9102',
        type: 'expeditor_order',
        title: 'Поручение экспедитору',
        status: 'generated',
        providerDocumentId: 'SK-DOC-EXP-9102',
        gisStatus: 'not_required',
        externalUrl: '/platform-v7/deals/DL-9102/transport-documents',
        signatures: [
          { id: 'SIG-7', role: 'expeditor', actor: 'Экспедитор Черноземья', signatureType: 'ukep', status: 'requested' }
        ]
      }
    ]
  },
  {
    id: 'TDP-9103',
    dealId: 'DL-9103',
    shipmentId: 'SHIP-9103',
    provider: 'SBER_KORUS',
    providerPackId: 'SK-PACK-9103',
    legalRouteClass: 'gis_epd_required',
    status: 'awaiting_signatures',
    moneyImpactStatus: 'partially_blocks_release',
    summary: 'Пакет создан. Водитель и грузополучатель ещё не завершили юридически значимые действия.',
    blockers: ['Ожидается подпись водителя', 'Ожидается подпись грузополучателя'],
    oneCStatus: 'exported',
    driverActionUrl: 'sberkorus://transport/sign/SK-PACK-9103',
    documents: [
      {
        id: 'TD-ETRN-9103',
        type: 'etrn',
        title: 'ЭТрН',
        status: 'sent_for_signature',
        providerDocumentId: 'SK-DOC-ETRN-9103',
        gisStatus: 'pending',
        externalUrl: '/platform-v7/deals/DL-9103/transport-documents',
        signatures: [
          { id: 'SIG-8', role: 'shipper', actor: 'КФХ Петров', signatureType: 'ukep', status: 'signed', signedAt: '2026-04-04T06:45:00Z' },
          { id: 'SIG-9', role: 'carrier', actor: 'Юг Логистик', signatureType: 'ukep', status: 'signed', signedAt: '2026-04-04T06:52:00Z' },
          { id: 'SIG-10', role: 'driver', actor: 'Михайлов И.В.', signatureType: 'simple', status: 'requested' },
          { id: 'SIG-11', role: 'consignee', actor: 'ЗАО МелькомбинатЮг', signatureType: 'ukep', status: 'requested' }
        ]
      },
      {
        id: 'TD-REQ-9103',
        type: 'transport_request',
        title: 'Заявка на перевозку',
        status: 'fully_signed',
        providerDocumentId: 'SK-DOC-REQ-9103',
        gisStatus: 'not_required',
        externalUrl: '/platform-v7/deals/DL-9103/transport-documents',
        signatures: [
          { id: 'SIG-12', role: 'shipper', actor: 'КФХ Петров', signatureType: 'ukep', status: 'signed', signedAt: '2026-04-03T18:10:00Z' },
          { id: 'SIG-13', role: 'carrier', actor: 'Юг Логистик', signatureType: 'ukep', status: 'signed', signedAt: '2026-04-03T18:14:00Z' }
        ]
      }
    ]
  },
  {
    id: 'TDP-9109',
    dealId: 'DL-9109',
    shipmentId: 'SHIP-9109',
    provider: 'SBER_KORUS',
    providerPackId: 'SK-PACK-9109',
    legalRouteClass: 'gis_epd_required',
    status: 'completed',
    moneyImpactStatus: 'release_allowed',
    summary: 'Юридически значимый пакет закрыт. СберКорус подтвердил полный комплект подписей и завершение рейса.',
    blockers: [],
    oneCStatus: 'exported',
    documents: [
      {
        id: 'TD-ETRN-9109',
        type: 'etrn',
        title: 'ЭТрН',
        status: 'completed',
        providerDocumentId: 'SK-DOC-ETRN-9109',
        gisStatus: 'registered',
        externalUrl: '/platform-v7/deals/DL-9109/transport-documents',
        signatures: [
          { id: 'SIG-14', role: 'shipper', actor: 'КФХ Мирный', signatureType: 'ukep', status: 'signed', signedAt: '2026-04-10T07:01:00Z' },
          { id: 'SIG-15', role: 'carrier', actor: 'СеверТранс', signatureType: 'ukep', status: 'signed', signedAt: '2026-04-10T07:10:00Z' },
          { id: 'SIG-16', role: 'driver', actor: 'Рыбаков С.Н.', signatureType: 'simple', status: 'signed', signedAt: '2026-04-10T07:14:00Z' },
          { id: 'SIG-17', role: 'consignee', actor: 'ЗерноТрейд ООО', signatureType: 'ukep', status: 'signed', signedAt: '2026-04-10T12:44:00Z' }
        ]
      },
      {
        id: 'TD-WR-9109',
        type: 'warehouse_receipt',
        title: 'Складская расписка',
        status: 'completed',
        providerDocumentId: 'SK-DOC-WR-9109',
        gisStatus: 'not_required',
        externalUrl: '/platform-v7/deals/DL-9109/transport-documents',
        signatures: [
          { id: 'SIG-18', role: 'warehouse_operator', actor: 'Элеватор Северный', signatureType: 'ukep', status: 'signed', signedAt: '2026-04-10T13:03:00Z' }
        ]
      }
    ]
  },
  {
    id: 'TDP-9116',
    dealId: 'DL-9116',
    shipmentId: 'SHIP-9116',
    provider: 'SBER_KORUS',
    providerPackId: 'SK-PACK-9116',
    legalRouteClass: 'gis_epd_required',
    status: 'manual_review',
    moneyImpactStatus: 'blocks_release',
    summary: 'Пакет документов собран, но оператор перевёл его в ручную проверку из-за несоответствия участника приёмки и юридического получателя.',
    blockers: ['Нужна ручная проверка участника подписи', 'Пока нельзя выпускать деньги'],
    oneCStatus: 'exported',
    documents: [
      {
        id: 'TD-ETRN-9116',
        type: 'etrn',
        title: 'ЭТрН',
        status: 'fully_signed',
        providerDocumentId: 'SK-DOC-ETRN-9116',
        gisStatus: 'pending',
        externalUrl: '/platform-v7/deals/DL-9116/transport-documents',
        signatures: [
          { id: 'SIG-19', role: 'shipper', actor: 'ГК БелгородАгро', signatureType: 'ukep', status: 'signed', signedAt: '2026-04-12T06:10:00Z' },
          { id: 'SIG-20', role: 'carrier', actor: 'БелТранс', signatureType: 'ukep', status: 'signed', signedAt: '2026-04-12T06:19:00Z' },
          { id: 'SIG-21', role: 'driver', actor: 'Воронов А.П.', signatureType: 'simple', status: 'signed', signedAt: '2026-04-12T06:25:00Z' },
          { id: 'SIG-22', role: 'consignee', actor: 'Экспортёр Юг', signatureType: 'ukep', status: 'signed', signedAt: '2026-04-12T15:31:00Z' }
        ]
      }
    ]
  }
];

const TRANSPORT_PACKS_BY_DEAL = Object.fromEntries(TRANSPORT_PACKS.map((pack) => [pack.dealId, pack]));
const TRANSPORT_PACKS_BY_SHIPMENT = Object.fromEntries(TRANSPORT_PACKS.map((pack) => [pack.shipmentId, pack]));

export function getTransportPackByDealId(dealId: string) {
  return TRANSPORT_PACKS_BY_DEAL[dealId] ?? null;
}

export function getTransportPackByShipmentId(shipmentId: string) {
  return TRANSPORT_PACKS_BY_SHIPMENT[shipmentId] ?? null;
}

export function transportPackStatusLabel(status: TransportPackStatus) {
  switch (status) {
    case 'required_not_created': return 'Требуется создать';
    case 'created': return 'Создан';
    case 'awaiting_signatures': return 'Ждём подписи';
    case 'partially_signed': return 'Подписан частично';
    case 'fully_signed': return 'Подписан';
    case 'sent_to_gis_epd': return 'Отправлен в ГИС ЭПД';
    case 'registered_in_gis_epd': return 'Зарегистрирован в ГИС ЭПД';
    case 'completed': return 'Завершён';
    case 'provider_error': return 'Ошибка провайдера';
    case 'manual_review': return 'Ручная проверка';
    case 'cancelled': return 'Отменён';
  }
}

export function transportDocumentStatusLabel(status: TransportDocumentStatus) {
  switch (status) {
    case 'draft': return 'Черновик';
    case 'generated': return 'Сформирован';
    case 'sent_for_signature': return 'Отправлен на подпись';
    case 'partially_signed': return 'Подписан частично';
    case 'fully_signed': return 'Подписан';
    case 'gis_registered': return 'Зарегистрирован';
    case 'completed': return 'Завершён';
    case 'declined': return 'Отклонён';
  }
}

export function moneyImpactLabel(status: MoneyImpactStatus) {
  switch (status) {
    case 'no_impact': return 'На деньги не влияет';
    case 'blocks_release': return 'Блокирует выпуск';
    case 'partially_blocks_release': return 'Частично блокирует';
    case 'release_allowed': return 'Выпуск разрешён';
  }
}

export function legalRouteLabel(route: LegalRouteClass) {
  switch (route) {
    case 'gis_epd_required': return 'Обязательный ЭПД-контур';
    case 'provider_legal_only': return 'Юридический контур провайдера';
    case 'adjacent_logistics_doc': return 'Связанный логистический документ';
  }
}

export function countTransportBlockedPacks() {
  return TRANSPORT_PACKS.filter((pack) => pack.moneyImpactStatus === 'blocks_release').length;
}

export function countTransportAwaitingSignatures() {
  return TRANSPORT_PACKS.filter((pack) => pack.status === 'awaiting_signatures' || pack.status === 'partially_signed').length;
}

export function countTransportCompleted() {
  return TRANSPORT_PACKS.filter((pack) => pack.status === 'completed' || pack.status === 'registered_in_gis_epd').length;
}

export function getTransportHotlist() {
  return TRANSPORT_PACKS.filter((pack) => pack.moneyImpactStatus !== 'release_allowed').map((pack) => ({
    id: pack.id,
    dealId: pack.dealId,
    title: `${pack.dealId} · ${transportPackStatusLabel(pack.status)}`,
    note: pack.summary,
    primaryHref: `/platform-v7/deals/${pack.dealId}/transport-documents`,
    secondaryHref: `/platform-v7/deals/${pack.dealId}`,
    moneyImpactStatus: pack.moneyImpactStatus,
  }));
}
