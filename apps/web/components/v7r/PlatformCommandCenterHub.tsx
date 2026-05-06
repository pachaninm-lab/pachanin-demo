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
  { label: 'ставка', value: 'выбрана', tone: 'success' },
  { label: 'сделка', value: deal.id, tone: 'bank' },
  { label: 'резерв', value: formatRub(money.reservedRub), tone: 'money' },
  { label: 'рейс', value: logistics.tripId, tone: 'logistics' },
  { label: 'приёмка', value: logistics.currentLeg, tone: 'warning' },
  { label: 'СДИЗ', value: documents.sdizStatus, tone: 'document' },
  { label: 'выпуск денег', value: formatRub(money.releaseCandidateRub), tone: 'money' },
  { label: 'спор', value: dispute.status, tone: 'dispute' },
];

const FAST_ANSWERS = [
  { label: 'Сделка', value: `${deal.lotId} → ${deal.id}`, note: `${formatTons(deal.volumeTons)} · ${formatRub(expectedDealAmount)} · готовность ${readinessScore}%` },
  { label: 'Деньги', value: `${formatRub(money.reservedRub)} в резерве`, note: `${formatRub(money.releaseCandidateRub)} можно выпускать только после закрытия условий.` },
  { label: 'Груз', value: logistics.currentLeg, note: `${logistics.pickupPoint} → ${logistics.deliveryPoint}. Срок: ${logistics.eta}.` },
  { label: 'Документы', value: `СДИЗ: ${documents.sdizStatus}`, note: `Не хватает: ${documents.missingDocuments.join(', ')}.` },
  { label: 'Блокер', value: blockers.length > 0 ? `${blockers.length} активных` : 'нет критического стопа', note: firstBlocker },
  { label: 'Следующий шаг', value: blockers.length > 0 ? 'закрыть блокер' : 'проверить выпуск денег', note: 'Каждое действие должно оставлять запись в журнале.' },
] as const;

const ROLE_ENTRY_POINTS: readonly { label: string; href: string; role: PlatformRole; tone: string; text: string }[] = [
  { label: 'Продавец', href: '/platform-v7/seller?as=seller', role: 'seller', tone: PLATFORM_V7_TOKENS.color.brand, text: 'партия, лот, оффер, документы, причина задержки денег' },
  { label: 'Покупатель', href: '/platform-v7/buyer?as=buyer', role: 'buyer', tone: PLATFORM_V7_TOKENS.color.money, text: 'заявка, ставка, резерв, приёмка, следующий шаг' },
  { label: 'Логистика', href: '/platform-v7/logistics?as=logistics', role: 'logistics', tone: PLATFORM_V7_TOKENS.color.logistics, text: 'заявка, водитель, машина, срок, документы рейса' },
  { label: 'Водитель', href: '/platform-v7/driver?as=driver', role: 'driver', tone: PLATFORM_V7_TOKENS.color.textSecondary, text: 'один рейс, маршрут, фото, пломба, проблема' },
  { label: 'Банк', href: '/platform-v7/bank?as=bank', role: 'bank', tone: PLATFORM_V7_TOKENS.color.bank, text: 'резерв, удержание, условия выпуска, ручная проверка' },
  { label: 'Оператор', href: '/platform-v7/control-tower?as=operator', role: 'operator', tone: PLATFORM_V7_TOKENS.color.dispute, text: 'очередь блокеров, ответственный, срок, журнал' },
] as const;

export function PlatformCommandCenterHub() {
  const { setRole } = usePlatformV7RStore();

  return (
    <main style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.lg, padding: '4px 0 32px' }}>
      <P7Hero
        eyebrow={
          <span style={{ display: 'inline-flex', gap: PLATFORM_V7_TOKENS.spacing.xs, flexWrap: 'wrap' }}>
            <P7Badge tone='info'>контролируемый пилот</P7Badge>
            <P7Badge tone='warning'>тестовый контур</P7Badge>
            <P7Badge tone='neutral'>не промышленная эксплуатация</P7Badge>
          </span>
        }
        title='Центр исполнения сделки'
        subtitle='Один экран: деньги, груз, документы, блокер и следующий ответственный.'
        actions={
          <>
            <Link href='/platform-v7/control-tower/grain' style={primaryCta}>Открыть сделку</Link>
            <Link href={`/platform-v7/deals/${deal.id}/clean`} style={secondaryCta}>Карточка сделки</Link>
          </>
        }
        testId='platform-command-center-hero'
      >
        <P7DealSpine steps={DEAL_SPINE_STEPS} testId='platform-command-center-spine' />
      </P7Hero>

      <P7Section
        eyebrow='рабочая сводка'
        title='Что происходит сейчас'
        subtitle='Короткая операционная картина без презентационного текста.'
        surface='card'
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: PLATFORM_V7_TOKENS.spacing.sm }}>
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
        eyebrow='основной вход'
        title='Проверить сделку от партии до денег'
        subtitle='Партия, закупочный запрос, приёмка, документы, СДИЗ, удержание, спор и основание выпуска денег.'
        surface='card'
      >
        <Link href='/platform-v7/control-tower/grain' style={grainEntryStyle}>
          <span style={{ width: 48, height: 4, borderRadius: PLATFORM_V7_TOKENS.radius.pill, background: PLATFORM_V7_TOKENS.color.brand }} />
          <strong style={{ color: PLATFORM_V7_TOKENS.color.textPrimary, fontSize: 22, lineHeight: 1.15, letterSpacing: '-0.03em' }}>Рабочий контур сделки</strong>
          <span style={{ color: PLATFORM_V7_TOKENS.color.textSecondary, fontSize: 14, lineHeight: 1.55 }}>Переход в операционный экран, где видно, что остановлено, кем, почему и что нужно сделать дальше.</span>
          <span style={{ color: PLATFORM_V7_TOKENS.color.brand, fontSize: 13, fontWeight: 850 }}>Перейти</span>
        </Link>
      </P7Section>

      <P7Section
        eyebrow='роли'
        title='Ролевые входы скрыты в меню'
        subtitle='Пользователь не видит лишние кабинеты, пока сам не откроет нужную роль.'
        surface='card'
      >
        <details style={detailsStyle}>
          <summary style={summaryStyle}>Открыть список ролей</summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: PLATFORM_V7_TOKENS.spacing.sm, marginTop: PLATFORM_V7_TOKENS.spacing.md }}>
            {ROLE_ENTRY_POINTS.map((entry) => (
              <Link
                key={entry.label}
                href={entry.href}
                onClick={() => setRole(entry.role)}
                style={roleEntryStyle}
              >
                <span style={{ width: 36, height: 4, borderRadius: PLATFORM_V7_TOKENS.radius.pill, background: entry.tone }} />
                <strong style={{ color: PLATFORM_V7_TOKENS.color.textPrimary, fontSize: 17, lineHeight: 1.2 }}>{entry.label}</strong>
                <span style={{ color: PLATFORM_V7_TOKENS.color.textSecondary, fontSize: 13, lineHeight: 1.5 }}>{entry.text}</span>
              </Link>
            ))}
          </div>
        </details>
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

const grainEntryStyle = {
  display: 'grid',
  gap: PLATFORM_V7_TOKENS.spacing.sm,
  textDecoration: 'none',
  border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`,
  borderRadius: PLATFORM_V7_TOKENS.radius.lg,
  background: PLATFORM_V7_TOKENS.color.surface,
  padding: PLATFORM_V7_TOKENS.spacing.md,
} as const;

const answerCardStyle = {
  display: 'grid',
  gap: PLATFORM_V7_TOKENS.spacing.xs,
  minHeight: 120,
  border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`,
  borderRadius: PLATFORM_V7_TOKENS.radius.lg,
  background: PLATFORM_V7_TOKENS.color.surfaceMuted,
  padding: PLATFORM_V7_TOKENS.spacing.md,
} as const;

const detailsStyle = {
  border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`,
  borderRadius: PLATFORM_V7_TOKENS.radius.lg,
  background: PLATFORM_V7_TOKENS.color.surface,
  padding: PLATFORM_V7_TOKENS.spacing.md,
} as const;

const summaryStyle = {
  cursor: 'pointer',
  color: PLATFORM_V7_TOKENS.color.textPrimary,
  fontSize: 14,
  fontWeight: 850,
} as const;

const roleEntryStyle = {
  display: 'grid',
  gap: PLATFORM_V7_TOKENS.spacing.xs,
  textDecoration: 'none',
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
