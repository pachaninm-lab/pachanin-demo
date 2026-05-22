import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { FieldLabRuntime } from '@/components/v7r/FieldLabRuntime';
import { RoleContinuityPanel } from '@/components/v7r/RoleContinuityPanel';
import { QuietIntelligenceHint } from '@/components/platform-v7/visual/QuietIntelligenceHint';
import { TrustDot } from '@/components/platform-v7/visual/TrustDot';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { getLabSamples, pendingProtocols, labMoneyImpactRub } from '@/lib/labs-server';
import { CauseLine } from '@/components/platform-v7/visual/CauseLine';

const labSteps = [
  { label: 'Проба', value: 'отбор и фиксация', note: 'кто взял, когда, по какому рейсу' },
  { label: 'Показатели', value: 'влага, сорность, клейковина', note: 'цифры должны быть видны без спора о словах' },
  { label: 'Отклонение', value: 'сорная примесь 2,4%', note: 'допуск до 2% — нужен протокол' },
  { label: 'Протокол', value: 'ожидает решения', note: 'допуск или отказ уходит в документы' },
] as const;

export default async function Page() {
  const samples = await getLabSamples();
  const pending = pendingProtocols(samples);
  const moneyImpact = labMoneyImpactRub(samples);
  const apiOnline = samples.some((s) => !s.id.startsWith('SAMPLE-00'));

  const liveBlockers = pending.map((s) => ({
    id: s.id,
    label: `Проба ${s.id}: ${s.status} · ${s.culture ?? 'культура не указана'}`,
    severity: 'warn' as const,
    responsibleRole: 'LAB',
    nextAction: 'Провести анализ и финализировать протокол',
  }));

  return (
    <div data-testid="platform-v7-lab-page" style={{ display: 'grid', gap: 18 }}>
      <LiveApiStatusBar
        apiOnline={apiOnline}
        blockers={liveBlockers}
        role="LAB · Лабораторный контур"
        summary={
          apiOnline
            ? `${samples.length} проб · ${pending.length} ожидают финализации · ${moneyImpact !== 0 ? (moneyImpact / 1_000_000).toFixed(2) + ' млн ₽ влияние' : 'нет денежного влияния'}`
            : 'Данные статичные — API недоступен'
        }
      />
      <style>{`
        @media(max-width:767px){
          [data-testid='platform-v7-lab-page']{gap:10px!important}
          .p7-lab-intel,.p7-lab-proof,.p7-lab-trust,.p7-lab-summary,.p7-lab-continuity{display:none!important}
          .p7-lab-hero{padding:16px!important;border-radius:24px!important;gap:10px!important}
          .p7-lab-hero h1{font-size:clamp(28px,8vw,38px)!important;line-height:1.04!important}
          .p7-lab-hero p{display:none!important}
          .p7-lab-steps{grid-template-columns:1fr 1fr!important;gap:8px!important}
          .p7-lab-steps > div:nth-child(1),.p7-lab-steps > div:nth-child(2){display:none!important}
          .p7-lab-step{padding:13px!important;border-radius:16px!important;gap:5px!important}
          .p7-lab-step strong{font-size:14px!important;line-height:1.25!important}
        }
      `}</style>
      <div className="p7-lab-intel">
        <QuietIntelligenceHint
          problem="Сорная примесь 2,4% превышает допуск 2% — протокол качества не закрыт."
          action="Зафиксировать показатели и выдать протокол с допуском или отказом."
          outcome="Протокол уйдёт в контур документов как основание для дальнейшей проверки."
        />
      </div>
      <section className="p7-lab-hero" style={hero}>
        <div style={{ display: 'grid', gap: 9, maxWidth: 840 }}>
          <div style={badge}>
            Лаборатория · качество и протокол
          </div>
          <h1 style={h1}>
            Проба, показатели и протокол качества
          </h1>
          <p style={lead}>
            Лабораторный экран показывает только пробу, показатели качества, отклонения и итоговый допуск. Финансовое решение, спор и банковская проверка остаются вне роли лаборатории.
          </p>
        </div>

        <div className="p7-lab-steps" style={stepsGrid}>
          {labSteps.map((item) => (
            <div key={item.label} className="p7-lab-step" style={stepCard}>
              <span style={micro}>{item.label}</span>
              <strong style={{ color: '#0F1419', fontSize: 15, lineHeight: 1.35 }}>{item.value}</strong>
              <span style={{ color: '#64748B', fontSize: 12, lineHeight: 1.4 }}>{item.note}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="p7-lab-proof">
        <CauseLine
          cause={{ text: 'Протокол качества не выдан', tone: 'blocked' }}
          relation="blocks"
          effect={{ text: 'Пакет документов по качеству не закрыт', tone: 'blocked' }}
        />
      </div>
      <div className="p7-lab-trust">
        <TrustDot state="test" size="sm" label="Тестовый контур · ФГБУ ЦОК АПК требует договора" />
      </div>

      <div className="p7-lab-summary"><RoleExecutionSummary role="lab" /></div>
      <div className="p7-lab-continuity"><RoleContinuityPanel role="lab" compact /></div>
      <FieldLabRuntime />
    </div>
  );
}

const hero = {
  background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFB 58%, #EEF6F3 100%)',
  border: '1px solid #E4E6EA',
  borderRadius: 28,
  padding: 24,
  display: 'grid',
  gap: 16,
  boxShadow: '0 18px 44px rgba(15,23,42,0.08)',
} as const;
const badge = {
  display: 'inline-flex',
  width: 'fit-content',
  padding: '7px 11px',
  borderRadius: 999,
  background: 'rgba(10,122,95,0.08)',
  border: '1px solid rgba(10,122,95,0.18)',
  color: '#0A7A5F',
  fontSize: 12,
  fontWeight: 900,
} as const;
const h1 = {
  margin: 0,
  fontSize: 'clamp(30px, 4.8vw, 52px)',
  lineHeight: 1.04,
  letterSpacing: '-0.045em',
  color: '#0F1419',
  fontWeight: 950,
} as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.7 } as const;
const stepsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 } as const;
const stepCard = {
  background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)',
  border: '1px solid #E4E6EA',
  borderRadius: 18,
  padding: 14,
  display: 'grid',
  gap: 7,
  boxShadow: '0 12px 28px rgba(15,23,42,0.055)',
} as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
