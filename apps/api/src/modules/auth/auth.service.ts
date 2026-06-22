import { Inject, Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { RequestUser, Role } from '../../common/types/request-user';
import { LoginDto } from './dto/login.dto';
import { USER_REPOSITORY, type StoredUser, type UserRepository } from './user.repository';

const JWT_SECRET = process.env.JWT_SECRET || 'pachanin-demo-secret-2026';
const ACCESS_TOKEN_TTL = '8h';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  private async issueTokens(user: StoredUser) {
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
    await this.users.saveRefreshToken({
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
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return this.issueTokens(user);
  }

  async register(dto: any) {
    const existing = await this.users.findByEmail(dto.email);
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
    await this.users.create(newUser);
    return this.issueTokens(newUser);
  }

  async refresh(dto: { refreshToken: string }, userAgent?: string, ip?: string) {
    const record = await this.users.getRefreshToken(dto.refreshToken);
    if (!record) throw new UnauthorizedException('Invalid refresh token');
    if (record.expiresAt < Date.now()) {
      await this.users.deleteRefreshToken(dto.refreshToken);
      throw new UnauthorizedException('Refresh token expired');
    }
    await this.users.deleteRefreshToken(dto.refreshToken);
    const user = await this.users.findById(record.userId);
    if (!user) throw new UnauthorizedException('User not found');
    return this.issueTokens(user);
  }

  async logout(dto: { refreshToken: string }) {
    await this.users.deleteRefreshToken(dto.refreshToken);
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

  async listUsers() {
    const users = await this.users.list();
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      orgId: u.orgId,
      fullName: u.fullName,
    }));
  }

  async updateUserRole(userId: string, role: Role): Promise<{ id: string; role: Role }> {
    const user = await this.users.setRole(userId, role);
    return { id: user.id, role: user.role };
  }

  async updateUserOrg(userId: string, orgId: string): Promise<{ id: string; orgId: string }> {
    const user = await this.users.setOrg(userId, orgId);
    return { id: user.id, orgId: user.orgId };
  }
}
