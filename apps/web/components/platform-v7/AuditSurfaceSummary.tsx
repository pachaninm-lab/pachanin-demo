'use client';

import Link from 'next/link';
import { P7Badge } from '@/components/platform-v7/P7Badge';
import { PLATFORM_V7_TOKENS, getPlatformV7ToneTokens, type PlatformV7Tone } from '@/lib/platform-v7/design/tokens';

type AuditSurface = 'bank' | 'documents' | 'disputes';

type AuditSurfaceConfig = {
  title: string;
  tone: PlatformV7Tone;
  status: string;
  now: string;
  money: string;
  blocker: string;
  evidence: string;
  next: string;
  hidden: string;
  cta: string;
  href: string;
};

export const PLATFORM_V7_AUDIT_SURFACES: Record<AuditSurface, AuditSurfaceConfig> = {
  bank: {
    title: 'Банковский контур',
    tone: 'bank',
    status: 'нет фальшивой выплаты',
    now: 'DL-9106: резерв виден, выпуск денег закрыт до документов, приёмки, качества и спора',
    money: 'резерв, к выпуску, удержание и деньги под риском показаны как разные состояния одной сделки',
    blocker: 'выпуск не разрешён без СДИЗ, ЭТрН, УПД, акта, качества и закрытого спора',
    evidence: 'основания выпуска должны ссылаться на документы, рейс, приёмку, протокол и журнал действий',
    next: 'банк или оператор подтверждает условие выпуска только после закрытия всех оснований',
    hidden: 'скрыто: кнопка выплаты без условий, имитация live-платежа, ручной обход без журнала',
    cta: 'Проверить условия выпуска',
    href: '/platform-v7/bank',
  },
  documents: {
    title: 'Документный контур',
    tone: 'document',
    status: 'источник → ответственный → статус → влияние на деньги',
    now: 'пакет сделки не является архивом: каждый документ должен объяснять, что именно блокирует выпуск денег',
    money: 'СДИЗ, ЭТрН, УПД, акт, КЭП и протокол качества прямо влияют на выпуск, удержание или спор',
    blocker: 'внутренняя карточка документа не заменяет ФГИС «Зерно», ЭДО, ГИС ЭПД и КЭП',
    evidence: 'у каждого документа видны источник, ответственный, статус, связанная сделка и след в журнале',
    next: 'ответственная роль закрывает недостающий документ или оператор фиксирует причину остановки',
    hidden: 'скрыто: fake-ready документ, неясный источник, неподписанный файл как юридически готовое основание',
    cta: 'Открыть пакет документов',
    href: '/platform-v7/documents',
  },
  disputes: {
    title: 'Контур спора',
    tone: 'dispute',
    status: 'доказательства до решения',
    now: 'спор показывает причину, сумму влияния, SLA, владельца, доказательства и следующий шаг',
    money: 'сумма под риском связана с удержанием или запретом выпуска денег по конкретной сделке',
    blocker: 'спор нельзя закрыть без доказательного пакета, основания решения и следа в журнале',
    evidence: 'фото, GPS, вес, пломба, лаборатория, документы и комментарии сторон собираются в единый пакет',
    next: 'арбитр или оператор запрашивает доказательство, фиксирует решение и влияние на деньги',
    hidden: 'скрыто: устное решение, ручное закрытие без причины, спор без суммы влияния',
    cta: 'Открыть споры',
    href: '/platform-v7/disputes',
  },
};

export function AuditSurfaceSummary({ surface }: { surface: AuditSurface }) {
  const config = PLATFORM_V7_AUDIT_SURFACES[surface];
  const tone = getPlatformV7ToneTokens(config.tone);
  const rows = [
    ['Что происходит сейчас', config.now],
    ['Где деньги', config.money],
    ['Что блокирует', config.blocker],
    ['Доказательства', config.evidence],
    ['Кто следующий', config.next],
  ] as const;

  return (
    <section
      data-testid={`platform-v7-audit-surface-${surface}`}
      style={{
        display: 'grid',
        gap: PLATFORM_V7_TOKENS.spacing.md,
        border: `1px solid ${tone.border}`,
        borderRadius: PLATFORM_V7_TOKENS.radius.xl,
        background: PLATFORM_V7_TOKENS.color.surface,
        padding: PLATFORM_V7_TOKENS.spacing.lg,
        boxShadow: PLATFORM_V7_TOKENS.shadow.soft,
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: PLATFORM_V7_TOKENS.spacing.md, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.xs, maxWidth: 850 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: PLATFORM_V7_TOKENS.spacing.xs }}>
            <P7Badge tone={config.tone}>{config.title}</P7Badge>
            <P7Badge tone='warning'>controlled-pilot</P7Badge>
            <P7Badge tone='neutral'>simulation-grade</P7Badge>
          </div>
          <h1
            style={{
              margin: 0,
              color: PLATFORM_V7_TOKENS.color.textPrimary,
              fontSize: `clamp(24px, 5vw, ${PLATFORM_V7_TOKENS.typography.h1.size}px)`,
              lineHeight: PLATFORM_V7_TOKENS.typography.h1.lineHeight,
              fontWeight: PLATFORM_V7_TOKENS.typography.h1.weight,
              letterSpacing: PLATFORM_V7_TOKENS.typography.h1.letterSpacing,
            }}
          >
            {config.title}: деньги, основание, блокер и действие
          </h1>
          <p style={{ margin: 0, color: PLATFORM_V7_TOKENS.color.textSecondary, fontSize: PLATFORM_V7_TOKENS.typography.body.size, lineHeight: PLATFORM_V7_TOKENS.typography.body.lineHeight }}>
            {config.status}. {config.hidden}.
          </p>
        </div>
        <Link href={config.href} style={{ ...primaryActionStyle, background: tone.fg }}>
          {config.cta}
        </Link>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: PLATFORM_V7_TOKENS.spacing.sm }}>
        {rows.map(([label, value]) => (
          <article key={label} style={{ border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: PLATFORM_V7_TOKENS.radius.md, background: tone.bg, padding: PLATFORM_V7_TOKENS.spacing.sm }}>
            <div style={{ color: tone.fg, fontSize: PLATFORM_V7_TOKENS.typography.micro.size, lineHeight: PLATFORM_V7_TOKENS.typography.micro.lineHeight, fontWeight: PLATFORM_V7_TOKENS.typography.micro.weight, letterSpacing: PLATFORM_V7_TOKENS.typography.micro.letterSpacing, textTransform: 'uppercase' }}>
              {label}
            </div>
            <p style={{ margin: `${PLATFORM_V7_TOKENS.spacing.xs}px 0 0`, color: PLATFORM_V7_TOKENS.color.textPrimary, fontSize: 13, lineHeight: 1.45, fontWeight: 760 }}>
              {value}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

const primaryActionStyle = {
  textDecoration: 'none',
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '11px 14px',
  borderRadius: PLATFORM_V7_TOKENS.radius.md,
  color: PLATFORM_V7_TOKENS.color.surface,
  fontSize: 14,
  fontWeight: 850,
} as const;
