export type DeadlineProtectionItem = {
  id: string;
  title: string;
  dueAt?: string | null;
  owner?: string | null;
  blocker?: string | null;
  moneyImpactRub?: number | null;
  requiredNow: string;
  state: 'GREEN' | 'AMBER' | 'RED';
  overdue: boolean;
  minutesLeft: number | null;
};

function minutesLeft(dueAt?: string | null) {
  if (!dueAt) return null;
  const ts = new Date(dueAt).getTime();
  if (!Number.isFinite(ts)) return null;
  return Math.round((ts - Date.now()) / 60000);
}

export function buildDeadlineProtection(items: Array<Record<string, any>> = []) {
  const rows: DeadlineProtectionItem[] = items.map((item, index) => {
    const left = minutesLeft(item?.dueAt || item?.deadlineAt);
    const overdue = left !== null && left < 0;
    const state: DeadlineProtectionItem['state'] = overdue ? 'RED' : left !== null && left <= 240 ? 'AMBER' : 'GREEN';
    return {
      id: item?.id || `deadline-${index}`,
      title: item?.title || item?.label || 'critical step',
      dueAt: item?.dueAt || item?.deadlineAt || null,
      owner: item?.owner || item?.ownerLabel || null,
      blocker: item?.blocker || item?.reason || null,
      moneyImpactRub: Number(item?.moneyImpactRub || item?.amountRub || 0) || null,
      requiredNow: item?.requiredNow || item?.nextAction || 'close_the_step',
      state,
      overdue,
      minutesLeft: left
    };
  }).sort((a, b) => (a.minutesLeft ?? 999999) - (b.minutesLeft ?? 999999));
  return {
    rows,
    summary: {
      total: rows.length,
      red: rows.filter((item) => item.state === 'RED').length,
      amber: rows.filter((item) => item.state === 'AMBER').length,
      green: rows.filter((item) => item.state === 'GREEN').length,
      mostUrgent: rows[0] || null
    }
  };
}
