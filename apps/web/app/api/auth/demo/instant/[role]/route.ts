import { NextRequest, NextResponse } from 'next/server';

type DemoTarget = {
  role: string;
  email: string;
  firstPage: string;
};

const ROLE_TARGETS: Record<string, DemoTarget> = {
  farmer: { role: 'FARMER', email: 'farmer@demo.ru', firstPage: '/lots' },
  seller: { role: 'FARMER', email: 'farmer@demo.ru', firstPage: '/lots' },
  buyer: { role: 'BUYER', email: 'buyer@demo.ru', firstPage: '/deals' },
  logistician: { role: 'LOGISTICIAN', email: 'logistics@demo.ru', firstPage: '/dispatch' },
  logistics: { role: 'LOGISTICIAN', email: 'logistics@demo.ru', firstPage: '/dispatch' },
  dispatcher: { role: 'LOGISTICIAN', email: 'logistics@demo.ru', firstPage: '/dispatch' },
  driver: { role: 'DRIVER', email: 'driver@demo.ru', firstPage: '/driver-mobile' },
  lab: { role: 'LAB', email: 'lab@demo.ru', firstPage: '/lab' },
  laboratory: { role: 'LAB', email: 'lab@demo.ru', firstPage: '/lab' },
  elevator: { role: 'ELEVATOR', email: 'elevator@demo.ru', firstPage: '/receiving' },
  accounting: { role: 'ACCOUNTING', email: 'accounting@demo.ru', firstPage: '/payments' },
  finance: { role: 'ACCOUNTING', email: 'accounting@demo.ru', firstPage: '/payments' },
  executive: { role: 'EXECUTIVE', email: 'executive@demo.ru', firstPage: '/analytics' },
  ceo: { role: 'EXECUTIVE', email: 'executive@demo.ru', firstPage: '/analytics' },
  operator: { role: 'SUPPORT_MANAGER', email: 'operator@demo.ru', firstPage: '/operator-cockpit' },
  support: { role: 'SUPPORT_MANAGER', email: 'operator@demo.ru', firstPage: '/operator-cockpit' },
  admin: { role: 'ADMIN', email: 'admin@demo.ru', firstPage: '/cabinet' },
};

function sanitizeDestination(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  return raw.startsWith('/') ? raw : fallback;
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function GET(
  request: NextRequest,
  context: { params: { role: string } },
) {
  const slug = (context.params.role || 'farmer').toLowerCase();
  const target = ROLE_TARGETS[slug] ?? ROLE_TARGETS.farmer;
  const to = sanitizeDestination(request.nextUrl.searchParams.get('to'), target.firstPage);
  const exp = Math.floor(Date.now() / 1000) + 8 * 3600;
  const sessionPayload = encodeURIComponent(JSON.stringify({ role: target.role, exp, email: target.email }));
  const csrf = `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const dest = htmlEscape(to);
  const sessionValue = htmlEscape(sessionPayload);
  const csrfValue = htmlEscape(csrf);
  const accessValue = htmlEscape(`demo.${Buffer.from(JSON.stringify({ role: target.role, exp })).toString('base64')}`);
  const refreshValue = htmlEscape(`demo-refresh.${target.role}`);

  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Вход в демо</title>
  <style>
    body { margin:0; font-family: system-ui, sans-serif; background:#020817; color:#f8fafc; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { width:min(92vw,420px); background:#0f172a; border:1px solid rgba(148,163,184,.18); border-radius:20px; padding:28px 22px; text-align:center; }
    .muted { color:#94a3b8; font-size:14px; line-height:1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size:38px;margin-bottom:10px">🎯</div>
    <h1 style="margin:0 0 10px;font-size:28px">Вход в демо</h1>
    <p class="muted">Ставлю сессию и открываю нужный раздел…</p>
  </div>
  <script>
    document.cookie = 'pc_session_present=${sessionValue}; Path=/; SameSite=Lax; Secure';
    document.cookie = 'pc_csrf_token=${csrfValue}; Path=/; SameSite=Lax; Secure';
    document.cookie = 'pc_access_token=${accessValue}; Path=/; SameSite=Lax; Secure';
    document.cookie = 'pc_refresh_token=${refreshValue}; Path=/; SameSite=Lax; Secure';
    window.location.replace('${dest}');
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
