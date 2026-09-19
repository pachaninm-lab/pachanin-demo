import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_ACTION_KEY } from '../decorators/audit-action.decorator';
import { AuditService } from '../../modules/audit/audit.service';

@Injectable()
export class AuditActionInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<string>(AUDIT_ACTION_KEY, ctx.getHandler());
    if (!action) return next.handle();

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    const params = req.params ?? {};
    const objectId = params.id ?? params.dealId ?? params.shipmentId ?? 'unknown';
    const objectType = action.split(':')[0] ?? 'entity';

    return next.handle().pipe(
      tap(() => {
        if (!user) return;
        try {
          this.audit.log({
            action,
            actorUserId: user.id,
            actorRole: user.role,
            objectType,
            objectId,
            outcome: 'OK',
            dealId: params.dealId,
          });
        } catch {
          // Audit must never break the primary request path.
        }
      }),
    );
  }
}
