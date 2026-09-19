import { platformV7RoleRoute } from '@/lib/platform-v7/shellRoutes';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

/**
 * Legacy handoff key retained only for controlled owner-navigation compatibility.
 * It is never read by protected route authorization or shell selection.
 */
export const PLATFORM_V7_ACTIVE_ROLE_KEY = 'pc-v7-active-role';

export function platformV7RoleHome(role: PlatformRole): string {
  return platformV7RoleRoute(role);
}

/**
 * Compatibility no-op. Authentication and RBAC are enforced by the server
 * layout from the cryptographically verified cabinet/access JWT. A writable
 * sessionStorage value, URL, query or presentation store must never redirect,
 * authorize or select a protected cabinet.
 */
export function PlatformV7SingleEntryGuard() {
  return null;
}
