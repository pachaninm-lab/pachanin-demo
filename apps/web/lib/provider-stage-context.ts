type ProviderContext = Record<string, any> & {
  stage?: string;
  urgency?: 'LOW' | 'MEDIUM' | 'HIGH';
  amountRub?: number | null;
};

export function buildProviderContextPreset(stage: string, extra: Record<string, any> = {}): ProviderContext {
  return {
    stage,
    urgency: extra.urgency || 'MEDIUM',
    amountRub: extra.amountRub ?? null,
    ...extra,
  };
}

export function buildProviderContextFromWorkspace(stage: string, workspace: any, extra: Record<string, any> = {}): ProviderContext {
  const deals = Array.isArray(workspace?.deals) ? workspace.deals.length : 0;
  const slots = Array.isArray(workspace?.queueSlots) ? workspace.queueSlots.length : 0;
  const runs = Array.isArray(workspace?.transportRuns) ? workspace.transportRuns.length : 0;
  const docs = Array.isArray(workspace?.documents) ? workspace.documents.length : 0;
  return {
    stage,
    urgency: extra.urgency || 'MEDIUM',
    amountRub: extra.amountRub ?? null,
    deals,
    slots,
    runs,
    docs,
    ...extra,
  };
}

export function describeProviderContext(context: ProviderContext | null | undefined): string {
  if (!context) return '';
  const parts: string[] = [];
  if (context.stage) parts.push(`stage ${context.stage}`);
  if (context.urgency) parts.push(`urgency ${context.urgency}`);
  if (context.amountRub) parts.push(`amount ${Number(context.amountRub).toLocaleString('ru-RU')} ₽`);
  if (context.exportFlow) parts.push('export flow');
  if (context.disputeSensitive) parts.push('dispute-sensitive');
  if (context.needRailLink) parts.push('rail link');
  if (context.needPortLink) parts.push('port link');
  if (context.requiresGpsEvidence) parts.push('GPS evidence');
  return parts.join(' · ');
}
