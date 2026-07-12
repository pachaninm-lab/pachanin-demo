import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TTL_SECONDS = 8 * 60 * 60;

type Account = {
  email: string;
  role: string;
  surfaceRole: string;
  cabinetRole: string;
  owner: boolean;
  fullName: string;
  organizationId: string;
};

const ROLE_ACCOUNTS: Readonly<Record<string, Omit<Account, 'email'>>> = {
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

function enabled(): boolean {
  if (readEnv('PC_CABINET_TEST_ACCESS').toLowerCase() !== 'true') return false;
  const expiresAt = readEnv('PC_CABINET_TEST_ACCESS_EXPIRES_AT');
  if (!expiresAt) return false;
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry > Date.now();
}

function secret(): string {
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

function signToken(account: Account, signingSecret: string, tokenType: 'access' | 'refresh'): string {
  const now = Math.floor(Date.now() / 1000);
  const ttl = tokenType === 'access' ? TTL_SECONDS : TTL_SECONDS + 60 * 60;
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    sub: account.owner ? 'owner-controlled-test' : `test:${account.surfaceRole}`,
    email: account.email,
    role: account.role,
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

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'X-Test-Environment': 'controlled-access',
    },
  });
}

export async function POST(request: NextRequest) {
  if (!enabled()) return json({ code: 'NOT_FOUND' }, 404);

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const signingSecret = secret();
  if (!email || !password || !signingSecret) return json({ code: 'INVALID_CREDENTIALS' }, 401);

  const configuredOwnerEmail = readEnv('PC_CABINET_LOCK_USER').toLowerCase();
  const ownerPasswords = [readEnv('PC_CABINET_LOCK_PASSWORD'), readEnv('PC_PRIVATE_PASSWORD'), readEnv('PC_OWNER_KEY')].filter(Boolean);
  const rolePassword = readEnv('PC_CABINET_ROLE_PASSWORD');

  let account: Account | null = null;
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

  if (!account || !passwordAccepted) return json({ code: 'INVALID_CREDENTIALS' }, 401);

  return json({
    accessToken: signToken(account, signingSecret, 'access'),
    refreshToken: signToken(account, signingSecret, 'refresh'),
    expiresIn: TTL_SECONDS,
    staffOwner: account.owner,
    user: {
      email: account.email,
      role: account.role,
      surfaceRole: account.surfaceRole,
    },
  });
}
