export type ProviderComplianceStatus = 'READY' | 'MANUAL_REVIEW' | 'BLOCKED';
export type RegistryEvidenceStatus = 'LIVE_OK' | 'SANDBOX_ONLY' | 'MANUAL_ONLY' | 'MISSING' | 'EXPIRED';
export type ProviderLegalRole = 'carrier' | 'expeditor' | 'mixed' | 'lab' | 'bank' | 'other';
export type ProviderComplianceCategory = 'LOGISTICS' | 'LAB' | 'ELEVATOR' | 'SURVEY' | 'INSURANCE' | 'PORT' | 'RAIL' | 'BANK';
export type ProviderComplianceCheck =
  | 'lab_accreditation'
  | 'declaration_validity'
  | 'goslog_carrier'
  | 'goslog_expeditor'
  | 'epd_ready'
  | 'qualified_signature'
  | 'gps_evidence'
  | 'bank_whitelist';

export type ProviderRegistryEvidence = Partial<Record<ProviderComplianceCheck, {
  status: RegistryEvidenceStatus;
  checkedAt?: string;
  source?: string;
  note?: string;
}>>;

export type ProviderComplianceContext = {
  category: ProviderComplianceCategory;
  legalRole?: ProviderLegalRole;
  disputeSensitive?: boolean;
  moneySensitive?: boolean;
  exportFlow?: boolean;
  requiresEpd?: boolean;
  requiresQualifiedSignature?: boolean;
  requiresGpsEvidence?: boolean;
  requiresBankWhitelist?: boolean;
};

export type ProviderComplianceDecision = {
  status: ProviderComplianceStatus;
  requiredChecks: ProviderComplianceCheck[];
  readyChecks: ProviderComplianceCheck[];
  manualChecks: ProviderComplianceCheck[];
  blockingChecks: ProviderComplianceCheck[];
  liveOnlyChecks: ProviderComplianceCheck[];
  missingLiveChecks: ProviderComplianceCheck[];
  reasons: string[];
  allowedMode: 'live' | 'pilot_manual' | 'blocked';
};

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function isReady(status?: RegistryEvidenceStatus) {
  return status === 'LIVE_OK';
}

function isManual(status?: RegistryEvidenceStatus) {
  return status === 'SANDBOX_ONLY' || status === 'MANUAL_ONLY';
}

export function resolveRequiredProviderChecks(context: ProviderComplianceContext): ProviderComplianceCheck[] {
  const checks: ProviderComplianceCheck[] = [];

  if (context.category === 'LAB' || context.legalRole === 'lab' || context.disputeSensitive || context.moneySensitive) {
    checks.push('lab_accreditation', 'declaration_validity');
  }

  if (context.category === 'LOGISTICS' || context.category === 'RAIL' || context.category === 'PORT') {
    const role = context.legalRole || 'carrier';
    if (role === 'carrier' || role === 'mixed') checks.push('goslog_carrier');
    if (role === 'expeditor' || role === 'mixed') checks.push('goslog_expeditor');
  }

  if (context.requiresEpd || context.category === 'LOGISTICS' || context.category === 'RAIL') {
    checks.push('epd_ready');
  }

  if (context.requiresQualifiedSignature || context.moneySensitive || context.exportFlow) {
    checks.push('qualified_signature');
  }

  if (context.requiresGpsEvidence || context.category === 'LOGISTICS') {
    checks.push('gps_evidence');
  }

  if (context.requiresBankWhitelist || context.category === 'BANK' || context.moneySensitive) {
    checks.push('bank_whitelist');
  }

  return unique(checks);
}

export function evaluateProviderComplianceGate(input: {
  context: ProviderComplianceContext;
  evidence?: ProviderRegistryEvidence;
}) : ProviderComplianceDecision {
  const evidence = input.evidence || {};
  const requiredChecks = resolveRequiredProviderChecks(input.context);
  const readyChecks: ProviderComplianceCheck[] = [];
  const manualChecks: ProviderComplianceCheck[] = [];
  const blockingChecks: ProviderComplianceCheck[] = [];
  const liveOnlyChecks: ProviderComplianceCheck[] = [];
  const reasons: string[] = [];

  for (const check of requiredChecks) {
    const status = evidence[check]?.status;
    if (isReady(status)) {
      readyChecks.push(check);
      continue;
    }
    if (isManual(status)) {
      manualChecks.push(check);
      reasons.push(`${check}: доступен только sandbox/manual режим`);
      continue;
    }
    blockingChecks.push(check);
    reasons.push(`${check}: отсутствует live-подтверждение`);
  }

  for (const check of requiredChecks) {
    if (['lab_accreditation', 'declaration_validity', 'goslog_carrier', 'goslog_expeditor', 'epd_ready', 'qualified_signature'].includes(check)) {
      liveOnlyChecks.push(check);
    }
  }

  const missingLiveChecks = liveOnlyChecks.filter((check) => !isReady(evidence[check]?.status));

  if (blockingChecks.length > 0) {
    return {
      status: 'BLOCKED',
      requiredChecks,
      readyChecks,
      manualChecks,
      blockingChecks,
      liveOnlyChecks: unique(liveOnlyChecks),
      missingLiveChecks: unique(missingLiveChecks),
      reasons,
      allowedMode: 'blocked'
    };
  }

  if (manualChecks.length > 0) {
    return {
      status: 'MANUAL_REVIEW',
      requiredChecks,
      readyChecks,
      manualChecks,
      blockingChecks,
      liveOnlyChecks: unique(liveOnlyChecks),
      missingLiveChecks: unique(missingLiveChecks),
      reasons,
      allowedMode: 'pilot_manual'
    };
  }

  return {
    status: 'READY',
    requiredChecks,
    readyChecks,
    manualChecks,
    blockingChecks,
    liveOnlyChecks: unique(liveOnlyChecks),
    missingLiveChecks: unique(missingLiveChecks),
    reasons,
    allowedMode: 'live'
  };
}
