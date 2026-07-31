import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const SUPPORTED_LANGUAGES = new Set(['ru', 'en', 'zh']);

export function GET(request: NextRequest) {
  const language = request.nextUrl.searchParams.get('lang');
  const target = new URL('/trust', request.url);
  if (language && SUPPORTED_LANGUAGES.has(language)) target.searchParams.set('lang', language);
  return NextResponse.redirect(target, 308);
}
