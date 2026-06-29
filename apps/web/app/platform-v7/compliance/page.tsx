import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { BankCompliancePilotPanel } from '@/components/platform-v7/BankCompliancePilotPanel';
import { ComplianceRuntime } from '@/components/v7r/ComplianceRuntime';
import { RoleExecutionCockpitContent } from '@/components/platform-v7/RoleExecutionCockpit';
import { PRIMARY_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { KycQueuePanel } from '@/components/platform-v7/KycQueuePanel';
import {
  CockpitHero,
  PremiumStatCard,
  DonutGauge,
  StatusPill,
  TrendSparkline,
  PremiumCtaButton,
} from '@/components/platform-v7/premium';
import { TrustDot } from '@/components/platform-v7/visual/TrustDot';

const micro = { color: 'var(--pc-text-muted, #58606E)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' } as const;
const blockerCard = { display: 'grid', gap: 4, padding: 14, borderRadius: 16, border: '1px solid var(--pc-prem-border, #E2E8F0)', background: 'var(--pc-prem-surface, #F8FAFC)' } as const;
const anchorSection = { scrollMarginTop: 86 } as const;

export default function CompliancePage() {
  return (
    <div data-testid="platform-v7-compliance-page" data-platform-v7-compliance-cockpit-pass='true' style={{ display: 'grid', gap: 14 }}>
      <CockpitHero
        eyebrow='Кабинет комплаенса · допуск → риск → документы → решение'
        title='Проверить допуск,'
        accent='прежде чем сделка двинется'
        lead='Комплаенс видит не коммерческую витрину, а допуск сделки: контрагентов, документы, источник риска, блокер и одно действие.'
        aside={
          <div style={blockerCard}>
            <div style={micro}>главный блокер</div>
            <strong style={{ color: 'var(--pc-prem-warn, #B45309)', fontSize: 18, lineHeight: 1.2 }}>контрагент ждёт ручного допуска</strong>
            <span style={{ color: 'var(--pc-text-muted, #58606E)', fontSize: 12, lineHeight: 1.45 }}>сделка не двигается до решения по допуску</span>
          </div>
        }
      >
        <div className='pc-prem-kpis' aria-label='Ключевые показатели допуска'>
          <PremiumStatCard glyph='users' tone='info' value='2' label='Контрагента на проверке' />
          <PremiumStatCard glyph='doc' tone='warning' value='6 / 8' label='Документы подтверждены' />
          <PremiumStatCard glyph='alert' tone='danger' value='1' label='Стоп-фактор риска' />
          <PremiumStatCard glyph='shield-check' tone='neutral' value='ручная' label='Режим допуска' />
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <DonutGauge value={62} sublabel='допуск' caption='Готовность к допуску сделки' tone='warning' />
          <div style={{ flex: '1 1 220px', minWidth: 200, display: 'grid', gap: 8 }}>
            <StatusPill tone='warning'>Контрагент и документы требуют подтверждения</StatusPill>
            <TrendSparkline points={[40, 44, 48, 52, 55, 60, 62]} deltaLabel='+22 п.п.' caption='Динамика допуска · сценарий' />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
          <PremiumCtaButton href='#admission' glyph='shield-check'>Очередь допуска</PremiumCtaButton>
          <PremiumCtaButton href='#connectors' variant='ghost'>Подключения</PremiumCtaButton>
        </div>
        <TrustDot state='test' size='sm' label='Контур исполнения · Внешние подключения требуют договоров' />
      </CockpitHero>

      <section id='overview' style={anchorSection}>
        <CollapsibleSection title='Обзор допуска' summary='контрагент · документы · риск' defaultOpen>
          <RoleExecutionCockpitContent cockpit={PRIMARY_ROLE_EXECUTION_COCKPITS.compliance} />
        </CollapsibleSection>
      </section>

      <section id='admission' style={anchorSection}>
        <CollapsibleSection title='Ручной допуск и риск' summary='стоп-фактор · решение · основание' defaultOpen={false}>
          <div style={{ display: 'grid', gap: 12 }}>
            <RoleExecutionSummary role="compliance" />
            <BankCompliancePilotPanel mode="compliance" />
          </div>
        </CollapsibleSection>
      </section>

      <section id='connectors' style={anchorSection}>
        <CollapsibleSection title='Комплаенс runtime и проверки' summary='документы · роли · контроль' defaultOpen={false}>
          <ComplianceRuntime />
        </CollapsibleSection>
      </section>

      <section id='kyc-queue' style={anchorSection}>
        <CollapsibleSection title='Очередь KYC / AML' summary='новые орг · периодические · AML-триггеры · санкции' defaultOpen={false}>
          <KycQueuePanel />
        </CollapsibleSection>
      </section>
    </div>
  );
}
