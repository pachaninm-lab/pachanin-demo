import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../modules/auth/auth.service';
import { ProductSessionService } from '../../modules/auth/product-session.service';
import { StaffAccessService } from '../../modules/staff-access/staff-access.service';
import { FINANCIAL_MFA_THRESHOLD_KOPECKS } from '../types/request-user';
import { PUBLIC_ROUTE, PUBLIC_ROUTE_OPTIONS, PublicRouteOptions } from '../decorators/public.decorator';

const FINANCIAL_COMMANDS_REQUIRING_RECENT_MFA = new Set([
  'request_reserve',
  'request_release',
]);

function enabled(flagName?: string) {
  if (!flagName) return true;
  const on = String(process.env[flagName] || 'false').toLowerCase() === 'true';
  if (!on) return false;
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const sensitivePublicFlags = new Set(['ENABLE_PUBLIC_RUNTIME_READS', 'ENABLE_PUBLIC_RUNTIME_MUTATIONS', 'ENABLE_PUBLIC_PILOT_PREVIEW']);
  if (isProd && flagName && sensitivePublicFlags.has(flagName)) {
    return String(process.env.ENABLE_PUBLIC_PREVIEW_IN_PROD || 'false').toLowerCase() === 'true';
  }
  return true;
}

@Injectable()
export class AppAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly staffAccess: StaffAccessService,
    private readonly productSessions: ProductSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    const options = this.reflector.getAllAndOverride<PublicRouteOptions>(PUBLIC_ROUTE_OPTIONS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic && enabled(options?.envFlag)) return true;

    const req = context.switchToHttp().getRequest();
    const raw = req.headers.authorization;
    if (!raw?.startsWith('Bearer ')) throw new UnauthorizedException('Missing bearer token');
    const token = raw.slice('Bearer '.length);

    // Сессия продукта не является платформенным актором. Она кладётся в
    // отдельное поле, а req.user остаётся пустым — поэтому каждый
    // существующий платформенный guard, читающий req.user, отклоняет её без
    // единой правки. Продуктовые маршруты читают req.productUser явно.
    const productUser = await this.productSessions.tryVerifyAccessToken(token);
    if (productUser) {
      req.productUser = productUser;
      return true;
    }

    req.user = await this.authService.verifyAccessToken(token);

    const staffHeader = req.headers['x-staff-access-session'];
    if (Array.isArray(staffHeader)) throw new UnauthorizedException('Multiple staff access session headers are not allowed');
    const route = String(req.originalUrl ?? req.url ?? '');
    if (route.includes('/staff') || staffHeader) {
      req.user = await this.staffAccess.enrichActor(req.user);
    }
    if (staffHeader) {
      req.staffAccess = await this.staffAccess.resolveAccessSession(req.user, String(staffHeader));
    }

    const actionId = String(req.params?.actionId ?? '');
    const bodyAmount = Number(req.body?.amountKopecks ?? req.body?.payload?.amountKopecks);
    if (FINANCIAL_COMMANDS_REQUIRING_RECENT_MFA.has(actionId)) {
      this.authService.assertRecentFinancialMfa(req.user, FINANCIAL_MFA_THRESHOLD_KOPECKS);
    } else if (Number.isFinite(bodyAmount)) {
      this.authService.assertRecentFinancialMfa(req.user, bodyAmount);
    }
    return true;
  }
}
