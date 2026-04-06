import { SURFACE_ROLE_KEYS, type SurfaceRoleKey } from '../../../shared/role-contract';

export type AppRoleKey = Exclude<SurfaceRoleKey, 'GUEST'>;

export const ALL_AUTHENTICATED_ROLES = SURFACE_ROLE_KEYS.filter((role) => role !== 'GUEST') as AppRoleKey[];

export const OPS_ROLES = ['SUPPORT_MANAGER', 'ADMIN'] as const;
export const SELLER_ROLES = ['FARMER', 'SUPPORT_MANAGER', 'ADMIN'] as const;
export const DRIVER_RUNTIME_ROLES = ['DRIVER', 'LOGISTICIAN', 'SUPPORT_MANAGER', 'ADMIN'] as const;
export const INTERNAL_ONLY_ROLES = ['SUPPORT_MANAGER', 'ADMIN'] as const;
export const FINANCE_ROLES = ['ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'] as const;
export const BANK_RAIL_ROLES = ['BUYER', 'ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'] as const;
export const LOGISTICS_ROLES = ['LOGISTICIAN', 'SUPPORT_MANAGER', 'ADMIN'] as const;
export const LAB_ROLES = ['LAB', 'SUPPORT_MANAGER', 'ADMIN'] as const;
export const RECEIVING_ROLES = ['ELEVATOR', 'SUPPORT_MANAGER', 'ADMIN'] as const;
export const TRADING_ROLES = ['FARMER', 'BUYER', 'SUPPORT_MANAGER', 'ADMIN'] as const;
export const TRANSACTIONAL_ROLES = ['FARMER', 'BUYER', 'LOGISTICIAN', 'LAB', 'ELEVATOR', 'ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'] as const;
export const EXECUTIVE_ROLES = ['EXECUTIVE', 'ADMIN'] as const;

// Aliases used by various pages
export const OPERATOR_ROLES = ['SUPPORT_MANAGER', 'ADMIN'] as const;
export const DRIVER_ROLES = ['DRIVER', 'SUPPORT_MANAGER', 'ADMIN'] as const;
export const FARMER_ROLES = ['FARMER', 'SUPPORT_MANAGER', 'ADMIN'] as const;
export const ELEVATOR_ROLES = ['ELEVATOR', 'SUPPORT_MANAGER', 'ADMIN'] as const;
