import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { accountKeyHash } from './auth-crypto';
import { AuthSessionService } from './auth-session.service';

const CURRENT_CONSENT_VERSION = '1.2';
const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('invalid-account-password-sentinel', 10);

const SELF_REGISTERABLE_ROLES: ReadonlySet<Role> = new Set<Role>([
  Role.FARMER,
  Role.BUYER,
  Role.LOGISTICIAN,
  Role.DRIVER,
  Role.LAB,
  Role.ELEVATOR,
  Role.ACCOUNTING,
]);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: AuthSessionService,
  ) {}

  async login(dto: LoginDto, userAgent?: string, ip?: string) {
    const email = dto.email.trim().toLowerCase();
    const keyHash = accountKeyHash(email);
    await this.assertNotLockedOut(keyHash);

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        orgs: {
          include: { organization: true },
          orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
        },
      },
    });

    const passwordHash = user?.passwordHash || DUMMY_PASSWORD_HASH;
    const valid = await bcrypt.compare(dto.password, passwordHash);
    const membership = user?.orgs.find(
      (item) => item.organization.status !== 'BLOCKED' && item.organization.status !== 'SUSPENDED',
    );

    if (!user || !valid || user.status !== 'ACTIVE' || user.deletedAt || !membership) {
      await this.registerFailedLogin(keyHash);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.clearFailedLogins(keyHash);
    return this.sessions.createSession(user, membership, userAgent, ip);
  }

  async register(dto: RegisterDto) {
    const requestedRole = dto.role || Role.GUEST;
    if (!SELF_REGISTERABLE_ROLES.has(requestedRole)) {
      throw new ForbiddenException(
        'The selected role cannot be self-registered. Contact an administrator for access.',
      );
    }
    if (dto.orgId) {
      throw new ForbiddenException({
        code: 'ORG_INVITE_REQUIRED',
        message: 'Joining an existing organization requires a server-issued invitation.',
      });
    }

    const email = dto.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const now = new Date();
    const userId = `user-${randomUUID()}`;
    const organizationId = `org-${randomUUID()}`;
    const tenantId = `tenant-${randomUUID()}`;
    const inn = dto.orgInn?.trim() || `PENDING-${randomUUID()}`;

    let created;
    try {
      created = await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.user.findUnique({ where: { email }, select: { id: true } });
          if (existing) throw new ConflictException('Email already registered');

          const organization = await tx.organization.create({
            data: {
              id: organizationId,
              inn,
              name: dto.orgLegalName?.trim() || `Организация ${dto.fullName.trim()}`,
              type: dto.orgType || 'LEGAL',
              status: 'PENDING',
              tenantId,
              kycStatus: 'PENDING',
              amlStatus: 'CLEAR',
            },
          });
          const user = await tx.user.create({
            data: {
              id: userId,
              email,
              phone: dto.phone?.trim() || null,
              passwordHash,
              fullName: dto.fullName.trim(),
              status: 'ACTIVE',
              consentVersion: dto.consentVersion || CURRENT_CONSENT_VERSION,
              consentAt: now,
            },
          });
          const membership = await tx.userOrg.create({
            data: {
              userId,
              organizationId,
              role: requestedRole,
              isDefault: true,
            },
            include: { organization: true },
          });
          return { user, membership, organization };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email or organization identifier is already registered');
      }
      throw error;
    }

    return this.sessions.createSession(created.user, created.membership);
  }

  async refresh(dto: { refreshToken: string }, userAgent?: string, ip?: string) {
    if (!dto?.refreshToken) throw new UnauthorizedException('Refresh token is required');
    return this.sessions.rotateRefreshToken(dto.refreshToken, userAgent, ip);
  }

  async logout(dto: { refreshToken?: string }, sessionId?: string) {
    if (dto?.refreshToken) await this.sessions.revokeByRefreshToken(dto.refreshToken, 'logout');
    if (sessionId) await this.sessions.revokeSession(sessionId, 'logout');
    return { success: true };
  }

  async me(user: RequestUser) {
    const record = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { mfaEnabled: true, status: true },
    });
    if (!record || record.status !== 'ACTIVE') throw new UnauthorizedException('Account is inactive');
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
      tenantId: user.tenantId,
      fullName: user.fullName,
      surfaceRole: user.surfaceRole,
      sessionId: user.sessionId,
      mfaEnabled: record.mfaEnabled,
      mfaVerified: Boolean(user.mfaVerified),
    };
  }

  verifyAccessToken(token: string): Promise<RequestUser> {
    return this.sessions.verifyAccessToken(token);
  }

  sberBusinessStart(query: {
    returnPath?: string;
    orgType?: string;
    inn?: string;
    legalName?: string;
    fullName?: string;
    email?: string;
  }) {
    return {
      provider: 'sber-business',
      status: 'not_configured',
      message: 'SberBusiness OAuth is not configured in this environment',
      query,
    };
  }

  sberBusinessCallback(_query: { code?: string; state?: string }, _userAgent?: string, _ip?: string) {
    return {
      provider: 'sber-business',
      status: 'not_configured',
      message: 'SberBusiness OAuth callback is not configured in this environment',
    };
  }

  oidcProviders() {
    return { providers: [], message: 'No OIDC providers configured' };
  }

  oidcAuthorizationUrl() {
    return { url: null, message: 'No OIDC provider configured' };
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      include: {
        orgs: {
          include: { organization: true },
          orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((user) => {
      const membership = user.orgs[0];
      return {
        id: user.id,
        email: user.email,
        role: membership?.role ?? Role.GUEST,
        orgId: membership?.organizationId ?? '',
        tenantId: membership?.organization.tenantId ?? '',
        fullName: user.fullName,
      };
    });
  }

  async updateUserRole(userId: string, role: Role): Promise<{ id: string; role: Role }> {
    if (role === Role.BANK_CALLBACK || role === Role.GUEST) {
      throw new ForbiddenException('System or guest role cannot be assigned to an active membership');
    }
    const membership = await this.prisma.userOrg.findFirst({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
    });
    if (!membership) throw new NotFoundException(`User ${userId} has no organization membership`);
    await this.prisma.userOrg.update({ where: { id: membership.id }, data: { role } });
    await this.sessions.revokeAllUserSessions(userId, 'membership_role_changed');
    return { id: userId, role };
  }

  async updateUserOrg(userId: string, orgId: string): Promise<{ id: string; orgId: string }> {
    const membership = await this.prisma.userOrg.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
    });
    if (!membership) {
      throw new ForbiddenException('Organization change requires an existing approved membership');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.userOrg.updateMany({ where: { userId }, data: { isDefault: false } });
      await tx.userOrg.update({ where: { id: membership.id }, data: { isDefault: true } });
    });
    await this.sessions.revokeAllUserSessions(userId, 'default_organization_changed');
    return { id: userId, orgId };
  }

  async getUserData(requestingUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: requestingUserId },
      include: {
        orgs: { include: { organization: true }, orderBy: { joinedAt: 'asc' } },
        authSessions: {
          select: { id: true, status: true, createdAt: true, lastSeenAt: true, revokedAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.deletedAt) throw new ForbiddenException('Account has been anonymized');
    return {
      exportedAt: new Date().toISOString(),
      exportVersion: '2.0',
      subject: '152-ФЗ Data Portability Export',
      profile: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        createdAt: user.createdAt,
      },
      memberships: user.orgs.map((membership) => ({
        organizationId: membership.organizationId,
        organizationName: membership.organization.name,
        tenantId: membership.organization.tenantId,
        role: membership.role,
        isDefault: membership.isDefault,
        joinedAt: membership.joinedAt,
      })),
      consent: {
        version: user.consentVersion,
        recordedAt: user.consentAt,
        currentPolicyVersion: CURRENT_CONSENT_VERSION,
      },
      sessions: user.authSessions,
      accountStatus: { status: user.status, anonymized: false },
    };
  }

  async anonymizeUser(requestingUserId: string): Promise<{ success: boolean; anonymizedAt: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: requestingUserId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.deletedAt) throw new ConflictException('Account already anonymized');

    await this.sessions.revokeAllUserSessions(requestingUserId, 'account_anonymized');
    const anonymizedAt = new Date();
    await this.prisma.user.update({
      where: { id: requestingUserId },
      data: {
        email: `anon-${requestingUserId}-${randomUUID()}@deleted.invalid`,
        fullName: 'Anonymized User',
        phone: null,
        passwordHash: '',
        status: 'ANONYMIZED',
        deletedAt: anonymizedAt,
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackup: null,
      },
    });
    return { success: true, anonymizedAt: anonymizedAt.toISOString() };
  }

  private async assertNotLockedOut(keyHash: string): Promise<void> {
    const record = await this.prisma.authLoginAttempt.findUnique({ where: { accountKeyHash: keyHash } });
    if (record?.lockedUntil && record.lockedUntil > new Date()) {
      const retryAfterSec = Math.ceil((record.lockedUntil.getTime() - Date.now()) / 1000);
      throw new UnauthorizedException(
        `Account temporarily locked after too many failed attempts. Try again in ${retryAfterSec}s.`,
      );
    }
  }

  private async registerFailedLogin(keyHash: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const record = await tx.authLoginAttempt.findUnique({ where: { accountKeyHash: keyHash } });
      const failures = (record?.failures ?? 0) + 1;
      const lock = failures >= MAX_FAILED_LOGINS;
      await tx.authLoginAttempt.upsert({
        where: { accountKeyHash: keyHash },
        update: {
          failures: lock ? 0 : failures,
          lockedUntil: lock ? new Date(now.getTime() + LOGIN_LOCKOUT_MS) : record?.lockedUntil,
          lastFailureAt: now,
        },
        create: {
          accountKeyHash: keyHash,
          failures: lock ? 0 : failures,
          lockedUntil: lock ? new Date(now.getTime() + LOGIN_LOCKOUT_MS) : null,
          lastFailureAt: now,
        },
      });
    });
  }

  private async clearFailedLogins(keyHash: string): Promise<void> {
    await this.prisma.authLoginAttempt.deleteMany({ where: { accountKeyHash: keyHash } });
  }
}
