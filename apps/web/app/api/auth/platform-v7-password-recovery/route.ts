import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const MAX_FIELD_LENGTH = 500;
const SMTP_TIMEOUT_MS = 15_000;

type Bucket = { count: number; resetAt: number };
type SmtpSocket = net.Socket | tls.TLSSocket;

const buckets = new Map<string, Bucket>();

function noStore(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    },
  });
}

function clean(input: unknown) {
  return typeof input === 'string' ? input.trim().slice(0, MAX_FIELD_LENGTH) : '';
}

function ipOf(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

function rateLimit(key: string) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_REQUESTS_PER_WINDOW) return false;
  current.count += 1;
  return true;
}

function htmlEscape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function smtpEscape(value: string) {
  return value.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
}

function b64(value: string) {
  return Buffer.from(value, 'utf8').toString('base64');
}

function buildText(data: Record<string, string>) {
  return [
    'Запрос восстановления доступа к платформе «Прозрачная Цена».',
    '',
    `ID запроса: ${data.requestId}`,
    `Роль: ${data.role}`,
    `Логин: ${data.login}`,
    `Организация / ИНН: ${data.company}`,
    `Контакт для ответа: ${data.contact}`,
    `Комментарий: ${data.comment}`,
    `Время запроса: ${data.requestedAt}`,
    '',
    'Прошу проверить доступ и выдать новый пароль / код доступа.',
    'Пароль в письме не указывается.',
  ].join('\n');
}

function buildHtml(data: Record<string, string>) {
  const rows = [
    ['ID запроса', data.requestId],
    ['Роль', data.role],
    ['Логин', data.login],
    ['Организация / ИНН', data.company],
    ['Контакт для ответа', data.contact],
    ['Комментарий', data.comment],
    ['Время запроса', data.requestedAt],
  ];
  return `
    <div style="font-family:Inter,Arial,sans-serif;color:#071611;line-height:1.45">
      <h2 style="margin:0 0 12px">Запрос восстановления доступа</h2>
      <p style="margin:0 0 16px">Платформа «Прозрачная Цена».</p>
      <table style="border-collapse:collapse;width:100%;max-width:760px">
        ${rows.map(([label, value]) => `
          <tr>
            <td style="padding:8px 10px;border:1px solid #e3ebe5;color:#52615a;font-weight:700">${htmlEscape(label)}</td>
            <td style="padding:8px 10px;border:1px solid #e3ebe5;font-weight:800">${htmlEscape(value)}</td>
          </tr>`).join('')}
      </table>
      <p style="margin:16px 0 0">Прошу проверить доступ и выдать новый пароль / код доступа.</p>
      <p style="margin:6px 0 0;color:#52615a">Пароль в письме не указывается.</p>
    </div>`;
}

function addressOnly(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value).trim();
}

function buildMime(data: Record<string, string>, from: string, to: string) {
  const boundary = `pc-${crypto.randomUUID()}`;
  const subject = `=?UTF-8?B?${b64(`Восстановление доступа — ${data.role}`)}?=`;
  const text = buildText(data);
  const html = buildHtml(data);
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

function connectPlain(host: string, port: number) {
  return new Promise<SmtpSocket>((resolve, reject) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(SMTP_TIMEOUT_MS);
    socket.once('connect', () => resolve(socket));
    socket.once('timeout', () => reject(new Error('smtp_timeout')));
    socket.once('error', reject);
  });
}

function connectTls(host: string, port: number) {
  return new Promise<SmtpSocket>((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host });
    socket.setTimeout(SMTP_TIMEOUT_MS);
    socket.once('secureConnect', () => resolve(socket));
    socket.once('timeout', () => reject(new Error('smtp_timeout')));
    socket.once('error', reject);
  });
}

function readReply(socket: SmtpSocket) {
  return new Promise<string>((resolve, reject) => {
    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines.at(-1);
      if (last && /^\d{3}\s/.test(last)) {
        cleanup();
        resolve(buffer);
      }
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onTimeout = () => {
      cleanup();
      reject(new Error('smtp_timeout'));
    };
    const cleanup = () => {
      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('timeout', onTimeout);
    };
    socket.on('data', onData);
    socket.once('error', onError);
    socket.once('timeout', onTimeout);
  });
}

async function command(socket: SmtpSocket, line: string, expected: number[]) {
  socket.write(`${line}\r\n`);
  const reply = await readReply(socket);
  const code = Number(reply.slice(0, 3));
  if (!expected.includes(code)) throw new Error(`smtp_unexpected_${code}`);
  return reply;
}

async function upgradeStartTls(socket: SmtpSocket, host: string) {
  await command(socket, 'STARTTLS', [220]);
  return new Promise<SmtpSocket>((resolve, reject) => {
    const tlsSocket = tls.connect({ socket, servername: host }, () => resolve(tlsSocket));
    tlsSocket.once('error', reject);
    tlsSocket.setTimeout(SMTP_TIMEOUT_MS);
  });
}

async function sendViaSmtp(data: Record<string, string>) {
  const host = process.env.PC_SMTP_HOST;
  const port = Number(process.env.PC_SMTP_PORT || '465');
  const secure = (process.env.PC_SMTP_SECURE || 'true').toLowerCase() !== 'false';
  const user = process.env.PC_SMTP_USER;
  const pass = process.env.PC_SMTP_PASS;
  const from = process.env.PC_MAIL_FROM || user;
  const to = process.env.PC_RECOVERY_TO_EMAIL;
  if (!host || !port || !user || !pass || !from || !to) return { ok: false, reason: 'smtp_not_configured' };

  let socket: SmtpSocket | null = null;
  try {
    socket = secure ? await connectTls(host, port) : await connectPlain(host, port);
    await readReply(socket);
    await command(socket, 'EHLO prozrachnaya-cena.local', [250]);
    if (!secure) {
      socket = await upgradeStartTls(socket, host);
      await command(socket, 'EHLO prozrachnaya-cena.local', [250]);
    }
    await command(socket, 'AUTH LOGIN', [334]);
    await command(socket, b64(user), [334]);
    await command(socket, b64(pass), [235]);
    await command(socket, `MAIL FROM:<${addressOnly(from)}>`, [250]);
    await command(socket, `RCPT TO:<${addressOnly(to)}>`, [250, 251]);
    await command(socket, 'DATA', [354]);
    socket.write(`${smtpEscape(buildMime(data, from, to))}\r\n.\r\n`);
    const dataReply = await readReply(socket);
    const dataCode = Number(dataReply.slice(0, 3));
    if (dataCode !== 250) throw new Error(`smtp_data_${dataCode}`);
    await command(socket, 'QUIT', [221]);
    return { ok: true, reason: 'sent' };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'smtp_failed' };
  } finally {
    socket?.destroy();
  }
}

export async function POST(request: NextRequest) {
  const ip = ipOf(request);
  if (!rateLimit(`ip:${ip}`)) {
    return noStore(202, { ok: true, message: 'Если доступ зарегистрирован, запрос будет обработан.' });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return noStore(202, { ok: true, message: 'Если доступ зарегистрирован, запрос будет обработан.' });
  }

  const data = {
    requestId: crypto.randomUUID(),
    source: 'platform-v7',
    type: 'password_recovery_request',
    role: clean(payload.role) || 'не выбрана',
    login: clean(payload.login) || 'не указан',
    company: clean(payload.company) || 'не указано',
    contact: clean(payload.contact) || 'не указан',
    comment: clean(payload.comment) || 'без комментария',
    requestedAt: new Date().toISOString(),
  };

  if (!rateLimit(`login:${data.login.toLowerCase()}`)) {
    return noStore(202, { ok: true, message: 'Если доступ зарегистрирован, запрос будет обработан.' });
  }

  const result = await sendViaSmtp(data);
  if (!result.ok) {
    console.error('platform-v7 password recovery delivery failed', { requestId: data.requestId, reason: result.reason });
  } else {
    console.info('platform-v7 password recovery delivered', { requestId: data.requestId });
  }

  return noStore(202, {
    ok: true,
    message: 'Если доступ зарегистрирован, запрос будет обработан.',
    requestId: data.requestId,
  });
}
