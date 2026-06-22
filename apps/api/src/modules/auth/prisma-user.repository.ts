import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '../../common/types/request-user';
import type { RefreshRecord, StoredUser, UserRepository } from './user.repository';

/**
 * DB-backed identity adapter (SQLite/Postgres via Prisma).
 *
 * Selected only under the explicit PLATFORM_V7_USER_REPOSITORY=prisma flag.
 * Users and refresh tokens persist in the database; emails are normalised to
 * lower-case to preserve the case-insensitive lookup of the runtime adapter.
 */
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma?: PrismaService) {
    if (!this.prisma) {
      throw new Error('PrismaUserRepository requires PrismaService — DB-backed identity path is not active.');
    }
  }

  private get db(): PrismaService {
    if (!this.prisma) {
      throw new Error('PrismaUserRepository: PrismaService unavailable — DB-backed identity path not active.');
    }
    return this.prisma;
  }

  private toUser(row: { id: string; email: string; passwordHash: string; role: string; orgId: string; fullName: string }): StoredUser {
    return { id: row.id, email: row.email, passwordHash: row.passwordHash, role: row.role as Role, orgId: row.orgId, fullName: row.fullName };
  }

  async findByEmail(email: string): Promise<StoredUser | null> {
    const row = await this.db.user.findUnique({ where: { email: email.toLowerCase() } });
    return row ? this.toUser(row) : null;
  }

  async findById(id: string): Promise<StoredUser | null> {
    const row = await this.db.user.findUnique({ where: { id } });
    return row ? this.toUser(row) : null;
  }

  async create(user: StoredUser): Promise<StoredUser> {
    const row = await this.db.user.create({
      data: {
        id: user.id,
        email: user.email.toLowerCase(),
        passwordHash: user.passwordHash,
        role: user.role,
        orgId: user.orgId,
        fullName: user.fullName,
      },
    });
    return this.toUser(row);
  }

  async list(): Promise<StoredUser[]> {
    const rows = await this.db.user.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((row) => this.toUser(row));
  }

  async setRole(id: string, role: Role): Promise<StoredUser> {
    const row = await this.db.user.update({ where: { id }, data: { role } });
    return this.toUser(row);
  }

  async setOrg(id: string, orgId: string): Promise<StoredUser> {
    const row = await this.db.user.update({ where: { id }, data: { orgId } });
    return this.toUser(row);
  }

  async saveRefreshToken(record: RefreshRecord): Promise<void> {
    await this.db.refreshToken.create({
      data: { token: record.token, userId: record.userId, expiresAt: new Date(record.expiresAt) },
    });
  }

  async getRefreshToken(token: string): Promise<RefreshRecord | null> {
    const row = await this.db.refreshToken.findUnique({ where: { token } });
    return row ? { token: row.token, userId: row.userId, expiresAt: row.expiresAt.getTime() } : null;
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await this.db.refreshToken.deleteMany({ where: { token } });
  }
}
