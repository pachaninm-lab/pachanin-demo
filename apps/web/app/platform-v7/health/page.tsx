import { getPlatformV7HealthCockpitState } from '@/lib/platform-v7/runtime/health-cockpit-state';
import { CockpitHero, PremiumStatCard, StatusPill, type PremiumTone } from '@/components/platform-v7/premium';

const card = { border: '1px solid var(--pc-prem-border, #E2E8F0)', borderRadius: 18, background: 'var(--pc-prem-surface, #FFFFFF)', padding: 16, display: 'grid', gap: 10 } as const;
const micro = { color: 'var(--pc-text-muted, #58606E)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' } as const;
const rowText = { color: 'var(--pc-text-primary, #0F1419)', fontSize: 13, fontWeight: 800 } as const;
const noteText = { color: 'var(--pc-text-muted, #58606E)', fontSize: 12, lineHeight: 1.4 } as const;

function tone(sev: 'ok' | 'warning' | 'critical'): PremiumTone {
  return sev === 'critical' ? 'danger' : sev === 'warning' ? 'warning' : 'success';
}

export default function HealthPage() {
  const state = getPlatformV7HealthCockpitState();

  return (
    <main data-testid="platform-v7-health-page" style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <CockpitHero
        eyebrow="Контур наблюдаемости · здоровье пилота"
        title="Где зависла сделка,"
        accent="деньги, документ или адаптер"
        lead="System / Deal / Money / Integration / Adapter / Queue Health, очередь ручной проверки и монитор застрявших сделок — из runtime, без фейковой телеметрии."
        aside={
          <div style={{ ...card, background: 'var(--pc-prem-surface-2, #F8FAFC)' }}>
            <div style={micro}>общий статус</div>
            <StatusPill tone={tone(state.overall)}>
              {state.overall === 'ok' ? 'контур здоров' : state.overall === 'warning' ? 'есть предупреждения' : 'есть критические'}
            </StatusPill>
          </div>
        }
      >
        <div className="pc-prem-kpis" aria-label="Области здоровья">
          {state.areas.map((area) => (
            <PremiumStatCard key={`${area.key}-${area.label}`} glyph="gauge" tone={tone(area.severity)} value={area.value} label={area.label} />
          ))}
        </div>
      </CockpitHero>

      <section style={card} aria-label="Очередь ручной проверки">
        <div style={micro}>Manual Review Queue · {state.manualReviewQueue.length}</div>
        {state.manualReviewQueue.length === 0 ? (
          <span style={noteText}>Очередь ручной проверки пуста.</span>
        ) : (
          state.manualReviewQueue.map((item) => (
            <div key={item.id} style={{ display: 'grid', gap: 2 }}>
              <span style={rowText}>{item.label}</span>
              <span style={noteText}>{item.reason}</span>
            </div>
          ))
        )}
      </section>

      <section style={card} aria-label="Монитор застрявших сделок">
        <div style={micro}>Stuck Deal Monitor · {state.stuckDeals.length}</div>
        {state.stuckDeals.length === 0 ? (
          <span style={noteText}>Застрявших сделок нет.</span>
        ) : (
          state.stuckDeals.map((item) => (
            <div key={item.id} style={{ display: 'grid', gap: 2 }}>
              <span style={rowText}>{item.label}</span>
              <span style={noteText}>{item.reason}</span>
            </div>
          ))
        )}
      </section>

      <section style={card} aria-label="Здоровье адаптеров">
        <div style={micro}>Adapter Health · pre-integration</div>
        {state.adapters.map((adapter) => (
          <div key={adapter.system} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={rowText}>{adapter.system}</span>
            <span style={noteText}>{adapter.status}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
