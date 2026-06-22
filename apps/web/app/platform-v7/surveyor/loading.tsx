import { RoleCockpitLoading } from '@/components/platform-v7/RoleCockpitLoading';

// Route-level loading state for a role cabinet without a dedicated layout.tsx.
// Thin wrapper around the shared neutral cockpit skeleton — consistency, not redesign.
export default function Loading() {
  return <RoleCockpitLoading />;
}
