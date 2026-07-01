import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import type { RequestUser } from '../../common/types/request-user';

const JWT_SECRET = process.env.JWT_SECRET || 'pachanin-demo-secret-2026';

function extractBearerToken(authorization?: string): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined>; user?: RequestUser }>();
    const rawAuthorization = request.headers.authorization;
    const authorization = Array.isArray(rawAuthorization) ? rawAuthorization[0] : rawAuthorization;
    const token = extractBearerToken(authorization);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET) as RequestUser;
      request.user = {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        orgId: payload.orgId,
        fullName: payload.fullName,
        surfaceRole: payload.surfaceRole,
        sessionId: payload.sessionId,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
