import { forwardToGekta } from '@/lib/gekta/bridge-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Context = { params: Promise<{ path: string[] }> };

async function handle(request: Request, context: Context) {
  return forwardToGekta(request, 'account', (await context.params).path ?? []);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
