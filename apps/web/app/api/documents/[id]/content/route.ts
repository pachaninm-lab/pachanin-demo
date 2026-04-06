import { runtimeApiUrl, runtimeAuthHeaders } from '../../../runtime-auth-helpers';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const response = await fetch(runtimeApiUrl(`/documents/${params.id}/content`), { cache: 'no-store', headers: runtimeAuthHeaders() });
    return new Response(response.body, { status: response.ok ? 200 : response.status, headers: { 'content-type': response.headers.get('content-type') || 'application/octet-stream' } });
  } catch {
    return new Response('', { status: 200 });
  }
}
