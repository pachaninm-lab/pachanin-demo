import { Injectable, UnauthorizedException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { RequestUser, Role } from '../../common/types/request-user';
import { LoginDto } from './dto/login.dto';
import { requireSecret } from '../../common/config/secrets';

const JWT_SECRET = requireSecret('JWT_SECRET');
const ACCESS_TOKEN_TTL = '8h';
const REFRESH_TOKEN_TTL = '30d';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const CURRENT_CONSENT_VERSION = '1.2';

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  orgId: string;
  fullName: string;
  phone?: string;
  consentVersion?: string;
  consentAt?: string;
  anonymized?: boolean;
  createdAt?: string;
}

interface RefreshTokenRecord {
  token: string;
  userId: string;
  expiresAt: number;
}

const DEMO_ORG_ID = 'org-demo-001';

/**
 * Roles a user is permitted to grant themselves at self-service registration.
 * Privileged / oversight roles (ADMIN, SUPPORT_MANAGER, EXECUTIVE,
 * COMPLIANCE_OFFICER, ARBITRATOR) and GUEST must NEVER be self-assignable —
 * ADMIN/SUPPORT_MANAGER bypass all route + object guards, so accepting them
 * from an anonymous request body is a full authorization bypass. These roles
 * are provisioned only through an authenticated administrator flow.
 */
const SELF_REGISTERABLE_ROLES: ReadonlySet<Role> = new Set<Role>([
  Role.FARMER,
  Role.BUYER,
  Role.LOGISTICIAN,
  Role.DRIVER,
  Role.LAB,
  Role.ELEVATOR,
  Role.ACCOUNTING,
]);

// Brute-force / credential-stuffing protection on login (per-account).
const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Demo accounts are seeded ONLY when SEED_DEMO_USERS=true (never implicitly in
 * production). They carry a well-known password and must not exist in any
 * environment serving real users.
 */
const SHOULD_SEED_DEMO_USERS = String(process.env.SEED_DEMO_USERS || '').toLowerCase() === 'true';

const demoUsers: StoredUser[] = [
  { id: 'user-farmer-001', email: 'farmer@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.FARMER, orgId: 'org-farmer-001', fullName: 'Demo Farmer' },
  { id: 'user-buyer-001', email: 'buyer@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.BUYER, orgId: 'org-buyer-001', fullName: 'Demo Buyer' },
  { id: 'user-logistician-001', email: 'logistician@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.LOGISTICIAN, orgId: 'org-logistics-001', fullName: 'Demo Logistician' },
  { id: 'user-driver-001', email: 'driver@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.DRIVER, orgId: 'org-logistics-001', fullName: 'Demo Driver' },
  { id: 'user-lab-001', email: 'lab@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.LAB, orgId: 'org-lab-001', fullName: 'Demo Lab' },
  { id: 'user-elevator-001', email: 'elevator@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.ELEVATOR, orgId: 'org-elevator-001', fullName: 'Demo Elevator' },
  { id: 'user-accounting-001', email: 'accounting@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.ACCOUNTING, orgId: 'org-farmer-001', fullName: 'Demo Accounting' },
  { id: 'user-executive-001', email: 'executive@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.EXECUTIVE, orgId: DEMO_ORG_ID, fullName: 'Demo Executive' },
  { id: 'user-operator-001', email: 'operator@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.SUPPORT_MANAGER, orgId: DEMO_ORG_ID, fullName: 'Demo Operator' },
  { id: 'user-admin-001', email: 'admin@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.ADMIN, orgId: DEMO_ORG_ID, fullName: 'Demo Admin' },
  { id: 'user-compliance-001', email: 'compliance@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.COMPLIANCE_OFFICER, orgId: DEMO_ORG_ID, fullName: 'Demo Compliance Officer' },
  { id: 'user-arbitrator-001', email: 'arbitrator@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.ARBITRATOR, orgId: DEMO_ORG_ID, fullName: 'Demo Arbitrator' },
];

const usersStore: StoredUser[] = SHOULD_SEED_DEMO_USERS ? [...demoUsers] : [];
const refreshTokensStore = new Map<string, RefreshTokenRecord>();

interface LoginAttemptRecord {
  failures: number;
  lockedUntil: number;
}
const loginAttemptsStore = new Map<string, LoginAttemptRecord>();

const ACCESS_TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // must match ACCESS_TOKEN_TTL ('8h')

// --- Session revocation (L2) ---
// A stateless JWT cannot be un-issued, so we keep a server-side deny-list of
// revoked session ids and the set of currently-active sessions per user. Every
// authenticated request is checked against the deny-list (see
// verifyAccessToken), which lets logout, account anonymization and role changes
// invalidate live access tokens immediately instead of waiting 8h for expiry.
//
// NOTE (federal / multi-instance scale): these maps are in-process. For a fleet
// of API instances they must be backed by a shared store (e.g. Redis) so a
// revocation on one node is honoured by all. The logic below is written so only
// the store implementation needs swapping.
const activeUserSessions = new Map<string, Set<string>>();
const revokedSessions = new Map<string, number>(); // sessionId -> expiry (ms epoch)

function pruneRevokedSessions(now: number): void {
  for (const [sessionId, expiresAt] of revokedSessions) {
    if (expiresAt <= now) revokedSessions.delete(sessionId);
  }
}

function trackSession(userId: string, sessionId: string): void {
  let sessions = activeUserSessions.get(userId);
  if (!sessions) {
    sessions = new Set<string>();
    activeUserSessions.set(userId, sessions);
  }
  sessions.add(sessionId);
}

function revokeSession(sessionId: string, now = Date.now()): void {
  if (!sessionId) return;
  revokedSessions.set(sessionId, now + ACCESS_TOKEN_TTL_MS);
  for (const sessions of activeUserSessions.values()) sessions.delete(sessionId);
}

function revokeAllUserSessions(userId: string, now = Date.now()): void {
  const sessions = activeUserSessions.get(userId);
  if (!sessions) return;
  for (const sessionId of sessions) revokedSessions.set(sessionId, now + ACCESS_TOKEN_TTL_MS);
  activeUserSessions.delete(userId);
}

function isSessionRevoked(sessionId: string | undefined, now = Date.now()): boolean {
  if (!sessionId) return false;
  const expiresAt = revokedSessions.get(sessionId);
  if (expiresAt === undefined) return false;
  if (expiresAt <= now) {
    revokedSessions.delete(sessionId);
    return false;
  }
  return true;
}

@Injectable()
export class AuthService {
  private issueTokens(user: StoredUser) {
    const payload: RequestUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
      fullName: user.fullName,
      sessionId: randomUUID(),
    };
    trackSession(user.id, payload.sessionId!);
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
    const refreshToken = randomUUID();
    refreshTokensStore.set(refreshToken, {
      token: refreshToken,
      userId: user.id,
      expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
    });
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        orgId: user.orgId,
        fullName: user.fullName,
      },
    };
  }

  async login(dto: LoginDto, userAgent?: string, ip?: string) {
    const accountKey = dto.email.toLowerCase();
    this.assertNotLockedOut(accountKey);

    const user = usersStore.find((u) => u.email.toLowerCase() === accountKey);
    // Always run a bcrypt comparison (even for unknown users) to avoid leaking
    // account existence via response timing, and to feed the lockout counter.
    const passwordHash = user?.passwordHash || '';
    const valid = passwordHash ? await bcrypt.compare(dto.password, passwordHash) : false;

    if (!user || !valid || user.anonymized) {
      this.registerFailedLogin(accountKey);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.clearFailedLogins(accountKey);
    return this.issueTokens(user);
  }

  private assertNotLockedOut(accountKey: string): void {
    const record = loginAttemptsStore.get(accountKey);
    if (record && record.lockedUntil > Date.now()) {
      const retryAfterSec = Math.ceil((record.lockedUntil - Date.now()) / 1000);
      throw new UnauthorizedException(
        `Account temporarily locked after too many failed attempts. Try again in ${retryAfterSec}s.`,
      );
    }
  }

  private registerFailedLogin(accountKey: string): void {
    const record = loginAttemptsStore.get(accountKey) ?? { failures: 0, lockedUntil: 0 };
    record.failures += 1;
    if (record.failures >= MAX_FAILED_LOGINS) {
      record.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
      record.failures = 0;
    }
    loginAttemptsStore.set(accountKey, record);
  }

  private clearFailedLogins(accountKey: string): void {
    loginAttemptsStore.delete(accountKey);
  }

  async register(dto: any) {
    const requestedRole = (dto.role as Role) || Role.GUEST;
    if (!SELF_REGISTERABLE_ROLES.has(requestedRole)) {
      // Do not reveal which roles are privileged — a generic refusal is enough.
      throw new ForbiddenException(
        'The selected role cannot be self-registered. Contact an administrator for access.',
      );
    }
    const existing = usersStore.find((u) => u.email.toLowerCase() === dto.email.toLowerCase());
    if (existing) throw new ConflictException('Email already registered');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const newUser: StoredUser = {
      id: `user-${randomUUID()}`,
      email: dto.email,
      passwordHash,
      role: requestedRole,
      orgId: dto.orgId || `org-${randomUUID()}`,
      fullName: dto.fullName || dto.email,
      phone: dto.phone,
      consentVersion: dto.consentVersion || CURRENT_CONSENT_VERSION,
      consentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    usersStore.push(newUser);
    return this.issueTokens(newUser);
  }

  async refresh(dto: { refreshToken: string }, userAgent?: string, ip?: string) {
    const record = refreshTokensStore.get(dto.refreshToken);
    if (!record) throw new UnauthorizedException('Invalid refresh token');
    if (record.expiresAt < Date.now()) {
      refreshTokensStore.delete(dto.refreshToken);
      throw new UnauthorizedException('Refresh token expired');
    }
    refreshTokensStore.delete(dto.refreshToken);
    const user = usersStore.find((u) => u.id === record.userId);
    if (!user) throw new UnauthorizedException('User not found');
    return this.issueTokens(user);
  }

  async logout(dto: { refreshToken?: string }, sessionId?: string) {
    if (dto?.refreshToken) refreshTokensStore.delete(dto.refreshToken);
    // Immediately invalidate the caller's live access token, not just the refresh token.
    if (sessionId) revokeSession(sessionId);
    pruneRevokedSessions(Date.now());
    return { success: true };
  }

  async me(user: RequestUser) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
      fullName: user.fullName,
      surfaceRole: user.surfaceRole,
    };
  }

  async verifyAccessToken(token: string): Promise<RequestUser> {
    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    if (isSessionRevoked(payload.sessionId)) {
      throw new UnauthorizedException('Session has been revoked');
    }
    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      orgId: payload.orgId,
      fullName: payload.fullName,
      surfaceRole: payload.surfaceRole,
      sessionId: payload.sessionId,
    };
  }

  sberBusinessStart(query: { returnPath?: string; orgType?: string; inn?: string; legalName?: string; fullName?: string; email?: string }) {
    return {
      provider: 'sber-business',
      status: 'not_configured',
      message: 'SberBusiness OAuth is not configured in this environment',
      query,
    };
  }

  sberBusinessCallback(query: { code?: string; state?: string }, userAgent?: string, ip?: string) {
    return {
      provider: 'sber-business',
      status: 'not_configured',
      message: 'SberBusiness OAuth callback is not configured in this environment',
    };
  }

  oidcProviders() {
    return {
      providers: [],
      message: 'No OIDC providers configured',
    };
  }

  oidcAuthorizationUrl() {
    return {
      url: null,
      message: 'No OIDC provider configured',
    };
  }

  listUsers() {
    return usersStore.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      orgId: u.orgId,
      fullName: u.fullName,
    }));
  }

  updateUserRole(userId: string, role: Role): { id: string; role: Role } {
    const user = usersStore.find((u) => u.id === userId);
    if (!user) throw new Error(`User ${userId} not found`);
    user.role = role;
    // Invalidate live tokens so the privilege change takes effect immediately —
    // a token minted with the old role must not keep the old access.
    revokeAllUserSessions(userId);
    return { id: user.id, role: user.role };
  }

  updateUserOrg(userId: string, orgId: string): { id: string; orgId: string } {
    const user = usersStore.find((u) => u.id === userId);
    if (!user) throw new Error(`User ${userId} not found`);
    user.orgId = orgId;
    // Org scope is security-relevant — invalidate live tokens carrying the old org.
    revokeAllUserSessions(userId);
    return { id: user.id, orgId: user.orgId };
  }

  getUserData(requestingUserId: string) {
    const user = usersStore.find((u) => u.id === requestingUserId);
    if (!user) throw new NotFoundException('User not found');
    if (user.anonymized) throw new ForbiddenException('Account has been anonymized');
    return {
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0',
      subject: '152-ФЗ Data Portability Export',
      profile: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone ?? null,
        role: user.role,
        orgId: user.orgId,
        createdAt: user.createdAt ?? null,
      },
      consent: {
        version: user.consentVersion ?? null,
        recordedAt: user.consentAt ?? null,
        currentPolicyVersion: CURRENT_CONSENT_VERSION,
      },
      accountStatus: {
        anonymized: user.anonymized ?? false,
      },
    };
  }

  anonymizeUser(requestingUserId: string): { success: boolean; anonymizedAt: string } {
    const user = usersStore.find((u) => u.id === requestingUserId);
    if (!user) throw new NotFoundException('User not found');
    if (user.anonymized) throw new ConflictException('Account already anonymized');

    const anonymizedAt = new Date().toISOString();
    user.email = `anon-${user.id}@deleted.invalid`;
    user.fullName = 'Anonymized User';
    user.phone = undefined;
    user.passwordHash = '';
    user.anonymized = true;

    // Revoke all refresh tokens for this user
    for (const [key, rec] of refreshTokensStore.entries()) {
      if (rec.userId === requestingUserId) {
        refreshTokensStore.delete(key);
      }
    }
    // Revoke all live access sessions for this user.
    revokeAllUserSessions(requestingUserId);

    return { success: true, anonymizedAt };
  }
}
