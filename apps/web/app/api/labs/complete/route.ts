import { NextResponse } from 'next/server';

/**
 * Deprecated stub. This route previously returned a fabricated "protocol
 * completed — deal moved to settlement" success with no authentication,
 * authorization or state transition, which is unsafe on a platform that moves
 * money. Lab finalization must go through the authenticated backend
 * (PATCH /labs/samples/:id/finalize), which enforces role and object scope.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      code: 'NOT_IMPLEMENTED',
      message:
        'Этот эндпоинт отключён. Завершение лабораторного протокола выполняется через защищённый бэкенд (/labs/samples/:id/finalize).',
    },
    { status: 501 },
  );
}
