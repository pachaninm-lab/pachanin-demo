import { LeakRiskLevel } from './anti-leak-filter';

export interface AttachmentScanInput {
  fileName: string;
  mimeType?: string;
  extractedText?: string;
  hasQrCode?: boolean;
  hasBusinessCardImage?: boolean;
  liveOcrEnabled?: boolean;
}

export interface AttachmentRiskFinding {
  type: 'phone' | 'email' | 'qr_code' | 'external_link' | 'bank_details' | 'address' | 'business_card' | 'manual_review_required';
  riskLevel: LeakRiskLevel;
  description: string;
}

export interface AttachmentScanResult {
  mode: 'live' | 'simulation' | 'manual';
  riskLevel: LeakRiskLevel;
  findings: AttachmentRiskFinding[];
  allowPreview: boolean;
  allowDownload: boolean;
}

const phone = /(?:\+?7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/;
const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const externalLink = /https?:\/\/\S+/i;
const bankDetails = /(?:р\/с|к\/с|бик|расч[её]тный сч[её]т|банк)/i;
const address = /(?:ул\.|улица|проспект|дом|склад|элеватор)\s+[А-ЯA-Z0-9][^,.;]{3,}/i;

const weight: Record<LeakRiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };

function maxRisk(findings: AttachmentRiskFinding[]): LeakRiskLevel {
  return findings.reduce<LeakRiskLevel>((current, finding) => (weight[finding.riskLevel] > weight[current] ? finding.riskLevel : current), 'low');
}

export function scanAttachmentRisk(input: AttachmentScanInput): AttachmentScanResult {
  const text = input.extractedText ?? '';
  const findings: AttachmentRiskFinding[] = [];
  if (phone.test(text)) findings.push({ type: 'phone', riskLevel: 'high', description: 'Вложение содержит телефон.' });
  if (email.test(text)) findings.push({ type: 'email', riskLevel: 'high', description: 'Вложение содержит email.' });
  if (externalLink.test(text)) findings.push({ type: 'external_link', riskLevel: 'medium', description: 'Вложение содержит внешнюю ссылку.' });
  if (bankDetails.test(text)) findings.push({ type: 'bank_details', riskLevel: 'high', description: 'Вложение содержит банковские реквизиты.' });
  if (address.test(text)) findings.push({ type: 'address', riskLevel: 'medium', description: 'Вложение содержит адрес.' });
  if (input.hasQrCode) findings.push({ type: 'qr_code', riskLevel: 'high', description: 'Во вложении найден QR-код.' });
  if (input.hasBusinessCardImage) findings.push({ type: 'business_card', riskLevel: 'high', description: 'Во вложении обнаружен риск визитки или подписи с контактами.' });
  if (!input.liveOcrEnabled && !input.extractedText) findings.push({ type: 'manual_review_required', riskLevel: 'medium', description: 'OCR не подключён: требуется ручная проверка.' });
  const riskLevel = maxRisk(findings);
  return {
    mode: input.liveOcrEnabled ? 'live' : input.extractedText ? 'simulation' : 'manual',
    riskLevel,
    findings,
    allowPreview: riskLevel !== 'critical',
    allowDownload: riskLevel === 'low',
  };
}
