export const REASON_CODES_RU: Record<string, { title: string; description: string }> = {
  FGIS_GATE_FAIL:            { title: 'ФГИС не подтвердил партию',            description: 'Партия в ФГИС не прошла валидацию по источнику или качеству.' },
  ESIA_LINK_MISSING:         { title: 'Нет связи с ЕСИА',                     description: 'Учётная запись контрагента не связана с ЕСИА.' },
  DOCS_MISSING:              { title: 'Не хватает документов',                description: 'В пакете отсутствуют обязательные документы.' },
  BANK_REVIEW_PENDING:       { title: 'Банк проверяет выпуск',                description: 'Сделка на ручной проверке банка перед выпуском денег.' },
  DISPUTE_OPEN:              { title: 'Открыт спор',                          description: 'По сделке открыт спор — выпуск денег заблокирован.' },
  SYNC_CONFIRM_REQUIRED:     { title: 'Требуется финальная сверка',           description: 'Нужно подтвердить синхронизацию данных перед выпуском.' },
  MOISTURE_DEVIATION:        { title: 'Расхождение по влажности',             description: 'Лабораторная проба показала отклонение влажности от заявленной.' },
  WEIGHT_DEVIATION:          { title: 'Расхождение по весу',                  description: 'Весовое расхождение между отгрузкой и приёмкой.' },
  PROTEIN_DEVIATION:         { title: 'Расхождение по протеину',              description: 'Лабораторный показатель протеина не соответствует спецификации.' },
  ESIA_REAUTH_REQUIRED:      { title: 'Нужна повторная авторизация в ЕСИА',   description: 'Сессия ЕСИА истекла, требуется повторный вход.' },
  SOURCE_REFERENCE_MISMATCH: { title: 'Несоответствие источника партии',      description: 'Референс ФГИС-партии не соответствует данным лота.' },
  DOCS_AWAITING:             { title: 'Ожидание документов',                  description: 'Ждём загрузки документов для продолжения.' },
};

export const STATUSES_RU: Record<string, string> = {
  NEW:         'Новая',
  WAITING:     'Ожидание',
  IN_PROGRESS: 'В работе',
  REVIEW:      'Проверка',
  PASS:        'Допущено',
  FAIL:        'Заблокировано',
  pending:     'Ожидание',
  processing:  'В обработке',
  failed:      'Ошибка',
  done:        'Завершено',
  open:        'Открыт',
  degraded:    'Нестабильно',
  sandbox:     'Песочница',
};

export const GATE_TAGS_RU: Record<string, string> = {
  'dispute · docs': 'Спор + документы',
  'lab_result':     'Ждём лабораторию',
  'bank_confirm':   'Подтверждение банка',
  'reserve':        'Резерв',
};

export const ROLE_NAMES_RU: Record<string, string> = {
  seller:      'Продавец',
  buyer:       'Покупатель',
  operator:    'Оператор',
  lab:         'Лаборатория',
  bank:        'Банк',
  compliance:  'Комплаенс',
  arbitrator:  'Арбитр',
  elevator:    'Элеватор',
  surveyor:    'Сюрвейер',
  logistics:   'Логистика',
  driver:      'Водитель',
  executive:   'Руководитель',
};

export function translateReason(code: string): string {
  return REASON_CODES_RU[code]?.title ?? code;
}

export function translateStatus(code: string): string {
  return STATUSES_RU[code] ?? code;
}

export function translateRole(code: string): string {
  return ROLE_NAMES_RU[code] ?? code;
}

export function translateGateTag(tag: string): string {
  return GATE_TAGS_RU[tag] ?? tag;
}
