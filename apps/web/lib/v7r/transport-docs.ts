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
export type TransportSimulationReleaseState = 'blocked' | 'review' | 'allowed';

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

export interface TransportSimulationStep {
  id: string;
  label: string;
  owner: string;
  event: string;
  detail: string;
  releaseState: TransportSimulationReleaseState;
  releaseReason: string;
}

export interface TransportSimulationWebhook {
  id: string;
  visibleFromStep: number;
  direction: 'outbound' | 'inbound';
  topic: string;
  endpoint: string;
  summary: string;
  status: 'ok' | 'pending' | 'error';
}

export interface TransportSimulationAction {
  id: string;
  visibleFromStep: number;
  role: string;
  title: string;
  note: string;
}

export interface TransportSimulationAudit {
  id: string;
  visibleFromStep: number;
  ts: string;
  actor: string;
  action: string;
  detail: string;
  tone: 'success' | 'info' | 'danger';
}

export interface TransportSimulationScenario {
  dealId: string;
  headline: string;
  objective: string;
  currentStepIndex: number;
  steps: TransportSimulationStep[];
  webhooks: TransportSimulationWebhook[];
  actions: TransportSimulationAction[];
  audit: TransportSimulationAudit[];
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
    blockers: ['Нет полной цепочки подписей', 'Пакет тормозит финальный выпуск денег'],
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

const TRANSPORT_SIMULATION: Record<string, TransportSimulationScenario> = {
  'DL-9102': {
    dealId: 'DL-9102',
    headline: 'Неполный пакет подписей блокирует выпуск денег',
    objective: 'Довести ЭТрН и сопроводительные документы до юридически завершённого состояния и снять блокировку финального выпуска.',
    currentStepIndex: 2,
    steps: [
      {
        id: 'prepare',
        label: 'Создан пакет в СберКорус',
        owner: 'Оператор',
        event: 'Пакет SK-PACK-9102 отправлен в провайдер',
        detail: 'Платформа собрала ЭТрН, заявку на перевозку и поручение экспедитору, выгрузила реквизиты сделки и рейса.',
        releaseState: 'blocked',
        releaseReason: 'До юридически значимого пакета выпуск денег запрещён.',
      },
      {
        id: 'shipper',
        label: 'Грузоотправитель и перевозчик подписали',
        owner: 'Продавец / перевозчик',
        event: 'УКЭП по ЭТрН и заявке подтверждены',
        detail: 'Участники закрепили согласованность рейса, но контур ещё ждёт подтверждения водителя и получателя.',
        releaseState: 'blocked',
        releaseReason: 'Не хватает полной цепочки подписей по рейсу.',
      },
      {
        id: 'driver',
        label: 'Водитель подписал выезд',
        owner: 'Водитель',
        event: 'ПЭП водителя зафиксирована в провайдере',
        detail: 'С этого момента рейс выглядит живым, но без подписи получателя и регистрации в ГИС ЭПД деньги не двигаются.',
        releaseState: 'review',
        releaseReason: 'Банк видит прогресс, но релиз пока только под ручной контроль.',
      },
      {
        id: 'consignee',
        label: 'Грузополучатель подтвердил приёмку',
        owner: 'Покупатель / элеватор',
        event: 'Подпись получателя закрывает ЭТрН',
        detail: 'После подписи получателя провайдер переводит пакет в готовность к финальной юридической регистрации.',
        releaseState: 'review',
        releaseReason: 'Нужна регистрация и обратный webhook от провайдера.',
      },
      {
        id: 'gis',
        label: 'СберКорус подтвердил регистрацию',
        owner: 'Провайдер',
        event: 'Провайдер вернул webhook о завершении пакета',
        detail: 'Только после этого платформа может снять транспортный блокер и передать банку сигнал на выпуск.',
        releaseState: 'allowed',
        releaseReason: 'Транспортный контур больше не держит деньги.',
      },
    ],
    webhooks: [
      { id: 'WH-9102-1', visibleFromStep: 0, direction: 'outbound', topic: 'pack.create', endpoint: '/mock/sberkorus/transport', summary: 'Платформа создала пакет SK-PACK-9102', status: 'ok' },
      { id: 'WH-9102-2', visibleFromStep: 1, direction: 'inbound', topic: 'signature.shipper.confirmed', endpoint: '/api/mock/sberkorus/webhook', summary: 'Подтверждены подписи продавца и перевозчика', status: 'ok' },
      { id: 'WH-9102-3', visibleFromStep: 2, direction: 'inbound', topic: 'signature.driver.confirmed', endpoint: '/api/mock/sberkorus/webhook', summary: 'Водитель подписал выезд', status: 'ok' },
      { id: 'WH-9102-4', visibleFromStep: 4, direction: 'inbound', topic: 'pack.completed', endpoint: '/api/mock/sberkorus/webhook', summary: 'Пакет завершён, можно снять блокировку выпуска', status: 'pending' },
    ],
    actions: [
      { id: 'ACT-9102-1', visibleFromStep: 0, role: 'Оператор', title: 'Проверить пакет и отправить ссылку водителю', note: 'Контроль создания и первичной рассылки.' },
      { id: 'ACT-9102-2', visibleFromStep: 2, role: 'Грузополучатель', title: 'Подписать приёмку в СберКорус', note: 'Без этого пакет не закрывается.' },
      { id: 'ACT-9102-3', visibleFromStep: 4, role: 'Банк', title: 'Снять транспортный стоп и продолжить выпуск', note: 'Деньги можно двигать только после подтверждения провайдера.' },
    ],
    audit: [
      { id: 'AUD-9102-1', visibleFromStep: 0, ts: '2026-04-03T07:42:00Z', actor: 'Система', action: 'Пакет создан', detail: 'SK-PACK-9102 ушёл в СберКорус', tone: 'success' },
      { id: 'AUD-9102-2', visibleFromStep: 1, ts: '2026-04-03T08:02:00Z', actor: 'ТрансЛогистик', action: 'Подпись перевозчика', detail: 'УКЭП подтверждена', tone: 'success' },
      { id: 'AUD-9102-3', visibleFromStep: 2, ts: '2026-04-03T08:07:00Z', actor: 'Ковалёв А.С.', action: 'Подпись водителя', detail: 'ПЭП по выезду зафиксирована', tone: 'info' },
      { id: 'AUD-9102-4', visibleFromStep: 3, ts: '2026-04-03T11:41:00Z', actor: 'Оператор', action: 'Эскалация получателю', detail: 'Без подписи получателя банк не пойдёт дальше', tone: 'danger' },
    ],
  },
  'DL-9103': {
    dealId: 'DL-9103',
    headline: 'Рейс живой, но пакет ждёт финальные подписи',
    objective: 'Показать, как платформа ведёт оператора от отправки пакета до регистрации документов и частичного снятия ограничений.',
    currentStepIndex: 1,
    steps: [
      {
        id: 'create',
        label: 'Сформирован транспортный пакет',
        owner: 'Оператор',
        event: 'Пакет выгружен в СберКорус',
        detail: 'Сделка связана с рейсом и документы отправлены провайдеру.',
        releaseState: 'blocked',
        releaseReason: 'Транспортный контур ещё не доказал прохождение рейса.',
      },
      {
        id: 'shipper',
        label: 'Подписали отправитель и перевозчик',
        owner: 'Продавец / перевозчик',
        event: 'Документы подтверждены на старте',
        detail: 'Контур готов к водительскому действию и переходу в активный рейс.',
        releaseState: 'review',
        releaseReason: 'Дальше нужен водитель и подтверждение получателя.',
      },
      {
        id: 'driver',
        label: 'Водитель подтвердил рейс',
        owner: 'Водитель',
        event: 'ПЭП водителя принята',
        detail: 'Сделка получает доказательство фактического движения груза.',
        releaseState: 'review',
        releaseReason: 'До подписи получателя деньги только под частичный контроль.',
      },
      {
        id: 'consignee',
        label: 'Получатель подписал закрытие рейса',
        owner: 'Покупатель',
        event: 'Приёмка закрыта в СберКорус',
        detail: 'Пакет можно переводить в завершённый контур и докладывать банку.',
        releaseState: 'allowed',
        releaseReason: 'Транспортный риск снижен до приемлемого.',
      },
    ],
    webhooks: [
      { id: 'WH-9103-1', visibleFromStep: 0, direction: 'outbound', topic: 'pack.create', endpoint: '/mock/sberkorus/transport', summary: 'Создан пакет SK-PACK-9103', status: 'ok' },
      { id: 'WH-9103-2', visibleFromStep: 1, direction: 'inbound', topic: 'signature.carrier.confirmed', endpoint: '/api/mock/sberkorus/webhook', summary: 'Перевозчик и отправитель уже подписали старт рейса', status: 'ok' },
      { id: 'WH-9103-3', visibleFromStep: 2, direction: 'inbound', topic: 'signature.driver.confirmed', endpoint: '/api/mock/sberkorus/webhook', summary: 'Водитель подтвердил рейс', status: 'pending' },
    ],
    actions: [
      { id: 'ACT-9103-1', visibleFromStep: 1, role: 'Водитель', title: 'Подтвердить начало рейса', note: 'Основное живое действие на мобильном контуре.' },
      { id: 'ACT-9103-2', visibleFromStep: 2, role: 'Получатель', title: 'Подписать завершение ЭТрН', note: 'Без этого контур не закрывается.' },
      { id: 'ACT-9103-3', visibleFromStep: 3, role: 'Банк', title: 'Пересчитать доступную к выпуску сумму', note: 'Транспортный риск снижается после закрытия рейса.' },
    ],
    audit: [
      { id: 'AUD-9103-1', visibleFromStep: 0, ts: '2026-04-04T06:30:00Z', actor: 'Система', action: 'Пакет создан', detail: 'SK-PACK-9103 зарегистрирован в провайдере', tone: 'success' },
      { id: 'AUD-9103-2', visibleFromStep: 1, ts: '2026-04-04T06:52:00Z', actor: 'Юг Логистик', action: 'Стартовые подписи', detail: 'Перевозчик и отправитель подтверждены', tone: 'success' },
      { id: 'AUD-9103-3', visibleFromStep: 2, ts: '2026-04-04T07:14:00Z', actor: 'Михайлов И.В.', action: 'Ожидается действие', detail: 'Платформа напоминает водителю о подписи', tone: 'info' },
    ],
  },
  'DL-9109': {
    dealId: 'DL-9109',
    headline: 'Идеальный сценарий: пакет закрыт и деньги готовы к выпуску',
    objective: 'Показать эталонный путь, где СберКорус уже убрал транспортный блокер и банк может принять решение о выпуске.',
    currentStepIndex: 3,
    steps: [
      {
        id: 'create',
        label: 'Пакет создан',
        owner: 'Оператор',
        event: 'Рейс заведен в СберКорус',
        detail: 'Платформа связала сделку, перевозчика и получателя.',
        releaseState: 'blocked',
        releaseReason: 'Нет завершённого документного следа.',
      },
      {
        id: 'signatures',
        label: 'Все стороны подписали рейс',
        owner: 'Участники рейса',
        event: 'Провайдер собрал цепочку подписей',
        detail: 'Сделка получила полный юридический след по движению партии.',
        releaseState: 'review',
        releaseReason: 'Нужна регистрация и финальный callback.',
      },
      {
        id: 'register',
        label: 'СберКорус завершил пакет',
        owner: 'Провайдер',
        event: 'Пакет закрыт и зарегистрирован',
        detail: 'С этого момента транспортные документы больше не блокируют деньги.',
        releaseState: 'allowed',
        releaseReason: 'Транспортная часть полностью подтверждена.',
      },
      {
        id: 'bank',
        label: 'Банк готов к выпуску',
        owner: 'Банк',
        event: 'Банк видит зелёный статус транспортного контура',
        detail: 'Это финальная демонстрация стыка между провайдером перевозочных документов и денежным контуром.',
        releaseState: 'allowed',
        releaseReason: 'Контур перевозки закрыт, можно продолжать выпуск.',
      },
    ],
    webhooks: [
      { id: 'WH-9109-1', visibleFromStep: 0, direction: 'outbound', topic: 'pack.create', endpoint: '/mock/sberkorus/transport', summary: 'Пакет SK-PACK-9109 создан', status: 'ok' },
      { id: 'WH-9109-2', visibleFromStep: 1, direction: 'inbound', topic: 'signature.completed', endpoint: '/api/mock/sberkorus/webhook', summary: 'Цепочка подписей собрана', status: 'ok' },
      { id: 'WH-9109-3', visibleFromStep: 2, direction: 'inbound', topic: 'pack.completed', endpoint: '/api/mock/sberkorus/webhook', summary: 'Провайдер сообщил о завершении пакета', status: 'ok' },
      { id: 'WH-9109-4', visibleFromStep: 3, direction: 'outbound', topic: 'bank.release.ready', endpoint: '/mock/bank/release', summary: 'Платформа отправила зелёный сигнал в банковый контур', status: 'ok' },
    ],
    actions: [
      { id: 'ACT-9109-1', visibleFromStep: 0, role: 'Оператор', title: 'Проверить состав пакета', note: 'Фиксация контрольного набора документов.' },
      { id: 'ACT-9109-2', visibleFromStep: 2, role: 'Банк', title: 'Проверить зелёный статус transport gate', note: 'После этого остаются только денежные проверки.' },
      { id: 'ACT-9109-3', visibleFromStep: 3, role: 'Оператор', title: 'Передать кейс на выпуск денег', note: 'Транспортный контур уже не спорит с банком.' },
    ],
    audit: [
      { id: 'AUD-9109-1', visibleFromStep: 0, ts: '2026-04-10T06:48:00Z', actor: 'Система', action: 'Создан пакет', detail: 'SK-PACK-9109 ушёл в СберКорус', tone: 'success' },
      { id: 'AUD-9109-2', visibleFromStep: 1, ts: '2026-04-10T12:44:00Z', actor: 'ЗерноТрейд ООО', action: 'Подписана приёмка', detail: 'Получатель подтвердил закрытие рейса', tone: 'success' },
      { id: 'AUD-9109-3', visibleFromStep: 2, ts: '2026-04-10T13:12:00Z', actor: 'СберКорус', action: 'Пакет завершён', detail: 'Провайдер прислал финальный callback', tone: 'success' },
      { id: 'AUD-9109-4', visibleFromStep: 3, ts: '2026-04-10T13:15:00Z', actor: 'Банк', action: 'Transport gate зелёный', detail: 'Денежный выпуск больше не удерживается перевозочными документами', tone: 'info' },
    ],
  },
  'DL-9116': {
    dealId: 'DL-9116',
    headline: 'Ручная проверка провайдера держит деньги на стопе',
    objective: 'Показать жёсткий кейс, где пакет собран, но правовой конфликт по подписанту не даёт банку двигаться дальше.',
    currentStepIndex: 2,
    steps: [
      {
        id: 'create',
        label: 'Пакет создан и подписан',
        owner: 'Участники рейса',
        event: 'Собраны подписи по ЭТрН',
        detail: 'По форме пакет выглядит почти готовым.',
        releaseState: 'review',
        releaseReason: 'Нужна автоматическая сверка участников и ролей.',
      },
      {
        id: 'check',
        label: 'СберКорус нашёл расхождение по подписанту',
        owner: 'Провайдер',
        event: 'Контур переведён в ручную проверку',
        detail: 'Подписант приёмки не совпал с юридическим получателем в связке сделки.',
        releaseState: 'blocked',
        releaseReason: 'При правовом конфликте выпуск денег нельзя разрешить автоматически.',
      },
      {
        id: 'operator',
        label: 'Оператор собирает доказательства',
        owner: 'Оператор',
        event: 'Проверка доверенности и роли участника',
        detail: 'Платформа показывает, что нужна ручная развязка по документам и ролям.',
        releaseState: 'blocked',
        releaseReason: 'Пока спор по подписанту открыт, транспортный стоп остаётся красным.',
      },
      {
        id: 'resolve',
        label: 'Проверка снята',
        owner: 'Провайдер / комплаенс',
        event: 'Согласована замена подписанта или подтверждена доверенность',
        detail: 'После этого пакет можно перевести в завершённый статус и вернуть зелёный сигнал банку.',
        releaseState: 'allowed',
        releaseReason: 'После снятия ручной проверки транспортный контур снова становится допустимым.',
      },
    ],
    webhooks: [
      { id: 'WH-9116-1', visibleFromStep: 0, direction: 'outbound', topic: 'pack.create', endpoint: '/mock/sberkorus/transport', summary: 'Создан пакет SK-PACK-9116', status: 'ok' },
      { id: 'WH-9116-2', visibleFromStep: 1, direction: 'inbound', topic: 'manual.review.opened', endpoint: '/api/mock/sberkorus/webhook', summary: 'Провайдер открыл ручную проверку по подписанту', status: 'error' },
      { id: 'WH-9116-3', visibleFromStep: 3, direction: 'inbound', topic: 'manual.review.closed', endpoint: '/api/mock/sberkorus/webhook', summary: 'Ручная проверка завершена, пакет можно закрывать', status: 'pending' },
    ],
    actions: [
      { id: 'ACT-9116-1', visibleFromStep: 1, role: 'Оператор', title: 'Проверить основания подписи получателя', note: 'Нужно подтвердить доверенность или корректность роли.' },
      { id: 'ACT-9116-2', visibleFromStep: 2, role: 'Комплаенс', title: 'Согласовать решение по ручной проверке', note: 'Без этого транспортный контур будет красным.' },
      { id: 'ACT-9116-3', visibleFromStep: 3, role: 'Банк', title: 'Снять красный стоп транспортного контура', note: 'Только после финального webhook от провайдера.' },
    ],
    audit: [
      { id: 'AUD-9116-1', visibleFromStep: 0, ts: '2026-04-12T15:31:00Z', actor: 'Экспортёр Юг', action: 'Подпись получателя', detail: 'ЭТрН формально собран', tone: 'success' },
      { id: 'AUD-9116-2', visibleFromStep: 1, ts: '2026-04-12T15:48:00Z', actor: 'СберКорус', action: 'Ручная проверка', detail: 'Юридический получатель не совпал с подписантом', tone: 'danger' },
      { id: 'AUD-9116-3', visibleFromStep: 2, ts: '2026-04-12T16:03:00Z', actor: 'Оператор', action: 'Запрошены основания подписи', detail: 'Сделка ждёт подтверждение доверенности', tone: 'info' },
    ],
  },
};

const TRANSPORT_PACKS_BY_DEAL = Object.fromEntries(TRANSPORT_PACKS.map((pack) => [pack.dealId, pack]));
const TRANSPORT_PACKS_BY_SHIPMENT = Object.fromEntries(TRANSPORT_PACKS.map((pack) => [pack.shipmentId, pack]));

export function getTransportPackByDealId(dealId: string) {
  return TRANSPORT_PACKS_BY_DEAL[dealId] ?? null;
}

export function getTransportPackByShipmentId(shipmentId: string) {
  return TRANSPORT_PACKS_BY_SHIPMENT[shipmentId] ?? null;
}

export function getTransportSimulationScenario(dealId: string) {
  return TRANSPORT_SIMULATION[dealId] ?? null;
}

export function getTransportProviderLabel() {
  return 'СберКорус';
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

export function transportReleaseStateLabel(state: TransportSimulationReleaseState) {
  switch (state) {
    case 'blocked': return 'Выпуск заблокирован';
    case 'review': return 'Нужна проверка';
    case 'allowed': return 'Выпуск разрешён';
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
    simulationHref: `/platform-v7/deals/${pack.dealId}/transport-documents/simulation`,
    moneyImpactStatus: pack.moneyImpactStatus,
    providerLabel: getTransportProviderLabel(),
  }));
}
