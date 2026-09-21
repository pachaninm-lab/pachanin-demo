import { RoleCockpitLoading } from '@/components/platform-v7/RoleCockpitLoading';

// Preserve the protected operator shell geometry while its server-owned cockpit
// data resolves. This reuses the canonical neutral role skeleton and introduces
// no business data, role authority or alternate cabinet implementation.
export default function Loading() {
  return <RoleCockpitLoading />;
}
