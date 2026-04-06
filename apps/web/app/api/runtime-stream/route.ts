import { runtimeApiUrl, runtimeAuthHeaders } from '../runtime-auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const response = await fetch(runtimeApiUrl('/runtime/stream'), {
      cache: 'no-store',
      headers: runtimeAuthHeaders({ Accept: 'text/event-stream' })
    });
    return new Response(response.body, {
      status: response.ok ? 200 : response.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive'
      }
    });
  } catch {
    return new Response('event: runtime.updated\ndata: {"ok":false}\n\n', {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive'
      }
    });
  }
}
