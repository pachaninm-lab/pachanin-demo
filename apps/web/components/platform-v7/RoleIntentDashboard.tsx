import { CanonicalDealWorkspace } from '@/components/platform-v7/CanonicalDealWorkspace';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

/**
 * Every role opens the same canonical Deal Workspace.
 *
 * Role-specific differences are supplied by the authenticated backend projection:
 * facts, identifiers and deal state never diverge between cabinets.
 */
export function RoleIntentDashboard({ role }: { role: PlatformRole }) {
  return <CanonicalDealWorkspace role={role} />;
}
