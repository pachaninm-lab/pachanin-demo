export function formatMoney(value: number) {
  return value.toLocaleString('ru-RU') + ' ₽';
}

export function formatCompactMoney(value: number) {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + ' млн ₽';
  if (value >= 1_000) return Math.round(value / 1_000) + ' тыс. ₽';
  return value + ' ₽';
}

export function statusLabel(status: string) {
  const map: Record<string, string> = {
    draft: 'Черновик',
    contract_signed: 'Контракт',
    payment_reserved: 'Резерв',
    loading_scheduled: 'Погрузка запланирована',
    loading_started: 'Погрузка',
    loading_done: 'Погружено',
    in_transit: 'В пути',
    arrived: 'Прибыл',
    unloading_started: 'Разгрузка',
    unloading_done: 'Разгружено',
    quality_check: 'Проверка качества',
    quality_approved: 'Качество подтверждено',
    quality_disputed: 'Спор по качеству',
    docs_complete: 'Документы готовы',
    release_requested: 'Запрошена выплата',
    release_approved: 'Выплата одобрена',
    closed: 'Закрыта',
  };
  return map[status] ?? status;
}

export function riskTone(score: number) {
  if (score >= 70) return 'danger';
  if (score >= 30) return 'warning';
  return 'success';
}

export function relativeDaysLabel(days: number | null | undefined) {
  if (days == null) return '—';
  if (days === 0) return 'сегодня';
  if (days === 1) return '1 день';
  return `${days} дней`;
}

export function macroPhase(status: string) {
  const groups: Array<{ id: string; label: string; statuses: string[] }> = [
    { id: 'contract', label: 'Контракт', statuses: ['draft', 'contract_signed', 'payment_reserved'] },
    { id: 'logistics', label: 'Логистика', statuses: ['loading_scheduled', 'loading_started', 'loading_done', 'in_transit', 'arrived'] },
    { id: 'acceptance', label: 'Приёмка', statuses: ['unloading_started', 'unloading_done', 'quality_check', 'quality_approved', 'quality_disputed'] },
    { id: 'documents', label: 'Документы', statuses: ['docs_complete'] },
    { id: 'settlement', label: 'Расчёт', statuses: ['release_requested', 'release_approved', 'closed'] },
  ];
  return groups.find((group) => group.statuses.includes(status))?.id ?? 'contract';
}

export function classForTone(tone: 'danger' | 'warning' | 'success' | 'neutral') {
  if (tone === 'danger') return { bg: 'rgba(220,38,38,0.08)', color: '#DC2626', border: 'rgba(220,38,38,0.2)' };
  if (tone === 'warning') return { bg: 'rgba(217,119,6,0.08)', color: '#D97706', border: 'rgba(217,119,6,0.2)' };
  if (tone === 'success') return { bg: 'rgba(22,163,74,0.08)', color: '#16A34A', border: 'rgba(22,163,74,0.2)' };
  return { bg: '#F4F5F7', color: '#6B778C', border: '#E4E6EA' };
}
