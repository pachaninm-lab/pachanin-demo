import * as bcrypt from 'bcryptjs';
import { Role } from '../../common/types/request-user';

/**
 * Identity data-access boundary.
 *
 * Mirrors the deal repository pattern: the default binding is the in-memory
 * runtime adapter; the DB-backed (Prisma) adapter is selected only under the
 * explicit PLATFORM_V7_USER_REPOSITORY=prisma flag. There is no silent Prisma
 * activation. AuthService keeps all token/credential logic and depends only on
 * this boundary.
 */
export const USER_REPOSITORY = 'USER_REPOSITORY';

export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  orgId: string;
  fullName: string;
}

export interface RefreshRecord {
  token: string;
  userId: string;
  expiresAt: number;
}

export interface UserRepository {
  findByEmail(email: string): Promise<StoredUser | null>;
  findById(id: string): Promise<StoredUser | null>;
  create(user: StoredUser): Promise<StoredUser>;
  list(): Promise<StoredUser[]>;
  setRole(id: string, role: Role): Promise<StoredUser>;
  setOrg(id: string, orgId: string): Promise<StoredUser>;
  saveRefreshToken(record: RefreshRecord): Promise<void>;
  getRefreshToken(token: string): Promise<RefreshRecord | null>;
  deleteRefreshToken(token: string): Promise<void>;
}

export interface DemoOrg {
  id: string;
  name: string;
  kind: string;
  inn?: string;
}

/** Organisation catalogue backing the seeded demo users. */
export const DEMO_ORGS: DemoOrg[] = [
  { id: 'org-farmer-001', name: 'ФХ Демо-Продавец', kind: 'FARMER', inn: '6800000001' },
  { id: 'org-buyer-001', name: 'ООО Демо-Покупатель', kind: 'BUYER', inn: '7700000002' },
  { id: 'org-logistics-001', name: 'Демо-Логистика', kind: 'LOGISTICIAN', inn: '3600000003' },
  { id: 'org-lab-001', name: 'Демо-Лаборатория', kind: 'LAB', inn: '4600000004' },
  { id: 'org-elevator-001', name: 'Элеватор Демо', kind: 'ELEVATOR', inn: '3100000005' },
  { id: 'org-demo-001', name: 'Прозрачная Цена · Оператор', kind: 'OPERATOR', inn: '7700000006' },
];

/** Seed users — the same identities, now sourced from a single shared place. */
export const DEMO_USERS: StoredUser[] = [
  { id: 'user-farmer-001', email: 'farmer@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.FARMER, orgId: 'org-farmer-001', fullName: 'Demo Farmer' },
  { id: 'user-buyer-001', email: 'buyer@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.BUYER, orgId: 'org-buyer-001', fullName: 'Demo Buyer' },
  { id: 'user-logistician-001', email: 'logistician@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.LOGISTICIAN, orgId: 'org-logistics-001', fullName: 'Demo Logistician' },
  { id: 'user-driver-001', email: 'driver@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.DRIVER, orgId: 'org-logistics-001', fullName: 'Demo Driver' },
  { id: 'user-lab-001', email: 'lab@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.LAB, orgId: 'org-lab-001', fullName: 'Demo Lab' },
  { id: 'user-elevator-001', email: 'elevator@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.ELEVATOR, orgId: 'org-elevator-001', fullName: 'Demo Elevator' },
  { id: 'user-accounting-001', email: 'accounting@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.ACCOUNTING, orgId: 'org-farmer-001', fullName: 'Demo Accounting' },
  { id: 'user-executive-001', email: 'executive@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.EXECUTIVE, orgId: 'org-demo-001', fullName: 'Demo Executive' },
  { id: 'user-operator-001', email: 'operator@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.SUPPORT_MANAGER, orgId: 'org-demo-001', fullName: 'Demo Operator' },
  { id: 'user-admin-001', email: 'admin@demo.ru', passwordHash: bcrypt.hashSync('demo1234', 10), role: Role.ADMIN, orgId: 'org-demo-001', fullName: 'Demo Admin' },
];

/**
 * Default in-memory identity adapter — preserves the previous AuthService
 * behaviour exactly (case-insensitive email, in-memory refresh tokens).
 */
export class RuntimeUserRepository implements UserRepository {
  private readonly users: StoredUser[];
  private readonly refresh = new Map<string, RefreshRecord>();

  constructor(seed: StoredUser[] = DEMO_USERS) {
    this.users = seed.map((u) => ({ ...u }));
  }

  async findByEmail(email: string): Promise<StoredUser | null> {
    return this.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
  }

  async findById(id: string): Promise<StoredUser | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async create(user: StoredUser): Promise<StoredUser> {
    this.users.push({ ...user });
    return { ...user };
  }

  async list(): Promise<StoredUser[]> {
    return this.users.map((u) => ({ ...u }));
  }

  async setRole(id: string, role: Role): Promise<StoredUser> {
    const user = this.must(id);
    user.role = role;
    return { ...user };
  }

  async setOrg(id: string, orgId: string): Promise<StoredUser> {
    const user = this.must(id);
    user.orgId = orgId;
    return { ...user };
  }

  async saveRefreshToken(record: RefreshRecord): Promise<void> {
    this.refresh.set(record.token, record);
  }

  async getRefreshToken(token: string): Promise<RefreshRecord | null> {
    return this.refresh.get(token) ?? null;
  }

  async deleteRefreshToken(token: string): Promise<void> {
    this.refresh.delete(token);
  }

  private must(id: string): StoredUser {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new Error(`User ${id} not found`);
    return user;
  }
}
