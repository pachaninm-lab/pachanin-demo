import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { defer, from, lastValueFrom, Observable } from 'rxjs';
import { PUBLIC_ROUTE } from '../decorators/public.decorator';
import type { RequestUser } from '../types/request-user';
import { RlsContextService } from './rls-context.service';

interface AuthenticatedRequest {
  readonly user?: RequestUser;
}

@Injectable()
export class RlsContextInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly rlsContext: RlsContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http' || !this.rlsContext.isTransactional()) {
      return next.handle();
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      if (isPublic) return next.handle();
      throw new UnauthorizedException({
        code: 'RLS_AUTHENTICATED_REQUEST_REQUIRED',
        message: 'Protected database request has no verified user context.',
      });
    }

    return defer(() =>
      from(
        this.rlsContext.run(request.user!, async () =>
          lastValueFrom(next.handle()),
        ),
      ),
    );
  }
}
