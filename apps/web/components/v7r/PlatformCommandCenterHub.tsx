'use client';

import Link from 'next/link';
import { P7Badge } from '@/components/platform-v7/P7Badge';
import { P7DealSpine, type P7DealSpineStep } from '@/components/platform-v7/P7DealSpine';
import { P7Hero } from '@/components/platform-v7/P7Hero';
import { P7Section } from '@/components/platform-v7/P7Section';
import { PLATFORM_V7_TOKENS } from '@/lib/platform-v7/design/tokens';
import {
  PLATFORM_V7_EXECUTION_SOURCE,
  executionBlockers,
  executionReadinessScore,
  expectedDealAmountRub,
  formatRub,
  formatTons,
} from '@/lib/platform-v7/deal-execution-source-of-truth';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const { deal, logistics, money, documents, dispute } = PLATFORM_V7_EXECUTION_SOURCE;
const readinessScore = executionReadinessScore();
const blockers = executionBlockers();
const expectedDealAmount = expectedDealAmountRub();
const firstBlocker = blockers[0] ?? 'активных блокеров нет';

const DEAL_SPINE_STEPS: readonly P7DealSpineStep[] = [
  { label: 'лот', value: deal.lotId, tone: 'document' },
  { label: 'ставка', value: 'победитель выбран', tone: 'success' },
  { label: 'сделка', value: deal.id, tone: 'bank' },
  { label: 'резерв', value: formatRub(money.reservedRub), tone: 'money' },
  { label: 'логистика', value: logistics.orderId, tone: 'logistics' },
  { label: 'рейс', value: logistics.tripId, tone: 'logistics' },
  { label: 'приёмка', value: logistics.currentLeg, tone: 'warning' },
  { label: 'документы', value: documents.sdizStatus, tone: 'document' },
  { label: 'деньги', value: formatRub(money.releaseCandidateRub), tone: 'money' },
  { label: 'спор', value: dispute.status, tone: 'dispute' },
];

const FAST_ANSWERS = [
  { label: 'Что происходит', value: `${deal.lotId} → ${deal.id} → ${logistics.tripId}`, note: 'Одна сделка показана как execution-контур, не как витрина лотов.' },
  { label: 'Где деньги', value: `${formatRub(money.reservedRub)} в резервном контуре`, note: `${formatRub(money.releaseCandidateRub)} к выпуску после закрытия условий.` },
  { label: 'Где груз', value: logistics.currentLeg, note: `${logistics.pickupPoint} → ${logistics.deliveryPoint}. ETA: ${logistics.eta}.` },
  { label: 'Где документы', value: `СДИЗ: ${documents.sdizStatus}`, note: `Не хватает: ${documents.missingDocuments.join(', ')}.` },
  { label: 'Что заблокировано', value: blockers.length > 0 ? `${blockers.length} блокера` : 'критических блокеров нет', note: firstBlocker },
  { label: 'Кто следующий', value: blockers.length > 0 ? 'ответственный по блокеру + оператор' : 'банк / оператор', note: 'Следующий шаг должен иметь основание и след в журнале.' },
] as const;

const ROLE_ENTRY_POINTS: readonly { label: string; href: string; role: PlatformRole; tone: string; text: string }[] = [
  { label: 'Продавец', href: '/platform-v7/seller?as=seller', role: 'seller', tone: PLATFORM_V7_TOKENS.color.brand, text: 'лот, оффер, документы, причина задержки денег' },
  { label: 'Покупатель', href: '/platform-v7/buyer?as=buyer', role: 'buyer', tone: PLATFORM_V7_TOKENS.color.money, text: 'своя ставка, резерв, кредитный сценарий, следующий шаг' },
  { label: 'Логистика', href: '/platform-v7/logistics?as=logistics', role: 'logistics', tone: PLATFORM_V7_TOKENS.color.logistics, text: 'заявка, водитель, машина, ETA, документы рейса' },
  { label: 'Водитель', href: '/platform-v7/driver?as=driver', role: 'driver', tone: PLATFORM_V7_TOKENS.color.textSecondary, text: 'один рейс, маршрут, фото, пломба, проблема' },
  { label: 'Банк', href: '/platform-v7/bank?as=bank', role: 'bank', tone: PLATFORM_V7_TOKENS.color.bank, text: 'резерв, удержание, условия выпуска, блокеры' },
  { label: 'Оператор', href: '/platform-v7/control-tower?as=operator', role: 'operator', tone: PLATFORM_V7_TOKENS.color.dispute, text: 'очередь блокеров, SLA, владелец, журнал' },
] as const;

export function PlatformCommandCenterHub() {
  const { setRole } = usePlatformV7RStore();

  return (
    <main style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.xl, padding: '4px 0 32px' }}>
      <P7Hero
        eyebrow={
          <span style={{ display: 'inline-flex', gap: PLATFORM_V7_TOKENS.spacing.xs, flexWrap: 'wrap' }}>
            <P7Badge tone='info'>controlled-pilot</P7Badge>
            <P7Badge tone='warning'>simulation-grade</P7Badge>
            <P7Badge tone='neutral'>не production-ready</P7Badge>
          </span>
        }
        title='Дорогой контур исполнения зерновой сделки'
        subtitle={`От цены и допуска до рейса, приёмки, документов, удержания денег и спора. На экране сразу видно: где ${formatTons(deal.volumeTons)}, где ${formatRub(expectedDealAmount)}, кто отвечает и почему выпуск денег ещё закрыт.`}
        actions={
          <>
            <Link href='/platform-v7/demo' style={primaryCta}>Пройти сделку за 3 минуты</Link>
            <Link href={`/platform-v7/deals/${deal.id}/clean`} style={secondaryCta}>Открыть Deal 360</Link>
          </>
        }
        testId='platform-command-center-hero'
      >
        <P7DealSpine steps={DEAL_SPINE_STEPS} testId='platform-command-center-spine' />
      </P7Hero>

      <P7Section
        eyebrow='ответы за 5 секунд'
        title='Деньги, груз, документы, блокер и следующий ответственный — выше первого скролла'
        subtitle='Первый экран не должен быть каталогом карточек. Он должен дать банку, продавцу, покупателю и оператору одну картину исполнения сделки.'
        surface='card'
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: PLATFORM_V7_TOKENS.spacing.sm }}>
          {FAST_ANSWERS.map((item) => (
            <article key={item.label} style={answerCardStyle}>
              <div style={microLabelStyle}>{item.label}</div>
              <strong style={{ color: PLATFORM_V7_TOKENS.color.textPrimary, fontSize: 15, lineHeight: 1.42 }}>{item.value}</strong>
              <p style={{ margin: 0, color: PLATFORM_V7_TOKENS.color.textSecondary, fontSize: 13, lineHeight: 1.5 }}>{item.note}</p>
            </article>
          ))}
        </div>
      </P7Section>

      <P7Section
        eyebrow='ролевой вход'
        title='Каждая роль видит только свой участок сделки'
        subtitle='Ролевой вход не выглядит как dev-tool: это безопасная карта рабочих поверхностей, где скрыто всё лишнее — деньги, кредит, ставки или банк, если роль не должна их видеть.'
        surface='card'
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: PLATFORM_V7_TOKENS.spacing.sm }}>
          {ROLE_ENTRY_POINTS.map((entry) => (
            <Link
              key={entry.label}
              href={entry.href}
              onClick={() => setRole(entry.role)}
              style={{
                display: 'grid',
                gap: PLATFORM_V7_TOKENS.spacing.sm,
                minHeight: 152,
                textDecoration: 'none',
                border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`,
                borderRadius: PLATFORM_V7_TOKENS.radius.lg,
                background: PLATFORM_V7_TOKENS.color.surface,
                padding: PLATFORM_V7_TOKENS.spacing.md,
                boxShadow: PLATFORM_V7_TOKENS.shadow.none,
              }}
            >
              <span style={{ width: 44, height: 4, borderRadius: PLATFORM_V7_TOKENS.radius.pill, background: entry.tone }} />
              <strong style={{ color: PLATFORM_V7_TOKENS.color.textPrimary, fontSize: 20, lineHeight: 1.15, letterSpacing: '-0.03em' }}>{entry.label}</strong>
              <span style={{ color: PLATFORM_V7_TOKENS.color.textSecondary, fontSize: 13, lineHeight: 1.5 }}>{entry.text}</span>
              <span style={{ marginTop: 'auto', color: entry.tone, fontSize: 13, fontWeight: 800 }}>Открыть рабочий контур</span>
            </Link>
          ))}
        </div>
      </P7Section>
    </main>
  );
}

const primaryCta = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 46,
  borderRadius: PLATFORM_V7_TOKENS.radius.md,
  background: PLATFORM_V7_TOKENS.color.textPrimary,
  color: PLATFORM_V7_TOKENS.color.surface,
  padding: '12px 18px',
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 820,
} as const;

const secondaryCta = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 46,
  borderRadius: PLATFORM_V7_TOKENS.radius.md,
  border: `1px solid ${PLATFORM_V7_TOKENS.color.borderStrong}`,
  background: 'rgba(255,255,255,0.74)',
  color: PLATFORM_V7_TOKENS.color.textPrimary,
  padding: '12px 18px',
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 820,
} as const;

const answerCardStyle = {
  display: 'grid',
  gap: PLATFORM_V7_TOKENS.spacing.xs,
  minHeight: 132,
  border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`,
  borderRadius: PLATFORM_V7_TOKENS.radius.lg,
  background: PLATFORM_V7_TOKENS.color.surfaceMuted,
  padding: PLATFORM_V7_TOKENS.spacing.md,
} as const;

const microLabelStyle = {
  color: PLATFORM_V7_TOKENS.color.textMuted,
  fontSize: PLATFORM_V7_TOKENS.typography.micro.size,
  lineHeight: PLATFORM_V7_TOKENS.typography.micro.lineHeight,
  fontWeight: PLATFORM_V7_TOKENS.typography.micro.weight,
  letterSpacing: PLATFORM_V7_TOKENS.typography.micro.letterSpacing,
  textTransform: 'uppercase',
} as const;
