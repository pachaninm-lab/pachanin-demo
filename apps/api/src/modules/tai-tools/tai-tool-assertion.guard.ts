import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { TaiDelegatedIdentity, TaiToolAssertionVerifier } from './tai-tool-assertion';

type TaiToolRequest = {
  readonly method?: string;
  readonly params?: { readonly toolName?: string };
  readonly body?: unknown;
  readonly headers?: Record<string, string | string[] | undefined>;
  taiToolIdentity?: TaiDelegatedIdentity;
};

function singleHeader(request: TaiToolRequest, name: string): string {
  const raw = request.headers?.[name];
  if (Array.isArray(raw) || typeof raw !== 'string' || !raw.trim()) {
    throw new UnauthorizedException({ code: 'TAI_TOOL_ASSERTION_REQUIRED' });
  }
  return raw.trim();
}

@Injectable()
export class TaiToolAssertionGuard implements CanActivate {
  constructor(private readonly verifier: TaiToolAssertionVerifier) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<TaiToolRequest>();
    const toolName = String(request.params?.toolName ?? '');
    if (!toolName) throw new UnauthorizedException({ code: 'TAI_TOOL_NAME_REQUIRED' });
    const path = `/internal/tai/tools/${toolName}`;
    request.taiToolIdentity = this.verifier.verify({
      assertion: singleHeader(request, 'x-tai-tool-assertion'),
      signature: singleHeader(request, 'x-tai-tool-signature'),
      idempotencyKey: singleHeader(request, 'x-idempotency-key'),
      toolName,
      method: String(request.method ?? 'POST'),
      path,
      body: request.body ?? {},
    });
    return true;
  }
}
