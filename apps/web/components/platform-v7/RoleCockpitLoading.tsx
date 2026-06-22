import { Skeleton, SkeletonLines } from '@/components/platform-v7/Skeleton';

/**
 * RoleCockpitLoading — нейтральный скелет загрузки кабинета роли.
 *
 * Используется в route-level loading.tsx для ролевых сегментов без собственного
 * layout.tsx (lab, surveyor, compliance, arbitrator, support), чтобы дать единый
 * loading-стейт при навигации и загрузке данных. Это плейсхолдер, а не редизайн
 * кабинета: только тема-токены и канонический Skeleton, без бизнес-контента.
 */
export function RoleCockpitLoading() {
  return (
    <div role='status' aria-label='Загрузка кабинета' style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <Skeleton width={220} height={26} data-testid='role-cockpit-loading-title' />
        <Skeleton width='60%' height={14} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            style={{
              border: '1px solid var(--pc-border, #E4E6EA)',
              borderRadius: 16,
              padding: 18,
              display: 'grid',
              gap: 12,
            }}
          >
            <Skeleton width='40%' height={12} />
            <SkeletonLines lines={3} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default RoleCockpitLoading;
