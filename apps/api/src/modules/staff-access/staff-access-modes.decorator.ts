import { SetMetadata } from '@nestjs/common';
import { StaffAccessMode } from './staff-access.types';

export const STAFF_ACCESS_MODES_KEY = 'staff_access_modes';

export const StaffAccessModes = (...modes: StaffAccessMode[]) =>
  SetMetadata(STAFF_ACCESS_MODES_KEY, modes);
