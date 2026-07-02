import { NextResponse } from 'next/server';

/**
 * Deprecated stub. This route previously returned a fabricated "sample moved to
 * dispute / settlement blocked" success with no authentication, authorization
 * or persisted state change. Quality disputes must be raised through the
 * authenticated backend (POST /disputes), which enforces role and object scope
 * and creates the money hold.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      code: 'NOT_IMPLEMENTED',
      message:
        'Этот эндпоинт отключён. Спор по качеству оформляется через защищённый бэкенд (/disputes).',
    },
    { status: 501 },
  );
}
