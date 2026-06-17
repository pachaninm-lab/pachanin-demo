import { CockpitHero, ProcessStepper, StatusPill, PremiumCtaButton, type PremiumTone } from '@/components/platform-v7/premium';
import { platformV7BuildAccessStatusView, type PlatformV7AccessRequest, type PlatformV7AccessTone } from '@/lib/platform-v7/access-request';

const card = { border: '1px solid var(--pc-prem-border, #E2E8F0)', borderRadius: 18, background: 'var(--pc-prem-surface, #FFFFFF)', padding: 16, display: 'grid', gap: 10 } as const;
const micro = { color: 'var(--pc-text-muted, #58606E)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' } as const;
const note = { color: 'var(--pc-text-muted, #58606E)', fontSize: 12, lineHeight: 1.5 } as const;

function toPremiumTone(tone: PlatformV7AccessTone): PremiumTone {
  return tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : tone === 'success' ? 'success' : 'info';
}

// Контролируемый пилот: доступ открыт; статус показывает зрелую модель допуска.
const PILOT_REQUEST: PlatformV7AccessRequest = {
  id: 'ACCESS-PILOT',
  organizationName: 'КФХ «Северное поле»',
  requestedRole: 'Продавец',
  status: 'approved',
  submittedAt: '2026-05-21T09:00:00+03:00',
};

export default function AccessStatusPage() {
  const view = platformV7BuildAccessStatusView(PILOT_REQUEST);

  return (
    <main data-testid="platform-v7-access-page" style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <CockpitHero
        eyebrow="Доступ · статус заявки организации"
        title="Где ваша заявка"
        accent="и что делать дальше"
        lead="Организация → роль → подтверждение → ручная проверка → доступ. Каждый статус показывает одно понятное следующее действие."
        aside={
          <div style={{ ...card, background: 'var(--pc-prem-surface-2, #F8FAFC)' }}>
            <div style={micro}>{view.request.organizationName} · {view.request.requestedRole}</div>
            <StatusPill tone={toPremiumTone(view.tone)}>{view.label}</StatusPill>
            <span style={note}>{view.nextAction}</span>
          </div>
        }
      >
        <ProcessStepper
          ariaLabel="Жизненный цикл доступа"
          steps={view.lifecycle.map((step, index) => ({
            label: step.label,
            state: step.reached ? (index === view.lifecycle.length - 1 && view.canEnter ? 'done' : 'done') : 'upcoming',
          }))}
        />
        {view.canEnter ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
            <PremiumCtaButton href="/platform-v7/seller" glyph="bag">Войти в кабинет</PremiumCtaButton>
            <PremiumCtaButton href="/platform-v7" variant="ghost">Сменить кабинет</PremiumCtaButton>
          </div>
        ) : null}
      </CockpitHero>

      <section style={card} aria-label="Статус доступа">
        <div style={micro}>Следующее действие</div>
        <span style={{ color: 'var(--pc-text-primary, #0F1419)', fontSize: 14, fontWeight: 850, lineHeight: 1.4 }}>{view.nextAction}</span>
        <span style={note}>{view.pilotNote}</span>
      </section>
    </main>
  );
}
