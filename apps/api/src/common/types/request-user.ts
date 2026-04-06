export const Role = {
  FARMER: 'FARMER',
  BUYER: 'BUYER',
  LOGISTICIAN: 'LOGISTICIAN',
  DRIVER: 'DRIVER',
  LAB: 'LAB',
  ELEVATOR: 'ELEVATOR',
  ACCOUNTING: 'ACCOUNTING',
  EXECUTIVE: 'EXECUTIVE',
  SUPPORT_MANAGER: 'SUPPORT_MANAGER',
  ADMIN: 'ADMIN',
  GUEST: 'GUEST',
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
};
