export type LeakRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type LeakAction = 'allow' | 'mask' | 'block' | 'operator_review' | 'assisted_mode';

export interface AntiLeakFinding {
  type: 'phone' | 'email' | 'external_link' | 'messenger' | 'inn' | 'exact_address' | 'bypass_phrase';
  riskLevel: LeakRiskLevel;
  rawValueMasked: string;
  message: string;
}

export interface AntiLeakResult {
  safeText: string;
  findings: AntiLeakFinding[];
  action: LeakAction;
}

const patterns: { type: AntiLeakFinding['type']; riskLevel: LeakRiskLevel; regex: RegExp; replacement: string }[] = [
  { type: 'phone', riskLevel: 'high', regex: /(?:\+?7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/g, replacement: '[телефон скрыт]' },
  { type: 'email', riskLevel: 'high', regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, replacement: '[email скрыт]' },
  { type: 'external_link', riskLevel: 'medium', regex: /https?:\/\/\S+/gi, replacement: '[ссылка скрыта]' },
  { type: 'messenger', riskLevel: 'high', regex: /(?:telegram|whatsapp|viber|vk|t\.me|wa\.me|@[a-z0-9_]{4,})/gi, replacement: '[внешний канал скрыт]' },
  { type: 'inn', riskLevel: 'medium', regex: /\b\d{10}(?:\d{2})?\b/g, replacement: '[реквизит скрыт]' },
  { type: 'exact_address', riskLevel: 'medium', regex: /(?:ул\.|улица|проспект|пр-т|дом|д\.)\s+[А-ЯA-Z0-9][^,.;]{3,}/gi, replacement: '[адрес скрыт]' },
  { type: 'bypass_phrase', riskLevel: 'critical', regex: /(?:без платформы|скину номер|напиши напрямую|созвонимся напрямую|по старой схеме)/gi, replacement: '[фраза скрыта]' },
];

const priority: Record<LeakAction, number> = { allow: 0, mask: 1, block: 2, operator_review: 3, assisted_mode: 4 };

function actionForRisk(risk: LeakRiskLevel): LeakAction {
  if (risk === 'critical') return 'assisted_mode';
  if (risk === 'high') return 'operator_review';
  if (risk === 'medium') return 'block';
  return 'mask';
}

function maxAction(actions: LeakAction[]): LeakAction {
  return actions.reduce((current, next) => (priority[next] > priority[current] ? next : current), 'allow');
}

function maskRaw(value: string): string {
  if (value.length <= 4) return '***';
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

export function scanMessageForLeaks(text: string): AntiLeakResult {
  let safeText = text;
  const findings: AntiLeakFinding[] = [];
  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern.regex)];
    for (const match of matches) {
      findings.push({
        type: pattern.type,
        riskLevel: pattern.riskLevel,
        rawValueMasked: maskRaw(match[0]),
        message: 'Контактные данные раскрываются после создания управляемой сделки. Продолжите согласование через платформу.',
      });
    }
    safeText = safeText.replace(pattern.regex, pattern.replacement);
  }
  return {
    safeText,
    findings,
    action: maxAction(findings.map((finding) => actionForRisk(finding.riskLevel))),
  };
}
