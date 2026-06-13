import type { CSSProperties } from 'react';

/**
 * Skeleton — премиальный плейсхолдер загрузки (shimmer под no-preference).
 * Используется для строк/карточек, пока данные грузятся. Тема-токены.
 */
export interface SkeletonProps {
  readonly width?: number | string;
  readonly height?: number | string;
  readonly radius?: number;
  readonly 'data-testid'?: string;
}

export function Skeleton({ width = '100%', height = 14, radius = 8, 'data-testid': testId }: SkeletonProps) {
  const style: CSSProperties = {
    display: 'block',
    width,
    height,
    borderRadius: radius,
    background: 'var(--p7-color-surface-strong, #EFEAE0)',
  };
  return <span aria-hidden='true' data-testid={testId} className='p7-skeleton' style={style} />;
}

/** Готовый блок из нескольких строк-скелетонов */
export function SkeletonLines({ lines = 3, gap = 8 }: { readonly lines?: number; readonly gap?: number }) {
  return (
    <span role='status' aria-label='Загрузка' style={{ display: 'grid', gap }}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} width={index === lines - 1 ? '60%' : '100%'} />
      ))}
    </span>
  );
}
