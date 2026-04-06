export type DataProvenanceKind = 'canonical' | 'derived' | 'manual' | 'sandbox' | 'fallback' | 'pilot' | 'unavailable' | 'mixed';

export function classifyDataProvenance(source?: string | null) {
  const value = String(source || '').toLowerCase();
  if (!value || value === '—') {
    return { kind: 'unavailable' as DataProvenanceKind, label: 'источник не определён', tone: 'alert-warning', trusted: false, hardWarning: true };
  }
  if (value.includes('unavailable') || value.includes('broken') || value.includes('error')) {
    return { kind: 'unavailable' as DataProvenanceKind, label: 'unavailable', tone: 'alert-error', trusted: false, hardWarning: true };
  }
  if (value.includes('canonical') || value.includes('primary') || value.includes('truth')) {
    return { kind: 'canonical' as DataProvenanceKind, label: 'canonical', tone: 'alert-success', trusted: true, hardWarning: false };
  }
  if (value.includes('sandbox') || value.includes('stub')) {
    return { kind: 'sandbox' as DataProvenanceKind, label: 'sandbox / stub', tone: 'alert-error', trusted: false, hardWarning: true };
  }
  if (value.includes('fallback')) {
    return { kind: 'fallback' as DataProvenanceKind, label: 'fallback', tone: 'alert-error', trusted: false, hardWarning: true };
  }
  if (value.includes('pilot')) {
    return { kind: 'pilot' as DataProvenanceKind, label: 'pilot runtime', tone: 'alert-warning', trusted: false, hardWarning: true };
  }
  if (value.includes('runtime')) {
    return { kind: 'derived' as DataProvenanceKind, label: 'runtime view', tone: 'alert-warning', trusted: false, hardWarning: false };
  }
  if (value.includes('derived')) {
    return { kind: 'derived' as DataProvenanceKind, label: 'derived', tone: 'alert-warning', trusted: false, hardWarning: false };
  }
  if (value.includes('manual')) {
    return { kind: 'manual' as DataProvenanceKind, label: 'manual', tone: 'alert-warning', trusted: false, hardWarning: false };
  }
  return { kind: 'mixed' as DataProvenanceKind, label: 'прикладной источник', tone: 'alert-warning', trusted: false, hardWarning: false };
}
