import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { RequestUser, Role } from '../../common/types/request-user';
import { LoginDto } from './dto/login.dto';

const JWT_SECRET = process.env.JWT_SECRET || 'pachanin-demo-secret-2026';
const ACCESS_TOKEN_TTL = '8h';
const REFRESH_TOKEN_TTL = '30d';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  orgId: string;
  fullName: string;
}

interface RefreshTokenRecord {
  token: string;
  userId: string;
  expiresAt: number;
}

const DEMO_ORG_ID = 'org-demo-001';

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
];

const usersStore: StoredUser[] = [...demoUsers];
const refreshTokensStore = new Map<string, RefreshTokenRecord>();

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
    const user = usersStore.find((u) => u.email.toLowerCase() === dto.email.toLowerCase());
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return this.issueTokens(user);
  }

  async register(dto: any) {
    const existing = usersStore.find((u) => u.email.toLowerCase() === dto.email.toLowerCase());
    if (existing) throw new ConflictException('Email already registered');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const newUser: StoredUser = {
      id: `user-${randomUUID()}`,
      email: dto.email,
      passwordHash,
      role: (dto.role as Role) || Role.GUEST,
      orgId: dto.orgId || `org-${randomUUID()}`,
      fullName: dto.fullName || dto.email,
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

  async logout(dto: { refreshToken: string }) {
    refreshTokensStore.delete(dto.refreshToken);
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
    try {
      const payload = jwt.verify(token, JWT_SECRET) as any;
      return {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        orgId: payload.orgId,
        fullName: payload.fullName,
        surfaceRole: payload.surfaceRole,
        sessionId: payload.sessionId,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
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
}
