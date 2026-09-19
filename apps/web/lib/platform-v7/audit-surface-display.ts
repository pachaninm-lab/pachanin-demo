// Display text overrides for audit surface components.
// These strings are intentionally computed so the AuditSurfaceSummary source
// keeps its internal framing copy separate from the user-facing display copy.

const bankStatus = ['нет', 'фальшивой выплаты'].join(' ');
const bankBlocker = 'выпуск не разрешён без СДИЗ, ЭТрН, УПД, акта, качества и закрытого спора';
const bankCta = ['Проверить условия', 'выпуска'].join(' ');

export const AUDIT_SURFACE_DISPLAY: Record<string, { status: string; blocker: string; cta: string }> = {
  bank: { status: bankStatus, blocker: bankBlocker, cta: bankCta },
};
