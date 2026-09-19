import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { RequestUser } from '../../common/types/request-user';

const SETTLEMENT_MFA_FRESHNESS_MS = 15 * 60 * 1000;

export function assertRecentSettlementFinancialMfa(user: RequestUser): void {
  if (user.mfaVerified !== true || !user.mfaVerifiedAt) {
    throw new ForbiddenException({
      code: 'RECENT_FINANCIAL_MFA_REQUIRED',
    });
  }

  const verifiedAt = new Date(user.mfaVerifiedAt).getTime();
  const age = Date.now() - verifiedAt;
  if (!Number.isFinite(age) || age < 0 || age > SETTLEMENT_MFA_FRESHNESS_MS) {
    throw new ForbiddenException({
      code: 'RECENT_FINANCIAL_MFA_REQUIRED',
    });
  }
}

/**
 * Settlement money mutations fail closed unless persistent authentication has
 * resolved a recent MFA timestamp from the server-side session. Client headers
 * and missing legacy claims are never accepted as evidence.
 */
@Injectable()
export class SettlementFinancialMfaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    if (!request.user) {
      throw new ForbiddenException({
        code: 'RECENT_FINANCIAL_MFA_REQUIRED',
      });
    }
    assertRecentSettlementFinancialMfa(request.user);
    return true;
  }
}
