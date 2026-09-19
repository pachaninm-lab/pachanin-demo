import { roleMatches, type SurfaceRoleKey } from '../../../shared/role-contract';
import type { ServiceProviderCategory, ServiceProviderStage } from '../../../packages/domain-core/src';

export type ProviderAssignmentAccess = {
  readRoles: SurfaceRoleKey[];
  writeRoles: SurfaceRoleKey[];
};

const DEFAULT_READ: SurfaceRoleKey[] = ['SUPPORT_MANAGER', 'ADMIN'];
const DEFAULT_WRITE: SurfaceRoleKey[] = ['SUPPORT_MANAGER', 'ADMIN'];

const ACCESS_MATRIX: Record<string, ProviderAssignmentAccess> = {
  'DISPATCH:LOGISTICS': {
    readRoles: ['LOGISTICIAN', 'ELEVATOR', 'SUPPORT_MANAGER', 'ADMIN'],
    writeRoles: ['LOGISTICIAN', 'SUPPORT_MANAGER', 'ADMIN'],
  },
  'DISPATCH:INSURANCE': {
    readRoles: ['LOGISTICIAN', 'ELEVATOR', 'ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'],
    writeRoles: ['LOGISTICIAN', 'ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'],
  },
  'LAB:LAB': {
    readRoles: ['LAB', 'ELEVATOR', 'SUPPORT_MANAGER', 'ADMIN'],
    writeRoles: ['LAB', 'SUPPORT_MANAGER', 'ADMIN'],
  },
  'LAB:SURVEY': {
    readRoles: ['LAB', 'ELEVATOR', 'SUPPORT_MANAGER', 'ADMIN'],
    writeRoles: ['LAB', 'SUPPORT_MANAGER', 'ADMIN'],
  },
  'RECEIVING:ELEVATOR': {
    readRoles: ['LOGISTICIAN', 'LAB', 'ELEVATOR', 'SUPPORT_MANAGER', 'ADMIN'],
    writeRoles: ['LOGISTICIAN', 'ELEVATOR', 'SUPPORT_MANAGER', 'ADMIN'],
  },
  'RECEIVING:PORT': {
    readRoles: ['LOGISTICIAN', 'ELEVATOR', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'],
    writeRoles: ['LOGISTICIAN', 'ELEVATOR', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'],
  },
  'PAYMENT:BANK': {
    readRoles: ['ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'],
    writeRoles: ['ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'],
  },
};

export function getProviderAssignmentAccess(stage: ServiceProviderStage, category: ServiceProviderCategory): ProviderAssignmentAccess {
  const key = `${stage}:${category}`;
  const match = ACCESS_MATRIX[key];
  if (match) return match;
  return { readRoles: [...DEFAULT_READ], writeRoles: [...DEFAULT_WRITE] };
}

export function canReadProviderAssignment(role: string | null | undefined, stage: ServiceProviderStage, category: ServiceProviderCategory) {
  return roleMatches(role, getProviderAssignmentAccess(stage, category).readRoles);
}

export function canWriteProviderAssignment(role: string | null | undefined, stage: ServiceProviderStage, category: ServiceProviderCategory) {
  return roleMatches(role, getProviderAssignmentAccess(stage, category).writeRoles);
}
