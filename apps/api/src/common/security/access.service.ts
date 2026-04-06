import { Injectable } from '@nestjs/common';
import { RequestUser } from '../types/request-user';

@Injectable()
export class AccessScopeService {
  isPrivileged(user: RequestUser) {
    return user.role === 'ADMIN' || user.role === 'SUPPORT_MANAGER' || user.role === 'EXECUTIVE';
  }

  getOrgFilter(user: RequestUser) {
    return this.isPrivileged(user) ? null : user.orgId;
  }
}
