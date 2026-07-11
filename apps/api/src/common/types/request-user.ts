export const Role = {
  FARMER: 'FARMER',
  BUYER: 'BUYER',
  LOGISTICIAN: 'LOGISTICIAN',
  DRIVER: 'DRIVER',
  SURVEYOR: 'SURVEYOR',
  LAB: 'LAB',
  ELEVATOR: 'ELEVATOR',
  ACCOUNTING: 'ACCOUNTING',
  EXECUTIVE: 'EXECUTIVE',
  SUPPORT_MANAGER: 'SUPPORT_MANAGER',
  ADMIN: 'ADMIN',
  GUEST: 'GUEST',
  COMPLIANCE_OFFICER: 'COMPLIANCE_OFFICER',
  ARBITRATOR: 'ARBITRATOR',
  /** Server-derived actor used only after a verified bank callback. Never assign to a human membership. */
  BANK_CALLBACK: 'BANK_CALLBACK',
} as const;

export type Role = typeof Role[keyof typeof Role];

export type RequestUser = {
  id: string;
  orgId: string;
  role: Role;
  email: string;
  fullName?: string;
  surfaceRole?: string;
  sessionId?: string;
  tenantId?: string;
  membershipId?: string;
  credentialVersion?: number;
  mfaVerified?: boolean;
  mfaVerifiedAt?: string;
  /** Internal platform authority. Never sourced from JWT, URL, cookie or client storage. */
  staffRoles?: string[];
  /** Durable assignment identifiers resolved from PostgreSQL for the current actor. */
  staffAssignmentIds?: string[];
};

export const ROLES_REQUIRING_MFA: Role[] = [
  Role.ADMIN,
  Role.COMPLIANCE_OFFICER,
  Role.ARBITRATOR,
];

export const FINANCIAL_MFA_THRESHOLD_KOPECKS = 10_000_000; // 100 000 ₽
