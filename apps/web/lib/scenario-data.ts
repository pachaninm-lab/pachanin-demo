import { alerts, deals, dispatchRequests, disputes, labSamples, payments, receivingTickets, shipments, supportTickets } from './pilot-data';

export type ScenarioFrame = {
  id: string;
  title: string;
  summary: string;
  linkedDealId: string;
  linkedShipmentId?: string;
  linkedDisputeId?: string;
  objective: string;
  roles: string[];
  criticalModules: string[];
  blockers: string[];
  steps: { at: string; owner: string; action: string; result: string; evidence: string[]; href: string }[];
  expectedOutcome: string;
  pilotValue: string;
};

export const scenarioFrames: ScenarioFrame[] = [
  {
    id: 'SCN-IDEAL-01',
    title: 'Идеальная сделка без спора',
    summary: 'Seller публикует лот, buyer выигрывает, логистика идёт по плану, receiving и lab зелёные, release проходит без ручного вмешательства.',
    linkedDealId: deals[0]?.id || 'DEAL-001',
    linkedShipmentId: shipments[0]?.id,
    objective: 'Показать controlled-pilot happy path от lot до payout за 3–5 минут.',
    roles: ['Фермер', 'Покупатель', 'Логист', 'Водитель', 'Приёмка', 'Лаборатория', 'Бухгалтерия', 'Оператор'],
    criticalModules: ['Lots', 'Auctions', 'Deals', 'Dispatch', 'Logistics', 'Receiving', 'Lab', 'Settlement', 'Payments'],
    blockers: ['Нет signed contract', 'Нет reserve callback', 'Нет final lab protocol'],
    steps: [
      { at: 'T+00', owner: 'Seller', action: 'Выбирает победителя по netback и trust', result: 'Создан dispatch packet', evidence: ['decision log', 'normalized bid sheet'], href: '/auctions' },
      { at: 'T+15m', owner: 'Logistics', action: 'Назначает carrier и 4 машины', result: 'Trip pack отправлен водителям', evidence: ['carrier ranking', 'slot booking'], href: '/dispatch' },
      { at: 'T+2h', owner: 'Driver', action: 'Закрывает loading stop-forms и gross weight', result: 'Shipment IN_TRANSIT', evidence: ['photo set', 'geotag', 'gross/tare'], href: '/logistics' },
      { at: 'T+6h', owner: 'Receiving', action: 'Фиксирует gate-in, pit, net weight', result: 'Receiving dossier готов', evidence: ['scale ticket', 'acceptance note'], href: '/receiving' },
      { at: 'T+8h', owner: 'Lab', action: 'Публикует final protocol', result: 'Quality delta = green', evidence: ['protocol', 'chain of custody'], href: '/lab' },
      { at: 'T+10h', owner: 'Finance', action: 'Собирает worksheet и выпускает release', result: 'Settlement CLOSED', evidence: ['worksheet', 'bank callback'], href: '/payments' }
    ],
    expectedOutcome: 'Сделка закрыта без спора, payout без ручного override, all evidence green.',
    pilotValue: 'Показывает инвестору и клиенту, что продукт закрывает полный цикл сделки, а не только торги.'
  },
  {
    id: 'SCN-RISK-02',
    title: 'Route deviation + support escalation',
    summary: 'Назначенный рейс отклоняется от маршрута. Платформа открывает critical alert, support даёт playbook, логист перепланирует ETA.',
    linkedDealId: deals[1]?.id || deals[0]?.id || 'DEAL-001',
    linkedShipmentId: shipments[1]?.id || shipments[0]?.id,
    objective: 'Показать, что риск не декоративный: есть consequence, playbook и цифровой след.',
    roles: ['Логист', 'Водитель', 'Support', 'Risk', 'Оператор'],
    criticalModules: ['Logistics', 'Support', 'Anti-Fraud', 'Control Center', 'Audit'],
    blockers: ['Нет geotag update', 'Нет комментария причины объезда', 'Нет backup ETA'],
    steps: [
      { at: 'T+00', owner: 'System', action: 'Фиксирует route deviation', result: 'Создан CRITICAL alert', evidence: ['gps ping', 'planned vs actual route'], href: '/anti-fraud' },
      { at: 'T+05m', owner: 'Support', action: 'Открывает ticket и даёт шаблон водителю', result: 'Driver обязан загрузить geo/photo/comment', evidence: ['support log'], href: '/support' },
      { at: 'T+12m', owner: 'Driver', action: 'Подтверждает обход по условиям дороги', result: 'ETA пересчитан', evidence: ['road photo', 'live geotag'], href: '/logistics' },
      { at: 'T+15m', owner: 'Logistics', action: 'Перестраивает выгрузочное окно и уведомляет receiving', result: 'Slot обновлён', evidence: ['appointment update'], href: '/dispatch' },
      { at: 'T+20m', owner: 'Operator', action: 'Закрывает incident', result: 'Audit trail complete', evidence: ['incident resolution'], href: '/audit' }
    ],
    expectedOutcome: 'Маршрутный риск не ломает сделку, а переводится в управляемый incident.',
    pilotValue: 'Это ключевой сценарий доверия для buyer, seller и инвестора.'
  },
  {
    id: 'SCN-DISPUTE-03',
    title: 'Dispute hold по качеству',
    summary: 'Inbound lab даёт отклонение от базиса, buyer оспаривает цену, открывается retest path и partial release.',
    linkedDealId: deals[2]?.id || deals[0]?.id || 'DEAL-001',
    linkedShipmentId: shipments[2]?.id || shipments[0]?.id,
    linkedDisputeId: disputes[0]?.id,
    objective: 'Показать, как система держит спорную часть денег и не останавливает всё исполнение.',
    roles: ['Лаборатория', 'Покупатель', 'Фермер', 'Бухгалтерия', 'Risk', 'Support'],
    criticalModules: ['Lab', 'Disputes', 'Settlement', 'Payments', 'Documents'],
    blockers: ['Нет witness sample', 'Нет retest lab slot', 'Нет decision owner'],
    steps: [
      { at: 'T+00', owner: 'Lab', action: 'Публикует protocol с отрицательным quality delta', result: 'Dispute suggested', evidence: ['protocol', 'method', 'chain'], href: '/lab' },
      { at: 'T+10m', owner: 'Buyer', action: 'Открывает спор и прикладывает counter-argument', result: 'Dispute hold активирован', evidence: ['claim file', 'basis sheet'], href: '/disputes' },
      { at: 'T+20m', owner: 'Finance', action: 'Считает uncontested amount', result: 'Partial release готов', evidence: ['worksheet split'], href: '/payments' },
      { at: 'T+2h', owner: 'Support', action: 'Назначает independent re-test', result: 'Retest path green', evidence: ['retest order'], href: '/support' },
      { at: 'T+6h', owner: 'Risk', action: 'Фиксирует resolution и снимает hold', result: 'Final settlement ready', evidence: ['decision log'], href: '/disputes' }
    ],
    expectedOutcome: 'Оспариваемая часть удержана, неоспариваемая выплачена, precedent сохранён.',
    pilotValue: 'Без этого платформа не воспринимается как реальная операционная система сделки.'
  }
];
