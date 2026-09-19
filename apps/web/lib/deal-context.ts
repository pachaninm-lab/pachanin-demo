export function dealContextLabel(deal?: { status?: string; nextAction?: string; blocker?: string | null }) {
  if (!deal) return 'Сделка не выбрана';
  const status = String(deal.status || 'unknown');
  const next = String(deal.nextAction || '').trim();
  const blocker = String(deal.blocker || '').trim();
  return blocker ? `${status} · blocker: ${blocker}` : next ? `${status} · ${next}` : status;
}

export function readDealIdParam(searchParams: { get: (key: string) => string | null } | URLSearchParams | null | undefined): string {
  if (!searchParams || typeof (searchParams as any).get !== 'function') return '';
  return String((searchParams as any).get('dealId') || '').trim();
}

export function buildLinkedObjectId(stage: string, dealId?: string | null, fallback?: string | null): string {
  const tail = String(dealId || fallback || 'PRESET').trim() || 'PRESET';
  return `${stage}-${tail}`;
}
