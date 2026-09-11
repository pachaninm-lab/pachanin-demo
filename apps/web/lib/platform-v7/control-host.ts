export const PRIMARY_PLATFORM_HOST = 'xn----8sbjf4befbjgs9b.xn--p1ai';
export const CONTROL_PLATFORM_HOST = `control.${PRIMARY_PLATFORM_HOST}`;

export const OWNER_CONTROLLED_CABINET_TARGETS = {
  operator: '/platform-v7/operator',
  buyer: '/platform-v7/buyer',
  seller: '/platform-v7/seller',
  logistics: '/platform-v7/logistics',
  driver: '/platform-v7/driver/field',
  surveyor: '/platform-v7/surveyor',
  elevator: '/platform-v7/elevator',
  lab: '/platform-v7/lab',
  bank: '/platform-v7/bank',
  organization: '/platform-v7/profile',
  arbitrator: '/platform-v7/arbitrator',
  compliance: '/platform-v7/compliance',
  executive: '/platform-v7/executive',
} as const;

export type OwnerControlledCabinetRole = keyof typeof OWNER_CONTROLLED_CABINET_TARGETS;

const OWNER_CONTROLLED_CABINET_ROLE_BY_PATH = new Map<string, OwnerControlledCabinetRole>(
  Object.entries(OWNER_CONTROLLED_CABINET_TARGETS).map(([role, pathname]) => (
    [pathname, role as OwnerControlledCabinetRole]
  )),
);

export function ownerControlledCabinetRole(pathname: string): OwnerControlledCabinetRole | null {
  return OWNER_CONTROLLED_CABINET_ROLE_BY_PATH.get(pathname) ?? null;
}

export type OwnerControlledCabinetSession = {
  readonly role: string | null | undefined;
  readonly userId: string | null | undefined;
  readonly ownerAccess: boolean;
  readonly organizationId: string | null | undefined;
  readonly tenantId: string | null | undefined;
};

export function ownerCabinetSessionMatchesRoot(
  pathname: string,
  session: OwnerControlledCabinetSession | null | undefined,
  expected: {
    readonly role: string;
    readonly organizationId: string;
    readonly tenantId: string;
  } | null | undefined,
): boolean {
  const role = ownerControlledCabinetRole(pathname);
  return role !== null
    && session?.ownerAccess === true
    && typeof session.userId === 'string'
    && session.userId.trim().length > 0
    && session.role === role
    && expected !== null
    && expected !== undefined
    && expected.role === role
    && session.organizationId === expected.organizationId
    && session.tenantId === expected.tenantId;
}

const CONTROL_PAGE_EXACT = new Set([
  '/platform-v7/login',
  '/platform-v7/forgot-password',
  '/platform-v7/reset-password',
  '/platform-v7/mfa-recovery',
]);

const CONTROL_API_EXACT = new Set([
  '/api/auth/forgot-password',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/auth/membership-select',
  '/api/auth/mfa-login',
  '/api/auth/mfa-recovery',
  '/api/auth/mfa-step-up',
  '/api/auth/refresh',
  '/api/auth/reset-password',
]);

const CONTROL_API_PREFIX = [
  '/api/auth/forgot-password/',
  '/api/auth/mfa-login/',
  '/api/auth/mfa-recovery/',
  '/api/auth/mfa-step-up/',
  '/api/auth/reset-password/',
  '/api/staff/',
] as const;

const SAFE_STATIC_FILE = /\.(?:css|js|mjs|map|json|webmanifest|ico|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|otf|eot)$/i;

export function controlHostEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.PC_CONTROL_HOST_ENABLED || '').trim().toLowerCase() === 'true';
}

export function normalizeAuthorityHost(value: string | null | undefined): string {
  let raw = String(value || '').trim().toLowerCase();
  if (!raw || /[\s,@/\\]/.test(raw) || raw.startsWith('[')) return '';
  if (raw.endsWith('.')) raw = raw.slice(0, -1);
  const colon = raw.lastIndexOf(':');
  if (colon >= 0) {
    if (raw.indexOf(':') !== colon) return '';
    const port = raw.slice(colon + 1);
    if (!/^\d{1,5}$/.test(port)) return '';
    const portNumber = Number(port);
    if (portNumber < 1 || portNumber > 65535) return '';
    raw = raw.slice(0, colon);
  }
  if (!raw || raw.length > 253) return '';
  const labels = raw.split('.');
  if (labels.some((label) => (
    !label
    || label.length > 63
    || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  ))) return '';
  return raw;
}

export function requestAuthorityHost(request: Pick<Request, 'headers'>): string {
  // `Host` is the authority received by this application boundary. Do not use
  // X-Forwarded-Host as a privilege signal: it is frequently client supplied.
  return normalizeAuthorityHost(request.headers.get('host'));
}

export function isCanonicalControlAuthority(request: Pick<Request, 'headers'>): boolean {
  return requestAuthorityHost(request) === CONTROL_PLATFORM_HOST;
}

export function isControlHostRequest(
  request: Pick<Request, 'headers'>,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return controlHostEnabled(env) && isCanonicalControlAuthority(request);
}

export function isPrimaryPlatformHostRequest(request: Pick<Request, 'headers'>): boolean {
  return requestAuthorityHost(request) === PRIMARY_PLATFORM_HOST;
}

export function requiresCanonicalControlHost(
  request: Pick<Request, 'headers'>,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return controlHostEnabled(env) && !isCanonicalControlAuthority(request);
}

export function isControlRealmPathAllowed(pathname: string): boolean {
  if (pathname === '/platform-v7/staff' || pathname.startsWith('/platform-v7/staff/')) return true;
  if (CONTROL_PAGE_EXACT.has(pathname) || CONTROL_API_EXACT.has(pathname)) return true;
  if (CONTROL_API_PREFIX.some((prefix) => pathname.startsWith(prefix))) return true;
  if (pathname.startsWith('/_next/')) return true;
  if (pathname === '/favicon.ico' || pathname.startsWith('/icon') || pathname.startsWith('/apple-icon')) return true;
  return !pathname.startsWith('/api/') && SAFE_STATIC_FILE.test(pathname);
}

export function controlHostUrl(pathname: string, search = ''): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `https://${CONTROL_PLATFORM_HOST}${path}${search.startsWith('?') || !search ? search : `?${search}`}`;
}

export function primaryPlatformUrl(pathname: string, search = ''): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `https://${PRIMARY_PLATFORM_HOST}${path}${search.startsWith('?') || !search ? search : `?${search}`}`;
}
