import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../modules/auth/auth.service';
import { PUBLIC_ROUTE, PUBLIC_ROUTE_OPTIONS, PublicRouteOptions } from '../decorators/public.decorator';

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
  constructor(private readonly reflector: Reflector, private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass()
    ]);
    const options = this.reflector.getAllAndOverride<PublicRouteOptions>(PUBLIC_ROUTE_OPTIONS, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic && enabled(options?.envFlag)) return true;

    const req = context.switchToHttp().getRequest();
    const raw = req.headers.authorization;
    if (!raw?.startsWith('Bearer ')) throw new UnauthorizedException('Missing bearer token');
    const token = raw.slice('Bearer '.length);
    req.user = await this.authService.verifyAccessToken(token);
    return true;
  }
}
