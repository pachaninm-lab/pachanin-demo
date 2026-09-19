import type { CSSProperties, ReactNode } from 'react';

/**
 * EmptyState — премиальное пустое состояние (паттерн дорогих платформ).
 * Заголовок + пояснение + опциональное действие. Тема-токены, без фейков.
 */
export interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly 'data-testid'?: string;
}

const wrap: CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  gap: 8,
  textAlign: 'center',
  padding: '32px 20px',
  background: 'var(--pc-bg-card, #fff)',
  border: '1px dashed var(--pc-border-strong, #B9C4CC)',
  borderRadius: 16,
};

const mark: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--p7-color-surface-muted, #F2F6F0)',
  border: '1px solid var(--pc-border, #D7DEE3)',
  color: 'var(--pc-text-muted, #58606E)',
  fontSize: 18,
  marginBottom: 2,
};

export function EmptyState({ title, description, action, 'data-testid': testId }: EmptyStateProps) {
  return (
    <div role='status' data-testid={testId ?? 'platform-v7-empty-state'} style={wrap}>
      <span aria-hidden='true' style={mark}>∅</span>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{title}</div>
      {description ? (
        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--pc-text-secondary, #475569)', maxWidth: 420 }}>{description}</div>
      ) : null}
      {action ? <div style={{ marginTop: 6 }}>{action}</div> : null}
    </div>
  );
}
