import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { from, Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { RequestUser } from '../../common/types/request-user';
import { StaffAccessContext } from './staff-access.types';
import { StaffAuditWriterService } from './staff-audit-writer.service';

type WorkspaceRequest = {
  method?: string;
  route?: { path?: string };
  originalUrl?: string;
  params?: Record<string, string | undefined>;
  query?: Record<string, unknown>;
  headers?: Record<string, string | string[] | undefined>;
  user?: RequestUser;
  staffAccess?: StaffAccessContext;
};

@Injectable()
export class StaffWorkspaceAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: StaffAuditWriterService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<WorkspaceRequest>();
    // Mutations write their domain state and staff audit event in the same PostgreSQL
    // transaction. A second post-commit write here would create an ambiguous failure:
    // the mutation could commit while the client receives an error and retries it.
    if (String(request.method || 'GET').toUpperCase() !== 'GET') return next.handle();
    return next.handle().pipe(mergeMap((result) => from(this.recordRead(request).then(() => result))));
  }

  private async recordRead(request: WorkspaceRequest) {
    const actor = request.user;
    const access = request.staffAccess;
    if (!actor || !access) return;
    const route = String(request.route?.path || request.originalUrl || 'staff/workspaces').split('?')[0];
    const params = request.params || {};
    const resourceId = params.id || params.organizationId || params.actorUserId || access.targetDealId || null;
    const resourceType = params.organizationId
      ? 'organization'
      : params.actorUserId
        ? 'staff-actor'
        : params.id
          ? 'staff-resource'
          : route.split('/').filter(Boolean).pop() || 'staff-workspace';
    const correlationHeader = request.headers?.['x-correlation-id'];
    const correlationId = Array.isArray(correlationHeader) ? correlationHeader[0] : correlationHeader;
    await this.audit.record(actor, access, {
      action: 'staff.workspace.read',
      resourceType,
      resourceId,
      correlationId,
      metadata: {
        method: 'GET',
        route,
        parameterNames: Object.keys(params).sort(),
        queryNames: Object.keys(request.query || {}).sort(),
      },
    });
  }
}
