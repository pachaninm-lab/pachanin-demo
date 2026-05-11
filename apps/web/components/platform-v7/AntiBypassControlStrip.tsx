import {
  ANTI_BYPASS_STRENGTH_LABEL,
  getActiveControlCount,
  getAntiBypassControls,
  getPartialControlCount,
  type AntiBypassControlContext,
  type AntiBypassControlStrength,
} from '@/lib/platform-v7/anti-bypass-control';

function strengthTone(strength: AntiBypassControlStrength) {
  if (strength === 'active') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (strength === 'partial') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  return { bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.18)', color: '#64748B' };
}

const CONTEXT_LABEL: Record<AntiBypassControlContext, string> = {
  seller: 'продавец',
  buyer: 'покупатель',
  'control-tower': 'центр управления',
};

export function AntiBypassControlStrip({ context }: { context: AntiBypassControlContext }) {
  const controls = getAntiBypassControls(context);
  const activeCount = getActiveControlCount(context);
  const partialCount = getPartialControlCount(context);

  return (
    <section
      data-testid="platform-v7-anti-bypass-control-strip"
      style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 12 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            пилотный контур · контроль обхода платформы
          </div>
          <div style={{ marginTop: 4, fontSize: 15, fontWeight: 950, color: '#0F1419', lineHeight: 1.2 }}>
            Контроли против обхода — {CONTEXT_LABEL[context]}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: '#64748B', lineHeight: 1.45, maxWidth: 640 }}>
            Пилотный контур. Контроли снижают риск обхода платформы — не исключают его полностью. Требуют реальной интеграции перед live-исполнением.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span
            data-testid="platform-v7-anti-bypass-active-count"
            style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999, border: '1px solid rgba(10,122,95,0.18)', background: 'rgba(10,122,95,0.08)', color: '#0A7A5F', fontSize: 11, fontWeight: 900 }}
          >
            {activeCount} активных
          </span>
          <span
            data-testid="platform-v7-anti-bypass-partial-count"
            style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999, border: '1px solid rgba(217,119,6,0.18)', background: 'rgba(217,119,6,0.08)', color: '#B45309', fontSize: 11, fontWeight: 900 }}
          >
            {partialCount} частично
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {controls.map((control) => {
          const tone = strengthTone(control.strength);
          return (
            <div
              key={control.key}
              data-testid="platform-v7-anti-bypass-control-row"
              style={{
                background: '#F8FAFB',
                border: '1px solid #EEF1F4',
                borderRadius: 10,
                padding: '8px 10px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 8,
                alignItems: 'start',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#0F1419' }}>{control.name}</div>
                <div style={{ marginTop: 3, fontSize: 12, color: '#475569', lineHeight: 1.35 }}>{control.description}</div>
              </div>
              <span
                style={{
                  width: 'fit-content',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: tone.bg,
                  border: `1px solid ${tone.border}`,
                  color: tone.color,
                  fontSize: 11,
                  fontWeight: 900,
                  lineHeight: 1.2,
                  whiteSpace: 'normal',
                }}
              >
                {ANTI_BYPASS_STRENGTH_LABEL[control.strength]}
              </span>
              <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.4, fontWeight: 750 }}>
                <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 2 }}>
                  эффект в пилотном контуре
                </span>
                {control.pilotEffect}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
