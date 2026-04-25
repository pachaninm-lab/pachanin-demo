import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import {
  platformV7RoleLabel,
  platformV7RoleRoute,
  platformV7RoleStage,
} from './navigation';

export const PLATFORM_V7_ROLES: PlatformRole[] = [
  'operator',
  'buyer',
  'seller',
  'logistics',
  'driver',
  'surveyor',
  'elevator',
  'lab',
  'bank',
  'arbitrator',
  'compliance',
  'executive',
];

export interface PlatformV7RoleOption {
  role: PlatformRole;
  label: string;
  route: string;
  stageLabel: string;
  stageTone: 'pilot' | 'demo' | 'field';
}

export function platformV7RoleOptions(): PlatformV7RoleOption[] {
  return PLATFORM_V7_ROLES.map((role) => {
    const stage = platformV7RoleStage(role);
    return {
      role,
      label: platformV7RoleLabel(role),
      route: platformV7RoleRoute(role),
      stageLabel: stage.label,
      stageTone: stage.tone,
    };
  });
}

export function platformV7IsRole(value: string): value is PlatformRole {
  return PLATFORM_V7_ROLES.includes(value as PlatformRole);
}
