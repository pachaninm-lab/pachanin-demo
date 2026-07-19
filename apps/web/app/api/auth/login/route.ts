import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  applyAuthenticatedSession,
  normalizeSurfaceRole,
  platformHome,
  type AuthenticatedSessionPayload,
} from '../../../../lib/server/auth-session-response';
import {
  MFA_PENDING_COOKIE,
  clearMfaPendingCookieOptions,
  mfaPendingCookieOptions,
  sealMfaLoginTicket,
} from '../../../../lib/server/mfa-login-ticket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const UNIVERSAL_ERROR = 'Не удалось войти. Проверь данные или восстанови доступ.';
const CONTROLLED_TTL_SECONDS = 8 * 60 * 60;

type ApiLoginPayload = Partial<AuthenticatedSessionPayload> & {
  mfaRequired?: boolean;
  challengeToken?: string;
  challengeExpiresAt?: string;
  setupSecret?: string;
  otpAuthUri?: string;
  staffOwner?: boolean;
  user?: AuthenticatedSessionPayload['user'];
};

type ControlledAccount = {
  email: string;
  role: string;
  surfaceRole: string;
  cabinetRole: string;
  owner: boolean;
  fullName: string;
  organizationId: string;
};

const ROLE_ACCOUNTS: Readonly<Record<string, Omit<ControlledAccount, 'email'>>> = {
  'operator.test@procent-agro.test': { role: 'SUPPORT_MANAGER', surfaceRole: 'operator', cabinetRole: 'operator', owner: false, fullName: 'Тестовый оператор', organizationId: 'org-canonical-platform' },
  'buyer.test@procent-agro.test': { role: 'BUYER', surfaceRole: 'buyer', cabinetRole: 'buyer', owner: false, fullName: 'Тестовый покупатель', organizationId: 'org-canonical-buyer' },
  'seller.test@procent-agro.test': { role: 'FARMER', surfaceRole: 'seller', cabinetRole: 'seller', owner: false, fullName: 'Тестовый продавец', organizationId: 'org-canonical-seller' },
  'logistics.test@procent-agro.test': { role: 'LOGISTICIAN', surfaceRole: 'logistics', cabinetRole: 'logistics', owner: false, fullName: 'Тестовый логист', organizationId: 'org-canonical-logistics' },
  'driver.test@procent-agro.test': { role: 'DRIVER', surfaceRole: 'driver', cabinetRole: 'driver', owner: false, fullName: 'Тестовый водитель', organizationId: 'org-canonical-logistics' },
  'surveyor.test@procent-agro.test': { role: 'SURVEYOR', surfaceRole: 'surveyor', cabinetRole: 'surveyor', owner: false, fullName: 'Тестовый сюрвейер', organizationId: 'org-canonical-surveyor' },
  'elevator.test@procent-agro.test': { role: 'ELEVATOR', surfaceRole: 'elevator', cabinetRole: 'elevator', owner: false, fullName: 'Тестовый элеватор', organizationId: 'org-canonical-elevator' },
  'lab.test@procent-agro.test': { role: 'LAB', surfaceRole: 'lab', cabinetRole: 'lab', owner: false, fullName: 'Тестовая лаборатория', organizationId: 'org-canonical-lab' },
  'bank.test@procent-agro.test': { role: 'ACCOUNTING', surfaceRole: 'bank', cabinetRole: 'bank', owner: false, fullName: 'Тестовый банковский сотрудник', organizationId: 'org-canonical-bank' },
  'arbitrator.test@procent-agro.test': { role: 'ARBITRATOR', surfaceRole: 'arbitrator', cabinetRole: 'arbitrator', owner: false, fullName: 'Тестовый арбитр', organizationId: 'org-canonical-platform' },
  'compliance.test@procent-agro.test': { role: 'COMPLIANCE_OFFICER', surfaceRole: 'compliance', cabinetRole: 'compliance', owner: false, fullName: 'Тестовый комплаенс', organizationId: 'org-canonical-platform' },
  'executive.test@procent-agro.test': { role: 'EXECUTIVE', surfaceRole: 'executive', cabinetRole: 'executive', owner: false, fullName: 'Тестовый руководитель', organizationId: 'org-canonical-platform' },
};

function readEnv(name: string): string {
  return String(process.env[name] || '').trim();
}

function controlledAccessEnabled(): boolean {
  if (readEnv('PC_CABINET_TEST_ACCESS').toLowerCase() !== 'true') return false;
  const expiresAt = readEnv('PC_CABINET_TEST_ACCESS_EXPIRES_AT');
  if (!expiresAt) return false;
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry > Date.now();
}

function controlledSecret(): string {
  return readEnv('JWT_SECRET') || readEnv('PC_CABINET_SESSION_SECRET');
}

function digest(value: string): Buffer {
  return createHmac('sha256', 'pc-controlled-login-compare').update(value).digest();
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  return timingSafeEqual(digest(a), digest(b));
}

function base64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function signControlledToken(account: ControlledAccount, signingSecret: string, tokenType: 'access' | 'refresh'): string {
  const now = Math.floor(Date.now() / 1000);
  const ttl = tokenType === 'access' ? CONTROLLED_TTL_SECONDS : CONTROLLED_TTL_SECONDS + 60 * 60;
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  // The backend identifies the actor by the `id` claim. The owner maps to the
  // bootstrapped PLATFORM_OWNER user so the staff control centre resolves the
  // real assignment; role accounts get a stable synthetic id.
  const subjectId = account.owner ? 'usr-platform-owner' : `test:${account.surfaceRole}`;
  const payload = base64Url(JSON.stringify({
    sub: subjectId,
    id: subjectId,
    email: account.email,
    role: account.role,
    orgId: account.organizationId,
    surfaceRole: account.surfaceRole,
    cab: account.cabinetRole,
    owner: account.owner,
    testAccess: true,
    tokenType,
    organizationId: account.organizationId,
    tenantId: 'tenant-canonical-test',
    fullName: account.fullName,
    jti: randomUUID(),
    iat: now,
    exp: now + ttl,
  }));
  const signature = createHmac('sha256', signingSecret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function controlledPayload(email: string, password: string): { recognized: boolean; payload?: ApiLoginPayload } {
  if (!controlledAccessEnabled()) return { recognized: false };
  const signingSecret = controlledSecret();
  if (!signingSecret) return { recognized: false };

  const configuredOwnerEmail = readEnv('PC_CABINET_LOCK_USER').toLowerCase();
  const ownerPasswords = [readEnv('PC_CABINET_LOCK_PASSWORD'), readEnv('PC_PRIVATE_PASSWORD'), readEnv('PC_OWNER_KEY')].filter(Boolean);
  const rolePassword = readEnv('PC_CABINET_ROLE_PASSWORD');

  let account: ControlledAccount | null = null;
  let passwordAccepted = false;

  if (configuredOwnerEmail && safeEqual(email, configuredOwnerEmail)) {
    account = {
      email,
      role: 'ADMIN',
      surfaceRole: 'operator',
      cabinetRole: 'operator',
      owner: true,
      fullName: 'Максим — владелец платформы',
      organizationId: 'org-canonical-platform',
    };
    passwordAccepted = ownerPasswords.some((candidate) => safeEqual(password, candidate));
  } else if (ROLE_ACCOUNTS[email]) {
    account = { email, ...ROLE_ACCOUNTS[email] };
    passwordAccepted = Boolean(rolePassword && safeEqual(password, rolePassword));
  }

  if (!account) return { recognized: false };
  if (!passwordAccepted) return { recognized: true };

  return {
    recognized: true,
    payload: {
      accessToken: signControlledToken(account, signingSecret, 'access'),
      refreshToken: signControlledToken(account, signingSecret, 'refresh'),
      expiresIn: CONTROLLED_TTL_SECONDS,
      staffOwner: account.owner,
      user: { email: account.email, role: account.role, surfaceRole: account.surfaceRole },
    },
  };
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function requestIp(request: Request) {
  return (
    request.headers.get('x-nf-client-connection-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    ''
  );
}

function forwardedHeaders(request: Request, correlationId: string) {
  const ip = requestIp(request);
  const userAgent = request.headers.get('user-agent');
  return {
    'Content-Type': 'application/json',
    'x-correlation-id': correlationId,
    ...(ip ? { 'x-forwarded-for': ip } : {}),
    ...(userAgent ? { 'user-agent': userAgent } : {}),
  };
}

async function completeSession(payload: ApiLoginPayload, correlationId: string) {
  if (!payload.accessToken || !payload.refreshToken || !payload.user?.email || !payload.user?.role) {
    console.error('auth_service_incomplete_session', JSON.stringify({ correlationId }));
    return json({ ok: false, code: 'AUTH_SERVICE_INVALID_RESPONSE', message: UNIVERSAL_ERROR, correlationId }, 502);
  }

  const role = normalizeSurfaceRole(payload.user.role, payload.user.surfaceRole);
  const response = json({
    ok: true,
    mfaRequired: false,
    redirectTo: payload.staffOwner ? '/platform-v7/staff' : platformHome(role),
    correlationId,
  });
  const session = await applyAuthenticatedSession(response, payload as AuthenticatedSessionPayload);
  if (!session) {
    console.error('cabinet_session_signing_failed', JSON.stringify({ correlationId }));
    return json({ ok: false, code: 'SESSION_CONFIGURATION_ERROR', message: UNIVERSAL_ERROR, correlationId }, 503);
  }
  response.cookies.set(MFA_PENDING_COOKIE, '', clearMfaPendingCookieOptions());
  return response;
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password || email.length > 254 || password.length > 256) {
    return json({ ok: false, code: 'INVALID_CREDENTIALS', message: UNIVERSAL_ERROR, correlationId }, 400);
  }

  const controlled = controlledPayload(email, password);
  if (controlled.recognized) {
    if (!controlled.payload) {
      return json({ ok: false, code: 'INVALID_CREDENTIALS', message: UNIVERSAL_ERROR, correlationId }, 401);
    }
    return completeSession(controlled.payload, correlationId);
  }

  if (!API_URL) {
    console.error('auth_service_not_configured', JSON.stringify({ correlationId }));
    return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', message: UNIVERSAL_ERROR, correlationId }, 503);
  }

  try {
    const apiResponse = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: forwardedHeaders(request, correlationId),
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    const payload = await apiResponse.json().catch(() => ({} as ApiLoginPayload)) as ApiLoginPayload;

    if (!apiResponse.ok) {
      const rateLimited = apiResponse.status === 429;
      return json({
        ok: false,
        code: rateLimited ? 'RATE_LIMITED' : 'INVALID_CREDENTIALS',
        message: UNIVERSAL_ERROR,
        correlationId,
      }, rateLimited ? 429 : 401);
    }

    if (payload.mfaRequired) {
      if (!payload.challengeToken || !payload.user?.email || !payload.user?.role) {
        console.error('auth_service_incomplete_mfa_challenge', JSON.stringify({ correlationId }));
        return json({ ok: false, code: 'AUTH_SERVICE_INVALID_RESPONSE', message: UNIVERSAL_ERROR, correlationId }, 502);
      }

      let ticket: string;
      try {
        ticket = sealMfaLoginTicket({ challengeToken: payload.challengeToken, user: payload.user });
      } catch {
        console.error('mfa_ticket_secret_not_configured', JSON.stringify({ correlationId }));
        return json({ ok: false, code: 'MFA_UNAVAILABLE', message: UNIVERSAL_ERROR, correlationId }, 503);
      }

      const response = json({
        ok: true,
        mfaRequired: true,
        methods: ['totp', 'backup_code'],
        enrollmentRequired: Boolean(payload.setupSecret),
        setupSecret: payload.setupSecret || null,
        otpAuthUri: payload.otpAuthUri || null,
        expiresAt: payload.challengeExpiresAt || null,
        correlationId,
      });
      response.cookies.set(MFA_PENDING_COOKIE, ticket, mfaPendingCookieOptions());
      return response;
    }

    return completeSession(payload, correlationId);
  } catch (error) {
    console.error('auth_login_transport_failure', JSON.stringify({
      correlationId,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', message: UNIVERSAL_ERROR, correlationId }, 503);
  }
}
