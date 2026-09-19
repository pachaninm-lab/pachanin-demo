export type DocumentRequirementRule = {
  scenario: string;
  required: string[];
  optional?: string[];
  blockBefore?: string[];
  roleMandatory?: Record<string, string[]>;
  trustedSources?: string[];
  freshnessHours?: number;
};

export const DOCUMENT_REQUIREMENT_RULES: DocumentRequirementRule[] = [
  {
    scenario: 'deal_docs',
    required: ['CONTRACT', 'TTN', 'WEIGH_TICKET'],
    optional: ['PHOTO_EVIDENCE'],
    blockBefore: ['payment_release'],
    roleMandatory: { ACCOUNTING: ['UPD'], SUPPORT_MANAGER: ['PHOTO_EVIDENCE'] },
    trustedSources: ['edo', 'postgres', 'operator_override'],
    freshnessHours: 168
  },
  {
    scenario: 'hold_release',
    required: ['CONTRACT', 'TTN', 'WEIGH_TICKET', 'LAB_PROTOCOL'],
    optional: ['SDIZ'],
    blockBefore: ['payment_release', 'final_settlement'],
    roleMandatory: { ACCOUNTING: ['PAYMENT_ORDER', 'UPD'], BUYER: ['ACCEPTANCE_ACT'], ELEVATOR: ['WEIGH_TICKET'] },
    trustedSources: ['edo', 'bank', 'lab', 'postgres', 'operator_override'],
    freshnessHours: 72
  },
  {
    scenario: 'dispute_resolution',
    required: ['WEIGH_TICKET', 'LAB_PROTOCOL', 'PHOTO_EVIDENCE'],
    optional: ['TTN'],
    blockBefore: ['dispute_close', 'payment_release'],
    roleMandatory: { SUPPORT_MANAGER: ['DISPUTE_PROTOCOL'], LAB: ['RETEST_PROTOCOL'] },
    trustedSources: ['lab', 'postgres', 'operator_override'],
    freshnessHours: 720
  },
  {
    scenario: 'mobile_offline_replay',
    required: ['TTN', 'PHOTO_EVIDENCE'],
    optional: ['WEIGH_TICKET'],
    blockBefore: ['shipment_departure', 'receiving'],
    roleMandatory: { DRIVER: ['GPS_TRACE'], LOGISTICIAN: ['SEAL_PHOTO'] },
    trustedSources: ['gps', 'postgres', 'device_queue'],
    freshnessHours: 24
  },
  {
    scenario: 'ntb_bridge',
    required: ['CONTRACT', 'TTN', 'WEIGH_TICKET', 'LAB_PROTOCOL', 'SDIZ'],
    optional: ['PHOTO_EVIDENCE'],
    blockBefore: ['ntb_export'],
    roleMandatory: { EXPORTER: ['QUALITY_PASSPORT'], ACCOUNTING: ['UPD'] },
    trustedSources: ['edo', 'fgis_zerno', 'lab', 'postgres'],
    freshnessHours: 48
  }
];

function normalize(value?: string | null) {
  return String(value || '').trim().toUpperCase().replace(/[-\s]+/g, '_');
}

function resolveDocStatus(doc: any) {
  return normalize(doc?.status || (doc?.uploadedAt ? 'SIGNED' : 'MISSING'));
}

function ageHours(doc: any) {
  const source = doc?.signedAt || doc?.uploadedAt || doc?.createdAt || null;
  if (!source) return null;
  const ts = new Date(source).getTime();
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.round((Date.now() - ts) / 3600000));
}

function isTrustedSource(doc: any, trustedSources: string[]) {
  const source = normalize(doc?.sourceOfTruth || doc?.providerMode || doc?.source);
  if (!source) return false;
  return trustedSources.map(normalize).includes(source);
}

export function evaluateDocumentCompletenessV2(input: {
  scenario?: string | null;
  documents?: any[];
  requiredOverride?: string[];
  role?: string | null;
}) {
  const scenario = String(input.scenario || 'deal_docs').trim().toLowerCase();
  const documents = Array.isArray(input.documents) ? input.documents : [];
  const role = normalize(input.role);
  const rule = DOCUMENT_REQUIREMENT_RULES.find((item) => item.scenario === scenario) || DOCUMENT_REQUIREMENT_RULES[0];
  const roleRequired = role ? (rule.roleMandatory?.[role] || []) : [];
  const required = Array.from(new Set([...(input.requiredOverride || rule.required), ...roleRequired].map(normalize)));
  const presentMap = new Map<string, any>();
  for (const doc of documents) {
    const type = normalize(doc?.type);
    if (!type) continue;
    const prev = presentMap.get(type);
    if (!prev) {
      presentMap.set(type, doc);
      continue;
    }
    const prevPriority = ['SIGNED', 'FINAL', 'VERIFIED'].includes(resolveDocStatus(prev)) ? 2 : 1;
    const curPriority = ['SIGNED', 'FINAL', 'VERIFIED'].includes(resolveDocStatus(doc)) ? 2 : 1;
    if (curPriority >= prevPriority) presentMap.set(type, doc);
  }
  const missing = required.filter((type) => !presentMap.has(type));
  const invalid = required.filter((type) => {
    const doc = presentMap.get(type);
    if (!doc) return false;
    return ['MISSING', 'EXPIRED', 'DISPUTED', 'REJECTED', 'DRAFT'].includes(resolveDocStatus(doc));
  });
  const stale = required.filter((type) => {
    const doc = presentMap.get(type);
    if (!doc) return false;
    if (doc?.overdue) return true;
    const hours = ageHours(doc);
    return hours !== null && Boolean(rule.freshnessHours) && hours > Number(rule.freshnessHours);
  });
  const untrusted = required.filter((type) => {
    const doc = presentMap.get(type);
    if (!doc || !(rule.trustedSources || []).length) return false;
    return !isTrustedSource(doc, rule.trustedSources || []);
  });
  const unsigned = required.filter((type) => {
    const doc = presentMap.get(type);
    if (!doc) return false;
    return !['SIGNED', 'FINAL', 'VERIFIED'].includes(resolveDocStatus(doc)) && !doc?.signedAt;
  });

  const blockers = [
    ...missing.map((type) => `missing_${type.toLowerCase()}`),
    ...invalid.map((type) => `invalid_${type.toLowerCase()}`),
    ...stale.map((type) => `stale_${type.toLowerCase()}`),
    ...untrusted.map((type) => `untrusted_${type.toLowerCase()}`),
    ...unsigned.map((type) => `unsigned_${type.toLowerCase()}`)
  ];

  return {
    scenario,
    role,
    required,
    present: Array.from(presentMap.keys()),
    missing,
    invalid,
    stale,
    unsigned,
    untrusted,
    ready: blockers.length === 0,
    blockers,
    missingHuman: missing.join(', '),
    riskHuman: [...invalid, ...stale, ...unsigned, ...untrusted].join(', '),
    blockBefore: [...(rule.blockBefore || [])],
    gateState: blockers.length === 0 ? 'GREEN' : missing.length || invalid.length || untrusted.length ? 'RED' : 'AMBER',
    items: required.map((type) => {
      const doc = presentMap.get(type);
      return {
        type,
        present: Boolean(doc),
        status: doc ? resolveDocStatus(doc) : 'MISSING',
        trusted: doc ? isTrustedSource(doc, rule.trustedSources || []) : false,
        stale: stale.includes(type),
        unsigned: unsigned.includes(type),
        blocking: blockers.some((code) => code.endsWith(type.toLowerCase()))
      };
    })
  };
}

export function evaluateDocumentCompleteness(input: {
  scenario?: string | null;
  documents?: any[];
  requiredOverride?: string[];
  role?: string | null;
}) {
  const result = evaluateDocumentCompletenessV2(input);
  return {
    scenario: result.scenario,
    required: result.required,
    present: result.present,
    missing: result.missing,
    invalid: result.invalid,
    stale: result.stale,
    ready: result.ready,
    blockers: result.blockers,
    missingHuman: result.missingHuman,
    blockBefore: result.blockBefore,
    gateState: result.gateState,
    unsigned: result.unsigned,
    untrusted: result.untrusted
  };
}
