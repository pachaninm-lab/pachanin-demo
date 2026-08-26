import presentationBase64 from '../prozrachnaya-tsena-presentation/chunks/00';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

const DOWNLOAD_NAME = encodeURIComponent('Прозрачная_Цена_и_ГЕКТА.pptx');

export async function GET() {
  const body = Buffer.from(presentationBase64, 'base64');

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="prozrachnaya-tsena-i-gekta.pptx"; filename*=UTF-8''${DOWNLOAD_NAME}`,
      'Content-Length': String(body.byteLength),
      'Cache-Control': 'public, max-age=300, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
