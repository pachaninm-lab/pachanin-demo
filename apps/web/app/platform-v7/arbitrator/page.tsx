import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { JournalPreview } from '@/components/platform-v7/JournalPreview';
import ArbitratorPage from '@/app/platform-v7r/arbitrator/page';
import { QuietIntelligenceHint } from '@/components/platform-v7/visual/QuietIntelligenceHint';
import { TrustDot } from '@/components/platform-v7/visual/TrustDot';
import { CauseLine } from '@/components/platform-v7/visual/CauseLine';
import { SmartSectionSummary } from '@/components/platform-v7/visual/SmartSectionSummary';

const decisionGuardCards = [
  ['Сумма спора', 'решение должно иметь сумму и основание'],
  ['Доказательства', 'акт, протокол, вес, фото и журнал должны быть видимы'],
  ['Следующий шаг', 'оператор передаёт основание на ручную проверку'],
  ['Журнал', 'решение и причина фиксируются в истории сделки'],
] as const;

export default function Page() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <QuietIntelligenceHint
        problem='Открытый спор по DL-9102 · удержание 624 тыс. ₽ · акт расхождения не закрыт.'
        action='Рассмотреть доказательства и зафиксировать решение с суммой и основанием.'
        outcome='Решение уходит оператору на ручную проверку и фиксируется в журнале сделки.'
      />
      <RoleExecutionSummary role="arbitrator" />
      <section data-testid="platform-v7-arbitrator-decision-guard" style={decisionGuard}>
        <div style={micro}>Арбитр · рамка решения</div>
        <div style={title}>Решение арбитра создаёт основание для ручной проверки</div>
        <div style={lead}>
          Арбитр фиксирует сумму спора, доказательства, причину остановки и рекомендуемое действие. Следующий шаг требует ручной сверки основания оператором.
        </div>
        <div style={cardsGrid}>
          {decisionGuardCards.map(([cardTitle, text]) => (
            <div key={cardTitle} style={guardCard}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#0F1419' }}>{cardTitle}</div>
              <div style={{ marginTop: 5, fontSize: 12, color: '#64748B', lineHeight: 1.45 }}>{text}</div>
            </div>
          ))}
        </div>
      </section>
      <CauseLine
        cause={{ text: 'Акт расхождения DL-9102 не закрыт', tone: 'blocked' }}
        relation='blocks'
        effect={{ text: 'Удержание не снимается', tone: 'blocked' }}
        moneyAmount='624 тыс. ₽'
        moneyTone='hold'
      />
      <TrustDot state='test' size='sm' label='Тестовый контур · Арбитраж требует реальных договоров' />
      <SmartSectionSummary
        label='Активные споры'
        items={[
          { text: 'DL-9102 · Отклонение веса · Удержание 624 тыс. ₽ · Акт расхождения не подписан', tone: 'block' },
        ]}
      />

      <JournalPreview role="arbitrator" />
      <ArbitratorPage />
    </div>
  );
}

const decisionGuard = {
  background: 'linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 58%,#FEF2F2 100%)',
  border: '1px solid #E4E6EA',
  borderRadius: 24,
  padding: 20,
  display: 'grid',
  gap: 12,
  boxShadow: '0 16px 38px rgba(127,29,29,0.075)',
} as const;
const micro = {
  fontSize: 11,
  color: '#B91C1C',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
} as const;
const title = {
  fontSize: 24,
  lineHeight: 1.1,
  fontWeight: 950,
  color: '#0F1419',
  letterSpacing: '-0.035em',
} as const;
const lead = { fontSize: 13, color: '#475569', lineHeight: 1.6 } as const;
const cardsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 } as const;
const guardCard = {
  border: '1px solid rgba(220,38,38,0.12)',
  borderRadius: 16,
  padding: 12,
  background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)',
  boxShadow: '0 10px 24px rgba(15,23,42,0.045)',
} as const;
