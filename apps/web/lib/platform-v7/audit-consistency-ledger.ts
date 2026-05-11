export type AuditLedgerContext = 'bank' | 'disputes' | 'control-tower';
export type AuditBoundaryStatus = 'internal' | 'pending_external' | 'requires_bank_event';
export type AuditMoneyImpact = 'none' | 'blocks_release' | 'affects_hold' | 'informs_reserve';

export interface AuditLedgerEntry {
  readonly id: string;
  readonly eventLabel: string;
  readonly actorRole: string;
  readonly entity: string;
  readonly evidenceRef: string;
  readonly moneyImpact: AuditMoneyImpact;
  readonly moneyImpactLabel: string;
  readonly boundaryStatus: AuditBoundaryStatus;
  readonly boundaryStatusLabel: string;
  readonly auditPreviewNote: string;
}

export type AuditLedgerData = {
  readonly title: string;
  readonly pilotDisclaimer: string;
  readonly entries: readonly AuditLedgerEntry[];
};

export const AUDIT_LEDGER_DATA: Record<AuditLedgerContext, AuditLedgerData> = {
  bank: {
    title: 'Аудит-предпросмотр · банковский контур',
    pilotDisclaimer:
      'пилотный контур · аудит-предпросмотр · фактические банковские события не эмитируются',
    entries: [
      {
        id: 'AL-B-001',
        eventLabel: 'резерв сформирован',
        actorRole: 'покупатель',
        entity: 'DL-9106',
        evidenceRef: 'банковский запрос резерва',
        moneyImpact: 'informs_reserve',
        moneyImpactLabel: 'резерв 9,65 млн ₽ зафиксирован как готовность денег',
        boundaryStatus: 'requires_bank_event',
        boundaryStatusLabel: 'требует банковского события для активации',
        auditPreviewNote: 'аудит-предпросмотр: банк ещё не подтвердил резерв в live-контуре',
      },
      {
        id: 'AL-B-002',
        eventLabel: 'СДИЗ не подтверждён',
        actorRole: 'ФГИС «Зерно»',
        entity: 'DL-9106 / СДИЗ',
        evidenceRef: 'статус ФГИС «Зерно»',
        moneyImpact: 'blocks_release',
        moneyImpactLabel: 'блокирует выпуск — 9,65 млн ₽ не могут быть освобождены',
        boundaryStatus: 'pending_external',
        boundaryStatusLabel: 'ожидает внешнего события ФГИС «Зерно»',
        auditPreviewNote: 'аудит-предпросмотр: ручная проверка статуса СДИЗ обязательна до банковского шага',
      },
      {
        id: 'AL-B-003',
        eventLabel: 'удержание активно',
        actorRole: 'оператор',
        entity: 'DL-9102',
        evidenceRef: 'акт расхождения DSP-9102-WEIGHT',
        moneyImpact: 'affects_hold',
        moneyImpactLabel: 'удержание 624 тыс. ₽ — не снимается без решения',
        boundaryStatus: 'internal',
        boundaryStatusLabel: 'внутренний пилотный контур — решение оператора',
        auditPreviewNote: 'аудит-предпросмотр: удержание зафиксировано в журнале до закрытия спора',
      },
    ],
  },
  disputes: {
    title: 'Аудит-предпросмотр · контур споров',
    pilotDisclaimer:
      'пилотный контур · аудит-предпросмотр · фактические изменения удержания — только после решения оператора',
    entries: [
      {
        id: 'AL-D-001',
        eventLabel: 'спор открыт',
        actorRole: 'оператор',
        entity: 'DSP-9102-WEIGHT',
        evidenceRef: 'весовая ведомость · акт расхождения · фото приёмки',
        moneyImpact: 'affects_hold',
        moneyImpactLabel: 'удержание 624 тыс. ₽ — основание: отклонение веса',
        boundaryStatus: 'internal',
        boundaryStatusLabel: 'внутренний контур — решение ожидается от оператора',
        auditPreviewNote: 'аудит-предпросмотр: спор зафиксирован, удержание активно до закрытия',
      },
      {
        id: 'AL-D-002',
        eventLabel: 'протокол качества ожидается',
        actorRole: 'лаборатория',
        entity: 'DSP-9106-QUALITY',
        evidenceRef: 'проба · показатели качества · акт приёмки',
        moneyImpact: 'blocks_release',
        moneyImpactLabel: 'блокирует выплату 9,65 млн ₽ до получения протокола',
        boundaryStatus: 'pending_external',
        boundaryStatusLabel: 'ожидает внешнего события лаборатории ФГБУ ЦОК АПК',
        auditPreviewNote: 'аудит-предпросмотр: выплата не передаётся на банковскую проверку до протокола',
      },
      {
        id: 'AL-D-003',
        eventLabel: 'рекомендация передана оператору',
        actorRole: 'споры → оператор',
        entity: 'DSP-9102-WEIGHT',
        evidenceRef: 'журнал сделки · акт расхождения',
        moneyImpact: 'affects_hold',
        moneyImpactLabel: 'спорная сумма 624 тыс. ₽ ожидает решения по удержанию',
        boundaryStatus: 'internal',
        boundaryStatusLabel: 'ручная проверка оснований — оператор',
        auditPreviewNote: 'аудит-предпросмотр: решение ещё не зафиксировано в системе',
      },
    ],
  },
  'control-tower': {
    title: 'Аудит-предпросмотр · центр управления',
    pilotDisclaimer:
      'пилотный контур · аудит-предпросмотр · журнал отражает намерения и блокеры, не фактические движения денег',
    entries: [
      {
        id: 'AL-CT-001',
        eventLabel: 'деньги остановлены',
        actorRole: 'банк / оператор',
        entity: 'DL-9106',
        evidenceRef: 'СДИЗ · ЭТрН · протокол качества',
        moneyImpact: 'blocks_release',
        moneyImpactLabel: 'блокирует выпуск 9,65 млн ₽ — все три документа не закрыты',
        boundaryStatus: 'requires_bank_event',
        boundaryStatusLabel: 'требует банковского события после закрытия документов',
        auditPreviewNote: 'аудит-предпросмотр: выпуск денег не возможен до устранения всех блокеров',
      },
      {
        id: 'AL-CT-002',
        eventLabel: 'спор блокирует сделку',
        actorRole: 'оператор',
        entity: 'DL-9102',
        evidenceRef: 'акт расхождения DSP-9102-WEIGHT',
        moneyImpact: 'affects_hold',
        moneyImpactLabel: 'удержание 624 тыс. ₽ — требует ручного решения',
        boundaryStatus: 'internal',
        boundaryStatusLabel: 'внутренний контур — ожидает решения оператора',
        auditPreviewNote: 'аудит-предпросмотр: удержание активно — сделка не закрыта',
      },
      {
        id: 'AL-CT-003',
        eventLabel: 'ручная проверка банка инициирована',
        actorRole: 'банк',
        entity: 'DL-9106',
        evidenceRef: 'запрос резерва покупателя',
        moneyImpact: 'informs_reserve',
        moneyImpactLabel: 'резерв 9,65 млн ₽ ожидает банковского подтверждения',
        boundaryStatus: 'requires_bank_event',
        boundaryStatusLabel: 'требует банковского события для продолжения',
        auditPreviewNote: 'аудит-предпросмотр: пилотный контур не генерирует банковское событие автоматически',
      },
    ],
  },
};

export function getAuditLedger(context: AuditLedgerContext): AuditLedgerData {
  return AUDIT_LEDGER_DATA[context];
}

export function getEntriesBlockingRelease(context: AuditLedgerContext): readonly AuditLedgerEntry[] {
  return AUDIT_LEDGER_DATA[context].entries.filter((e) => e.moneyImpact === 'blocks_release');
}

export const BOUNDARY_STATUS_ICONS: Record<AuditBoundaryStatus, string> = {
  internal: '●',
  pending_external: '◐',
  requires_bank_event: '○',
};
