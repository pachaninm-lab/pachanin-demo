export const PLATFORM_V7_PILOT_NOTE_HIDDEN_ROUTES = new Set([
  '/platform-v7',
  '/platform-v7/roles',
  '/platform-v7/offer-to-deal',
]);

export function shouldShowPlatformV7PilotNote(pathname: string): boolean {
  const cleanPathname = pathname.split('?')[0] || pathname;
  return !PLATFORM_V7_PILOT_NOTE_HIDDEN_ROUTES.has(cleanPathname);
}
