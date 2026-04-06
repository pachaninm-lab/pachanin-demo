import { evaluateDocumentCompletenessV2 } from './document-requirements';

export type CorrectionSeverity = 'INFO' | 'WARN' | 'BLOCK';
export type CorrectionActionType = 'collect' | 'replace' | 'sign' | 'reissue' | 'verify_source' | 'operator_review' | 'retry_sync';

export type DocumentCorrectionAction = {
  code: string;
  type: CorrectionActionType;
  title: string;
  detail: string;
  severity: CorrectionSeverity;
  owner: 'seller' | 'buyer' | 'accounting' | 'operator' | 'lab' | 'logistics' | 'system';
};

export type DocumentCorrectionPlan = {
  scenario: string;
  gateState: string;
  ready: boolean;
  blockers: string[];
  actions: DocumentCorrectionAction[];
  reasonCodes: string[];
};

function actionForBlocker(blocker: string): DocumentCorrectionAction | null {
  const normalized = String(blocker || '').toLowerCase();
  if (normalized.startsWith('missing_')) {
    const type = normalized.replace('missing_', '').toUpperCase();
    return {
      code: blocker,
      type: 'collect',
      title: `Добавить документ ${type}`,
      detail: `Документ ${type} отсутствует. Следующий переход должен быть заблокирован до загрузки или генерации документа.`,
      severity: 'BLOCK',
      owner: type === 'LAB_PROTOCOL' ? 'lab' : type === 'TTN' ? 'logistics' : 'seller'
    };
  }
  if (normalized.startsWith('invalid_')) {
    const type = normalized.replace('invalid_', '').toUpperCase();
    return {
      code: blocker,
      type: 'replace',
      title: `Заменить недействительный документ ${type}`,
      detail: `Документ ${type} находится в статусе draft / disputed / rejected / expired. Нужна перевыписка или подтверждённая замена.`,
      severity: 'BLOCK',
      owner: type === 'LAB_PROTOCOL' ? 'lab' : 'operator'
    };
  }
  if (normalized.startsWith('stale_')) {
    const type = normalized.replace('stale_', '').toUpperCase();
    return {
      code: blocker,
      type: 'reissue',
      title: `Обновить устаревший документ ${type}`,
      detail: `Срок свежести документа ${type} истёк для текущего сценария. Нужна новая версия или подтверждение актуальности.`,
      severity: 'WARN',
      owner: 'operator'
    };
  }
  if (normalized.startsWith('unsigned_')) {
    const type = normalized.replace('unsigned_', '').toUpperCase();
    return {
      code: blocker,
      type: 'sign',
      title: `Подписать документ ${type}`,
      detail: `Документ ${type} не имеет подтверждённой подписи или финального статуса.`,
      severity: 'BLOCK',
      owner: 'accounting'
    };
  }
  if (normalized.startsWith('untrusted_')) {
    const type = normalized.replace('untrusted_', '').toUpperCase();
    return {
      code: blocker,
      type: 'verify_source',
      title: `Проверить источник документа ${type}`,
      detail: `Документ ${type} пришёл из недоверенного источника для этого сценария. Нужен операторский re-check или переотправка из канонического контура.`,
      severity: 'BLOCK',
      owner: 'operator'
    };
  }
  return null;
}

export function buildSdizCorrectionHints(payload: Record<string, unknown>) {
  const fields = [
    { key: 'dealId', label: 'Идентификатор сделки' },
    { key: 'sellerInn', label: 'ИНН продавца' },
    { key: 'buyerInn', label: 'ИНН покупателя' },
    { key: 'culture', label: 'Культура' },
    { key: 'volumeTons', label: 'Объём, т' },
    { key: 'priceRub', label: 'Цена, ₽' },
    { key: 'shipmentDate', label: 'Дата отгрузки' },
    { key: 'documentBasis', label: 'Основание документа' }
  ];
  return fields.map((field) => ({
    key: field.key,
    label: field.label,
    missing: payload[field.key] == null || payload[field.key] === '',
    value: payload[field.key] ?? null
  }));
}

export function evaluateDocumentCorrectionWorkflow(input: {
  scenario?: string | null;
  role?: string | null;
  documents?: any[];
  sdizDraft?: Record<string, unknown>;
}) : DocumentCorrectionPlan {
  const completeness = evaluateDocumentCompletenessV2({
    scenario: input.scenario,
    role: input.role,
    documents: input.documents || []
  });

  const actions = completeness.blockers.map(actionForBlocker).filter(Boolean) as DocumentCorrectionAction[];
  const reasonCodes = [...completeness.blockers];

  if (String(input.scenario || '').toLowerCase().includes('sdiz')) {
    const hints = buildSdizCorrectionHints(input.sdizDraft || {});
    const missingFields = hints.filter((item) => item.missing);
    if (missingFields.length > 0) {
      actions.unshift({
        code: 'sdiz_payload_incomplete',
        type: 'collect',
        title: 'Заполнить обязательные поля СДИЗ',
        detail: `Не заполнены поля: ${missingFields.map((item) => item.label).join(', ')}.`,
        severity: 'BLOCK',
        owner: 'seller'
      });
      reasonCodes.push('sdiz_payload_incomplete');
    }
  }

  if (!completeness.ready && !actions.some((item) => item.type === 'operator_review')) {
    actions.push({
      code: 'document_operator_review',
      type: 'operator_review',
      title: 'Операторский re-check',
      detail: 'После исправления документов нужен повторный контроль комплектности, источника и права на следующий переход.',
      severity: 'WARN',
      owner: 'operator'
    });
  }

  if (!completeness.ready) {
    actions.push({
      code: 'retry_external_sync_after_fix',
      type: 'retry_sync',
      title: 'Повторить внешнюю отправку только после исправления',
      detail: 'Внешний обмен с ЭДО / ФГИС / банком должен стартовать только после зелёного состояния документов.',
      severity: 'INFO',
      owner: 'system'
    });
  }

  return {
    scenario: completeness.scenario,
    gateState: completeness.gateState,
    ready: completeness.ready,
    blockers: completeness.blockers,
    actions,
    reasonCodes: Array.from(new Set(reasonCodes))
  };
}
