export function normalizeBlockers(items: Array<string | null | undefined>): string[] {
  return Array.from(new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean)));
}

export function normalizeOwnerLabel(value?: string | null): string {
  const text = String(value || '').trim();
  return text || 'не назначен';
}

export function normalizeNextAction(value?: string | null): string {
  const text = String(value || '').trim();
  return text || 'следующий шаг не задан';
}

export function truthStateLabel(value?: string | null): string {
  const key = String(value || '').trim().toUpperCase();
  if (key === 'GREEN') return 'truth green';
  if (key === 'RED') return 'truth red';
  if (key === 'AMBER') return 'truth amber';
  return key || 'truth unknown';
}

export function providerModeLabel(value?: string | null): string {
  const key = String(value || '').trim().toUpperCase();
  if (key === 'LIVE') return 'live';
  if (key === 'SANDBOX') return 'sandbox';
  if (key === 'MANUAL') return 'manual';
  return key || 'provider unknown';
}

export function legalFinalityLabel(value?: string | null): string {
  const key = String(value || '').trim().toUpperCase();
  if (key === 'GREEN' || key === 'SIGNED') return 'юридически пригоден';
  if (key === 'AMBER') return 'нужна проверка';
  if (key === 'RED' || key === 'UNSIGNED') return 'нефинален';
  return key || 'статус не определён';
}
