import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { requireSecret } from '../../common/config/secrets';
import { RequestUser, Role } from '../../common/types/request-user';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { AuthService } from './auth.service';
import { PersistentAuthSessionService } from './persistent-auth-session.service';

const JWT_SECRET = requireSecret('JWT_SECRET');
const ACCESS_TOKEN_TTL = '15m';
const CURRENT_CONSENT_VERSION = '1.2';

const SELF_REGISTERABLE_ROLES: ReadonlySet<Role> = new Set<Role>([
  Role.FARMER,
  Role.BUYER,
  Role.LOGISTICIAN,
  Role.DRIVER,
  Role.SURVEYOR,
  Role.LAB,
  Role.ELEVATOR,
  Role.ACCOUNTING,
]);

type PersistentIdentity = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone: string | null;
  status: string;
  mfaEnabled: boolean;
  deletedAt: Date | null;
  orgId: string;
  tenantId: string;
  role: Role;
};

@Injectable()
export class IndustrialAuthService extends AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: PersistentAuthSessionService,
  ) {
    super();
  }

  private async findIdentityByEmail(email: string): Promise<PersistentIdentity | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: {
        orgs: {
          include: { organization: true },
          orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
          take: 1,
        },
      },
    });
    const membership = user?.orgs[0];
    if (!user || !membership) return null;
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      fullName: user.fullName,
      phone: user.phone,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      deletedAt: user.deletedAt,
      orgId: membership.organizationId,
      tenantId: membership.organization.tenantId,
      role: membership.role as Role,
    };
  }

  private async findIdentityById(userId: string): Promise<PersistentIdentity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        orgs: {
          include: { organization: true },
          orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
          take: 1,
        },
      },
    });
    const membership = user?.orgs[0];
    if (!user || !membership) return null;
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      fullName: user.fullName,
      phone: user.phone,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      deletedAt: user.deletedAt,
      orgId: membership.organizationId,
      tenantId: membership.organization.tenantId,
      role: membership.role as Role,
    };
  }

  private accessToken(identity: PersistentIdentity, sessionId: string, mfaVerified = false): string {
    const payload: RequestUser = {
      id: identity.id,
      email: identity.email,
      fullName: identity.fullName,
      role: identity.role,
      orgId: identity.orgId,
      tenantId: identity.tenantId,
      sessionId,
      mfaVerified,
    };
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_TTL,
      issuer: 'prozrachnaya-cena-api',
      audience: 'prozrachnaya-cena-platform-v7',
      subject: identity.id,
      jwtid: randomUUID(),
    });
  }

  private publicIdentity(identity: PersistentIdentity) {
    return {
      id: identity.id,
      email: identity.email,
      fullName: identity.fullName,
      role: identity.role,
      orgId: identity.orgId,
      tenantId: identity.tenantId,
      mfaEnabled: identity.mfaEnabled,
    };
  }

  override async login(dto: LoginDto, userAgent?: string, ip?: string) {
    const identity = await this.findIdentityByEmail(dto.email);
    const fallbackHash = '$2a$10$7EqJtq98hPqEX7fNZaFWoO5bsNq8YxF7p7N0e1mGZy5VQx3xJ8K5K';
    const valid = await bcrypt.compare(dto.password, identity?.passwordHash || fallbackHash);

    if (!identity || !valid || identity.status !== 'ACTIVE' || identity.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const issued = await this.sessions.issue(identity.id, userAgent, ip);
    return {
      accessToken: this.accessToken(identity, issued.sessionId, false),
      refreshToken: issued.refreshToken,
      expiresInSeconds: 15 * 60,
      user: this.publicIdentity(identity),
    };
  }

  override async refresh(dto: RefreshDto, userAgent?: string, ip?: string) {
    const rotated = await this.sessions.rotate(dto.refreshToken, userAgent, ip);
    const identity = await this.findIdentityById(rotated.userId);
    if (!identity || identity.status !== 'ACTIVE' || identity.deletedAt) {
      await this.sessions.revoke(rotated.sessionId, 'identity_unavailable');
      throw new UnauthorizedException('User is unavailable');
    }
    return {
      accessToken: this.accessToken(identity, rotated.sessionId, false),
      refreshToken: rotated.refreshToken,
      expiresInSeconds: 15 * 60,
      user: this.publicIdentity(identity),
    };
  }

  override async logout(_dto: RefreshDto, sessionId?: string) {
    if (sessionId) await this.sessions.revoke(sessionId, 'logout');
    return { success: true };
  }

  async logoutAll(userId: string) {
    const revoked = await this.sessions.revokeAllForUser(userId, 'logout_all');
    return { success: true, revoked };
  }

  override async verifyAccessToken(token: string): Promise<RequestUser> {
    let payload: RequestUser;
    try {
      payload = jwt.verify(token, JWT_SECRET, {
        issuer: 'prozrachnaya-cena-api',
        audience: 'prozrachnaya-cena-platform-v7',
      }) as RequestUser;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    if (!payload.sessionId) throw new UnauthorizedException('Session is missing');
    await this.sessions.assertActive(payload.sessionId);

    const identity = await this.findIdentityById(payload.id);
    if (!identity || identity.status !== 'ACTIVE' || identity.deletedAt) {
      throw new UnauthorizedException('Identity is unavailable');
    }

    if (
      payload.role !== identity.role ||
      payload.orgId !== identity.orgId ||
      payload.tenantId !== identity.tenantId
    ) {
      await this.sessions.revoke(payload.sessionId, 'membership_changed');
      throw new UnauthorizedException('Session membership is stale');
    }

    return {
      ...payload,
      email: identity.email,
      fullName: identity.fullName,
      role: identity.role,
      orgId: identity.orgId,
      tenantId: identity.tenantId,
    };
  }

  override async register(dto: RegisterDto) {
    if (!SELF_REGISTERABLE_ROLES.has(dto.role)) {
      throw new ForbiddenException('The selected role cannot be self-registered.');
    }
    if (!dto.orgInn || !dto.orgLegalName) {
      throw new BadRequestException('Organization INN and legal name are required.');
    }

    const email = dto.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const identity = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email } });
      if (existing) throw new ConflictException('Email already registered');

      const organization = await tx.organization.upsert({
        where: { inn: dto.orgInn! },
        update: { name: dto.orgLegalName!, type: dto.orgType || 'LEGAL' },
        create: {
          inn: dto.orgInn!,
          name: dto.orgLegalName!,
          type: dto.orgType || 'LEGAL',
          status: 'PENDING',
          kycStatus: 'PENDING',
        },
      });
      const user = await tx.user.create({
        data: {
          email,
          phone: dto.phone,
          passwordHash,
          fullName: dto.fullName,
          status: 'ACTIVE',
          orgs: {
            create: {
              organizationId: organization.id,
              role: dto.role,
              isDefault: true,
            },
          },
        },
      });
      return {
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        fullName: user.fullName,
        phone: user.phone,
        status: user.status,
        mfaEnabled: user.mfaEnabled,
        deletedAt: user.deletedAt,
        orgId: organization.id,
        tenantId: organization.tenantId,
        role: dto.role,
      } satisfies PersistentIdentity;
    }, { isolationLevel: 'Serializable' });

    const issued = await this.sessions.issue(identity.id);
    return {
      accessToken: this.accessToken(identity, issued.sessionId, false),
      refreshToken: issued.refreshToken,
      expiresInSeconds: 15 * 60,
      consentVersion: dto.consentVersion || CURRENT_CONSENT_VERSION,
      user: this.publicIdentity(identity),
    };
  }

  override async me(user: RequestUser) {
    const identity = await this.findIdentityById(user.id);
    if (!identity) throw new NotFoundException('User not found');
    return this.publicIdentity(identity);
  }
}
