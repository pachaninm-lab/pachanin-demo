import { resolvePlatformV7ManualAction } from '@/lib/platform-v7/manual-actions';

const CASES = [
  resolvePlatformV7ManualAction({
    actionId: 'missing-reason',
    kind: 'request_document',
    entityId: 'DL-9102',
    actor: 'Оператор',
    reason: '',
  }),
  resolvePlatformV7ManualAction({
    actionId: 'manual-review',
    kind: 'send_to_review',
    entityId: 'DL-9108',
    actor: 'Банк',
    reason: 'Не хватает транспортного пакета',
    timestamp: '2026-05-02T10:00:00.000Z',
  }),
  resolvePlatformV7ManualAction({
    actionId: 'close-dispute',
    kind: 'close_dispute',
    entityId: 'DSP-2406',
    actor: 'Арбитр',
    reason: 'Стороны приняли решение',
    nextStep: 'Передать решение банку для проверки удержания.',
    timestamp: '2026-05-02T10:01:00.000Z',
  }),
];

function tone(allowed: boolean) {
  if (allowed) return { label: 'Записано в журнал', bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  return { label: 'Нужна причина', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
}

export function ManualActionReasonsStrip() {
  return (
    <section data-testid="platform-v7-manual-action-reasons" style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div>
        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ручные действия · основания</div>
        <div style={{ marginTop: 4, fontSize: 22, lineHeight: 1.12, fontWeight: 950, color: '#0F1419' }}>Нельзя менять сделку без причины</div>
        <div style={{ marginTop: 6, fontSize: 13, color: '#64748B', lineHeight: 1.55 }}>Запрос документа, ручная проверка, спор и денежная проверка должны иметь причину и запись в журнале.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
        {CASES.map((item, index) => {
          const t = tone(item.allowed);
          return (
            <article key={`${item.message}-${index}`} style={{ border: '1px solid #EEF1F4', borderRadius: 14, padding: 12, background: '#F8FAFB', display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 900, color: '#0A7A5F' }}>{item.journal?.entityId ?? '—'}</div>
                  <div style={{ marginTop: 3, fontSize: 14, fontWeight: 900, color: '#0F1419' }}>{item.journal?.kind ?? 'действие остановлено'}</div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 7px', borderRadius: 999, background: t.bg, border: `1px solid ${t.border}`, color: t.color, fontSize: 11, fontWeight: 900 }}>{t.label}</span>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.45, color: '#334155' }}>{item.message}</div>
              <div style={{ fontSize: 12, lineHeight: 1.45, color: '#334155', fontWeight: 750 }}>Следующий шаг: {item.nextStep}</div>
              <div style={{ fontSize: 11, lineHeight: 1.45, color: '#64748B' }}>Причина: {item.journal?.reason ?? 'не указана'}</div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
