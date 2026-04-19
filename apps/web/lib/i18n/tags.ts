export const GATE_TAGS_RU: Record<string, string> = {
  'dispute · docs': 'Спор + документы',
  'dispute+docs':   'Спор + документы',
  'lab_result':     'Ждём лабораторию',
  'bank_confirm':   'Подтверждение банка',
  'reserve':        'Резерв',
  'docs_missing':   'Не хватает документов',
  'fgis':           'ФГИС',
  'esia':           'ЕСИА',
  'quality':        'Качество',
  'logistics':      'Логистика',
};

export function translateTag(tag: string): string {
  return GATE_TAGS_RU[tag] ?? tag;
}
