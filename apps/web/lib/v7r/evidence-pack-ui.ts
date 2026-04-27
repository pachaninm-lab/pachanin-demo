import type {
  P7EvidenceItem,
  P7EvidencePackIssue,
  P7EvidencePackStatus,
  P7EvidenceSource,
  P7EvidenceTrust,
  P7EvidenceType,
} from '../platform-v7/evidence-pack';
import { buildStableDisputeEvidencePack } from './evidence-pack';

export type P7EvidenceUiTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface P7EvidenceItemUiModel {
  readonly id: string;
  readonly title: string;
  readonly typeLabel: string;
  readonly sourceLabel: string;
  readonly trustLabel: string;
  readonly hashLabel: string;
  readonly actorLabel: string;
  readonly capturedAtLabel: string;
  readonly uploadedAtLabel: string;
  readonly geoLabel: string;
  readonly signatureLabel: string;
  readonly versionLabel: string;
  readonly immutableLabel: string;
  readonly chainLabel: string;
  readonly issueLabels: string[];
}

export interface P7EvidencePackUiModel {
  readonly disputeId: string;
  readonly dealId: string | null;
  readonly statusLabel: string;
  readonly statusTone: P7EvidenceUiTone;
  readonly scoreLabel: string;
  readonly requiredLabel: string;
  readonly totalLabel: string;
  readonly blockers: string[];
  readonly limitations: string[];
  readonly items: P7EvidenceItemUiModel[];
}

const TYPE_LABELS: Record<P7EvidenceType, string> = {
  photo: 'Фото / полевая фиксация',
  pdf: 'PDF-документ',
  video: 'Видео',
  lab_protocol: 'Лабораторный протокол',
  surveyor_act: 'Акт сюрвейера',
  transport_document: 'Транспортный документ',
  bank_event: 'Банковское событие',
  fgis_record: 'ФГИС-запись',
  other: 'Иное доказательство',
};

const SOURCE_LABELS: Record<P7EvidenceSource, string> = {
  seller: 'Продавец',
  buyer: 'Покупатель',
  platform: 'Платформа',
  bank: 'Банк',
  fgis: 'ФГИС',
  sberkorus: 'Провайдер ЭДО',
  lab: 'Лаборатория',
  surveyor: 'Сюрвейер',
};

const TRUST_LABELS: Record<P7EvidenceTrust, string> = {
  self_declared: 'Самозаявлено',
  platform_verified: 'Проверено платформой',
  provider_verified: 'Проверено провайдером',
  signed: 'Pilot signature marker',
};

const STATUS_LABELS: Record<P7EvidencePackStatus, string> = {
  incomplete: 'Неполный пакет',
  ready_for_review: 'Готов к разбору',
  locked: 'Зафиксирован',
};

const LIMITATIONS = [
  'Controlled pilot data layer.',
  'Live file upload не подключён.',
  'Binary payload hashing не подключён.',
  'Квалифицированная электронная подпись не подключена.',
  'Production evidence archive не подключён.',
];

function toneForStatus(status: P7EvidencePackStatus): P7EvidenceUiTone {
  if (status === 'ready_for_review') return 'success';
  if (status === 'locked') return 'neutral';
  return 'danger';
}

function formatIssue(issue: P7EvidencePackIssue): string {
  if (issue.code === 'MISSING_REQUIRED_EVIDENCE') return `Не хватает обязательного evidence: ${issue.target}`;
  if (issue.code === 'HASH_MISSING') return `Нет hash: ${issue.target}`;
  if (issue.code === 'IMMUTABILITY_BROKEN') return `Evidence изменяемый: ${issue.target}`;
  if (issue.code === 'VERSION_INVALID') return `Некорректная версия: ${issue.target}`;
  if (issue.code === 'SIGNATURE_REQUIRED') return `Нет pilot signature marker: ${issue.target}`;
  return `Разорвана chain-of-custody: ${issue.target}`;
}

function formatGeo(item: P7EvidenceItem): string {
  if (!item.geo) return '—';
  const accuracy = item.geo.accuracyM ? `, ±${item.geo.accuracyM} м` : '';
  return `${item.geo.lat.toFixed(3)}, ${item.geo.lon.toFixed(3)}${accuracy}`;
}

function summarizeItem(item: P7EvidenceItem, issues: readonly P7EvidencePackIssue[]): P7EvidenceItemUiModel {
  return {
    id: item.id,
    title: item.title,
    typeLabel: TYPE_LABELS[item.type],
    sourceLabel: SOURCE_LABELS[item.source],
    trustLabel: TRUST_LABELS[item.trust],
    hashLabel: item.hash || '—',
    actorLabel: item.actor,
    capturedAtLabel: item.capturedAt ?? '—',
    uploadedAtLabel: item.uploadedAt,
    geoLabel: formatGeo(item),
    signatureLabel: item.signedBy ?? '—',
    versionLabel: `v${item.version}`,
    immutableLabel: item.immutable ? 'immutable=true' : 'immutable=false',
    chainLabel: item.previousHash ? `previous=${item.previousHash}` : 'root',
    issueLabels: issues.filter((issue) => issue.target === item.id).map(formatIssue),
  };
}

export function buildEvidencePackReadinessUiModel(disputeId: string): P7EvidencePackUiModel {
  const pack = buildStableDisputeEvidencePack(disputeId);
  const readiness = pack.readiness;

  return {
    disputeId,
    dealId: pack.dealId,
    statusLabel: STATUS_LABELS[readiness.status],
    statusTone: toneForStatus(readiness.status),
    scoreLabel: `${readiness.score}%`,
    requiredLabel: `${readiness.requiredReady}/${readiness.requiredTotal} required`,
    totalLabel: `${readiness.total} evidence objects`,
    blockers: readiness.issues.map(formatIssue),
    limitations: LIMITATIONS,
    items: pack.items.map((item) => summarizeItem(item, readiness.issues)),
  };
}
