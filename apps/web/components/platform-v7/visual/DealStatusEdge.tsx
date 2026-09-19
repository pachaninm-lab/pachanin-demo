'use client';

/**
 * DealStatusEdge — тонкая статусная полоса у карточек и deal workspace.
 *
 * Визуально показывает состояние объекта без лишнего текста.
 * 2–3px, без неона, без пульсации.
 *
 * Использование:
 *   <DealStatusEdge status="moving" />        // зелёный — сделка движется
 *   <DealStatusEdge status="waiting" />       // жёлтый — ждёт действие
 *   <DealStatusEdge status="blocked" />       // красный — стоп-фактор
 *   <DealStatusEdge status="money" />         // синий — деньги/банк
 *   <DealStatusEdge status="idle" />          // серый — нет активности
 *   <DealStatusEdge status="moving" position="left" thickness={3} />
 */

export type DealStatusEdgeStatus = 'moving' | 'waiting' | 'blocked' | 'money' | 'idle';
export type DealStatusEdgePosition = 'left' | 'top' | 'bottom' | 'right';

export interface DealStatusEdgeProps {
  readonly status: DealStatusEdgeStatus;
  /** Позиция полосы относительно родителя */
  readonly position?: DealStatusEdgePosition;
  /** Толщина в px. Default 3 */
  readonly thickness?: number;
  /** Скруглённые концы полосы */
  readonly rounded?: boolean;
  readonly className?: string;
  readonly 'data-testid'?: string;
}

const STATUS_COLORS: Record<DealStatusEdgeStatus, string> = {
  moving:  'var(--p7-color-success, #027A48)',
  waiting: 'var(--p7-color-warning, #B54708)',
  blocked: 'var(--p7-color-danger,  #B42318)',
  money:   'var(--p7-color-money,   #155EEF)',
  idle:    'var(--p7-color-border,  #D7DEE3)',
};

export function DealStatusEdge({
  status,
  position = 'left',
  thickness = 3,
  rounded = true,
  className,
  'data-testid': testId,
}: DealStatusEdgeProps) {
  const color = STATUS_COLORS[status];

  const style: React.CSSProperties = {
    position: 'absolute',
    background: color,
    borderRadius: rounded ? thickness * 2 : 0,
    flexShrink: 0,
  };

  if (position === 'left' || position === 'right') {
    style.top = rounded ? 6 : 0;
    style.bottom = rounded ? 6 : 0;
    style.width = thickness;
    style[position] = 0;
  } else {
    style.left = rounded ? 6 : 0;
    style.right = rounded ? 6 : 0;
    style.height = thickness;
    style[position] = 0;
  }

  return (
    <span
      role='presentation'
      aria-hidden='true'
      className={className}
      data-testid={testId ?? `p7-vil-deal-status-edge`}
      data-status={status}
      style={style}
    />
  );
}

/**
 * DealStatusEdgeWrapper — обёртка для карточки с DealStatusEdge.
 * Позволяет не добавлять position:relative вручную.
 */
export function DealStatusEdgeWrapper({
  children,
  status,
  position = 'left',
  thickness = 3,
  style: outerStyle,
}: {
  children: React.ReactNode;
  status: DealStatusEdgeStatus;
  position?: DealStatusEdgePosition;
  thickness?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', ...outerStyle }}>
      <DealStatusEdge status={status} position={position} thickness={thickness} />
      {children}
    </div>
  );
}
