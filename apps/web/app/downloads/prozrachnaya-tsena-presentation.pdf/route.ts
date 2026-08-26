import chunk00 from './chunks/00';
import chunk01 from './chunks/01';
import chunk02 from './chunks/02';
import chunk03 from './chunks/03';
import chunk04 from './chunks/04';
import chunk05 from './chunks/05';
import chunk06 from './chunks/06';
import chunk07 from './chunks/07';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

const DOWNLOAD_NAME = encodeURIComponent('Прозрачная_Цена_и_ГЕКТА.pdf');
const PRESENTATION_BASE64 = [chunk00, chunk01, chunk02, chunk03, chunk04, chunk05, chunk06, chunk07].join('');

export async function GET() {
  const body = Buffer.from(PRESENTATION_BASE64, 'base64');
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="prozrachnaya-tsena-i-gekta.pdf"; filename*=UTF-8''${DOWNLOAD_NAME}`,
      'Content-Length': String(body.byteLength),
      'Cache-Control': 'public, max-age=3600, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
