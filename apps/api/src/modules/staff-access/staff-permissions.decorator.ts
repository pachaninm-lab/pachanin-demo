import { SetMetadata } from '@nestjs/common';
import { StaffPermission } from './staff-access.types';

export const STAFF_PERMISSIONS_KEY = 'staff_permissions';

export const StaffPermissions = (...permissions: StaffPermission[]) =>
  SetMetadata(STAFF_PERMISSIONS_KEY, permissions);
