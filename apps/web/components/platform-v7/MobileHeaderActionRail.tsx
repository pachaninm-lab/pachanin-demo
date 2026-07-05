'use client';

/*
  Mobile role tools were previously injected into `.pc-v4-actions` through a portal.
  That caused first-load / refresh drift: the first render showed an extra hamburger,
  theme button and competing controls; after refresh the header normalized.

  The canonical mobile actions now live in AppShellV4 + PlatformV7ShellUxController:
  left menu, brand, compact search, bottom dock and overflow `Ещё`.
  Keep this component as a no-op compatibility shim so old imports do not reintroduce
  duplicate header actions.
*/
export function MobileHeaderActionRail() {
  return null;
}
