import { runtimeApiUrl, runtimeAuthHeaders } from '../../../runtime-auth-helpers';

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const response = await fetch(runtimeApiUrl(`/documents/${params.id}/content`), { cache: 'no-store', headers: await runtimeAuthHeaders() });
    // Содержимое документа — самое чувствительное, что отдаёт этот маршрут:
    // ASVS 5.0 V14.3.2 запрещает оставлять такое в кэше браузера.
    return new Response(response.body, {
      status: response.ok ? 200 : response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/octet-stream',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return new Response('', { status: 200, headers: { 'cache-control': 'no-store' } });
  }
}
