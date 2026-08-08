import { ServiceUnavailableException } from '@nestjs/common';
import { Role } from '../../common/types/request-user';
import { AuthService } from './auth.service';

type LegacyAdminUserProjection = {
  id: string;
};

declare module './auth.service' {
  interface AuthService {
    /** Legacy in-memory admin identity listing is disabled; admission authority lives in PostgreSQL. */
    listUsers(): LegacyAdminUserProjection[];
    /** Direct role mutation is disabled; roles are granted only by the audited admission state machine. */
    updateUserRole(userId: string, role: Role): never;
    /** Direct organization mutation is disabled; membership changes require a dedicated authority workflow. */
    updateUserOrg(userId: string, orgId: string): never;
  }
}

function legacyIdentityAuthorityDisabled(): never {
  throw new ServiceUnavailableException({
    code: 'LEGACY_ADMIN_IDENTITY_AUTHORITY_DISABLED',
    message: 'Use the server-authoritative registration and membership administration workflow.',
  });
}

AuthService.prototype.listUsers = function listUsers(): LegacyAdminUserProjection[] {
  return legacyIdentityAuthorityDisabled();
};

AuthService.prototype.updateUserRole = function updateUserRole(_userId: string, _role: Role): never {
  return legacyIdentityAuthorityDisabled();
};

AuthService.prototype.updateUserOrg = function updateUserOrg(_userId: string, _orgId: string): never {
  return legacyIdentityAuthorityDisabled();
};
