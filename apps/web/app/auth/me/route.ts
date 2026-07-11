import { NextRequest, NextResponse } from 'next/server';
import { verifyHs256Jwt } from '@/lib/platform-v7/verified-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readEnv(name: string): string {
  return String(process.env[name] || '').trim();
}

function testFixtureEnabled(): boolean {
  if (readEnv('PC_STAFF_TEST_FIXTURE').toLowerCase() !== 'true') return false;
  if (readEnv('PC_CABINET_TEST_ACCESS').toLowerCase() !== 'true') return false;
  const expiresAt = readEnv('PC_CABINET_TEST_ACCESS_EXPIRES_AT');
  if (!expiresAt) return true;
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry > Date.now();
}

function sessionSecret(): string {
  return readEnv('JWT_SECRET') || readEnv('PC_CABINET_SESSION_SECRET');
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

export async function GET(request: NextRequest) {
  if (!testFixtureEnabled()) return json({ code: 'NOT_FOUND' }, 404);

  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const secret = sessionSecret();
  const claims = secret ? await verifyHs256Jwt(token, secret) : null;
  const expiresAt = typeof claims?.exp === 'number' ? claims.exp : 0;

  if (!claims || expiresAt <= Math.floor(Date.now() / 1000) || typeof claims.cab !== 'string') {
    return json({ code: 'UNAUTHENTICATED' }, 401);
  }

  return json({
    id: 'owner-controlled-test',
    email: 'maxim.owner@test.local',
    fullName: 'Максим — владелец платформы',
    role: 'ADMIN',
    organizationId: 'org-canonical-platform',
    tenantId: 'tenant-canonical-test',
  });
}
