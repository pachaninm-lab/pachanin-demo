import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { FieldLabRuntime } from '@/components/v7r/FieldLabRuntime';
import { RoleContinuityPanel } from '@/components/v7r/RoleContinuityPanel';
import { QuietIntelligenceHint } from '@/components/platform-v7/visual/QuietIntelligenceHint';
import { TrustDot } from '@/components/platform-v7/visual/TrustDot';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { getLabSamples, pendingProtocols, labMoneyImpactRub } from '@/lib/labs-server';
import { CauseLine } from '@/components/platform-v7/visual/CauseLine';
import { QualityDeltaBars } from '@/components/platform-v7/QualityDeltaBars';
import { CockpitHero } from '@/components/platform-v7/premium';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';

const labSteps = [
  { label: 'Проба', value: 'отбор и фиксация', note: 'кто взял, когда, по какому рейсу' },
  { label: 'Показатели', value: 'влага, сорность, клейковина', note: 'цифры видны без лишнего текста' },
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
    <div data-testid="platform-v7-lab-page" style={{ display: 'grid', gap: 14 }}>
      <LiveApiStatusBar
        apiOnline={apiOnline}
        blockers={liveBlockers}
        role="LAB · Лабораторный контур"
        summary={apiOnline ? `${samples.length} проб · ${pending.length} ожидают финализации · ${moneyImpact !== 0 ? (moneyImpact / 1_000_000).toFixed(2) + ' млн ₽ влияние' : 'нет денежного влияния'}` : 'Данные статичные — API недоступен'}
      />
      <style dangerouslySetInnerHTML={{ __html: `@media(max-width:767px){[data-testid='platform-v7-lab-page']{gap:10px!important}.p7-lab-hero{padding:16px!important;border-radius:24px!important;gap:10px!important}.p7-lab-hero h1{font-size:clamp(28px,8vw,38px)!important;line-height:1.04!important}.p7-lab-hero p{display:none!important}.p7-lab-steps{grid-template-columns:1fr 1fr!important;gap:8px!important}.p7-lab-step{padding:13px!important;border-radius:16px!important;gap:5px!important}.p7-lab-step strong{font-size:14px!important;line-height:1.25!important}}` }} />
      <QuietIntelligenceHint problem="Сорная примесь 2,4% превышает допуск 2% — протокол качества не закрыт." action="Зафиксировать показатели и выдать протокол с допуском или отказом." outcome="Протокол уйдёт в контур документов как основание для дальнейшей проверки." />
      <CockpitHero className='p7-lab-hero' eyebrow='Лаборатория · качество и протокол' title='Проба, показатели и протокол качества' lead='Лабораторный экран показывает пробу, показатели качества, отклонения и итоговый допуск. Финансовое решение, спор и банковская проверка остаются вне роли лаборатории.'>
        <div className="p7-lab-steps" style={stepsGrid}>
          {labSteps.map((item) => (
            <div key={item.label} className="p7-lab-step" style={stepCard}>
              <span style={micro}>{item.label}</span>
              <strong style={{ color: 'var(--pc-text-primary, #0F1419)', fontSize: 15, lineHeight: 1.35 }}>{item.value}</strong>
              <span style={{ color: 'var(--pc-text-muted, #64748B)', fontSize: 12, lineHeight: 1.4 }}>{item.note}</span>
            </div>
          ))}
        </div>
      </CockpitHero>
      <CollapsibleSection title='Показатели качества' summary='влага · клейковина · сорность' defaultOpen>
        <QualityDeltaBars title='Протокол качества · показатели против допуска' indicators={[{ label: 'Влажность', value: 13.1, unit: '%', max: 14, limitLabel: 'допуск до 14%' }, { label: 'Клейковина', value: 23, unit: '%', min: 21, limitLabel: 'минимум 21%' }, { label: 'Сорная примесь', value: 2.4, unit: '%', max: 2, limitLabel: 'допуск до 2% — превышение требует протокола с допуском или отказом' }]} />
      </CollapsibleSection>
      <CollapsibleSection title='Влияние на документы' summary='протокол → пакет качества' defaultOpen={false}>
        <div style={{ display: 'grid', gap: 12 }}>
          <CauseLine cause={{ text: 'Протокол качества не выдан', tone: 'blocked' }} relation="blocks" effect={{ text: 'Пакет документов по качеству не закрыт', tone: 'blocked' }} />
          <TrustDot state="test" size="sm" label="Тестовый контур · внешнее подтверждение требуется отдельно" />
        </div>
      </CollapsibleSection>
      <CollapsibleSection title='Роль и передача результата' summary='ответственный · непрерывность' defaultOpen={false}>
        <div style={{ display: 'grid', gap: 12 }}><RoleExecutionSummary role="lab" /><RoleContinuityPanel role="lab" compact /></div>
      </CollapsibleSection>
      <CollapsibleSection title='Лабораторный runtime' summary='пробы · протокол · действие' defaultOpen={false}>
        <FieldLabRuntime />
      </CollapsibleSection>
    </div>
  );
}

const stepsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 } as const;
const stepCard = { background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 14, display: 'grid', gap: 7, boxShadow: '0 12px 28px rgba(15,23,42,0.055)' } as const;
const micro = { color: 'var(--pc-text-muted, #64748B)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
