import { P7Section } from '@/components/platform-v7/P7Section';
import { P7_THEME_CSS } from '@/components/platform-v7/p7Theme';
import { PLATFORM_V7_TOKENS } from '@/lib/platform-v7/design/tokens';
import { getGrainExecutionContext } from '@/lib/platform-v7/grain-execution/context';
import { roleLabel } from '@/lib/platform-v7/grain-execution/format';

const cardStyle = {
  border: `1px solid ${P7_THEME_CSS.color.border}`,
  borderRadius: PLATFORM_V7_TOKENS.radius.lg,
  background: P7_THEME_CSS.surface.card,
  padding: PLATFORM_V7_TOKENS.spacing.md,
  display: 'grid',
  gap: PLATFORM_V7_TOKENS.spacing.sm,
  minWidth: 0,
} as const;

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: PLATFORM_V7_TOKENS.spacing.md,
} as const;

const microStyle = {
  margin: 0,
  color: P7_THEME_CSS.color.textMuted,
  fontSize: PLATFORM_V7_TOKENS.typography.caption.size,
  lineHeight: PLATFORM_V7_TOKENS.typography.caption.lineHeight,
} as const;

const strongStyle = {
  margin: 0,
  color: P7_THEME_CSS.color.textPrimary,
  fontSize: PLATFORM_V7_TOKENS.typography.h3.size,
  lineHeight: PLATFORM_V7_TOKENS.typography.h3.lineHeight,
  fontWeight: PLATFORM_V7_TOKENS.typography.h3.weight,
} as const;

function StatusPill({ children }: { readonly children: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        width: 'fit-content',
        borderRadius: PLATFORM_V7_TOKENS.radius.pill,
        border: `1px solid ${P7_THEME_CSS.color.border}`,
        background: P7_THEME_CSS.color.surfaceMuted,
        color: P7_THEME_CSS.color.textSecondary,
        padding: '5px 9px',
        fontSize: PLATFORM_V7_TOKENS.typography.caption.size,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

export function GrainActionFeedbackPanel() {
  const ctx = getGrainExecutionContext();

  return (
    <P7Section
      surface='card'
      eyebrow='Результат действий'
      title='Что произойдёт после нажатия'
      subtitle='Показан controlled-pilot след действия: статус, основание аудита и граница внешнего подтверждения. Банк, ФГИС и ЭДО не имитируются.'
    >
      <div style={gridStyle}>
        {ctx.actionFeedbackPreviews.slice(0, 4).map((feedback) => (
          <div key={feedback.actionId} style={cardStyle}>
            <StatusPill>{feedback.title}</StatusPill>
            <p style={strongStyle}>{feedback.statusText}</p>
            <p style={microStyle}>Журнал: {feedback.auditEvent.action}</p>
            <p style={microStyle}>Роль: {roleLabel[feedback.auditEvent.actorRole]}</p>
            <p style={microStyle}>{feedback.auditEvent.reason}</p>
            <p style={microStyle}>{feedback.externalConfirmationText}</p>
          </div>
        ))}
      </div>
    </P7Section>
  );
}
