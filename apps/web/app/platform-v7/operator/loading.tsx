import { RoleCockpitLoading } from '@/components/platform-v7/RoleCockpitLoading';

// Preserve the protected operator shell geometry while its server-owned cockpit
// data resolves. Reuse the existing protected-shell height reservation so
// below-fold chrome cannot enter the viewport and shift when the RSC resolves.
export default function Loading() {
  return (
    <div className='p7-route-loading'>
      <RoleCockpitLoading />
    </div>
  );
}
