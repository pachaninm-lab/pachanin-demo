import type { UserRole } from '@/lib/platform-v7/grain-execution/types';
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

const groupStyle = {
  display: 'grid',
  gap: PLATFORM_V7_TOKENS.spacing.md,
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

const groupTitleStyle = {
  margin: 0,
  color: P7_THEME_CSS.color.textSecondary,
  fontSize: PLATFORM_V7_TOKENS.typography.body.size,
  lineHeight: PLATFORM_V7_TOKENS.typography.body.lineHeight,
  fontWeight: 800,
} as const;

const strongStyle = {
  margin: 0,
  color: P7_THEME_CSS.color.textPrimary,
  fontSize: PLATFORM_V7_TOKENS.typography.h3.size,
  lineHeight: PLATFORM_V7_TOKENS.typography.h3.lineHeight,
  fontWeight: PLATFORM_V7_TOKENS.typography.h3.weight,
} as const;

interface GrainActionFeedbackPanelProps {
  readonly role?: UserRole;
}

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

export function GrainActionFeedbackPanel({ role }: GrainActionFeedbackPanelProps = {}) {
  const ctx = getGrainExecutionContext();
  const actionFeedbackPreviews = role ? ctx.actionFeedbackPreviewsForRole(role) : ctx.actionFeedbackPreviews;
  const supportActionFeedback = role ? ctx.supportActionFeedbackForRole(role) : ctx.supportActionFeedback;
  const visibleSupportCaseIds = new Set(supportActionFeedback.map((feedback) => feedback.supportCaseId));
  const supportCases = role ? ctx.supportCases.filter((supportCase) => visibleSupportCaseIds.has(supportCase.id)) : ctx.supportCases;

  return (
    <P7Section
      surface='card'
      eyebrow='Результат действий'
      title='Что произойдёт после нажатия'
      subtitle='Показан тестовый след действия: статус, запись журнала и связанные обращения поддержки.'
    >
      <div style={groupStyle}>
        <p style={groupTitleStyle}>Действия по сделке</p>
        <div style={gridStyle}>
          {actionFeedbackPreviews.slice(0, 4).map((feedback) => (
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
      </div>
      <div style={groupStyle}>
        <p style={groupTitleStyle}>Связанные обращения</p>
        <div style={gridStyle}>
          {supportCases.slice(0, 3).map((supportCase) => (
            <div key={supportCase.id} style={cardStyle}>
              <StatusPill>{supportCase.priority}</StatusPill>
              <p style={strongStyle}>{supportCase.title}</p>
              <p style={microStyle}>Связь: {supportCase.relatedEntityType} {supportCase.relatedEntityId}</p>
              <p style={microStyle}>Следующее действие: {supportCase.nextActionTitle ?? supportCase.suggestedResolution}</p>
              <p style={microStyle}>Ответственный: {roleLabel[supportCase.nextActionRole ?? supportCase.requesterRole]}</p>
            </div>
          ))}
        </div>
      </div>
      <div style={gridStyle}>
        {ctx.supportCases.slice(0, 3).map((supportCase) => (
          <div key={supportCase.id} style={cardStyle}>
            <StatusPill>{supportCase.priority}</StatusPill>
            <p style={strongStyle}>{supportCase.title}</p>
            <p style={microStyle}>Связь: {supportCase.relatedEntityType} {supportCase.relatedEntityId}</p>
            <p style={microStyle}>Следующее действие: {supportCase.nextActionTitle ?? supportCase.suggestedResolution}</p>
            <p style={microStyle}>Ответственный: {roleLabel[supportCase.nextActionRole ?? supportCase.requesterRole]}</p>
          </div>
        ))}
      </div>
    </P7Section>
  );
}
