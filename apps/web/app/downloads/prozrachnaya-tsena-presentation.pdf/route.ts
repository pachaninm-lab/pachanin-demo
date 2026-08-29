import { NextResponse } from 'next/server';

const PRESENTATION_DOWNLOAD_URL =
  'https://drive.google.com/uc?export=download&id=11qCiCF_svPoqsh4ZczBxFi1CehQnDAiZ';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.redirect(PRESENTATION_DOWNLOAD_URL, 307);
}
