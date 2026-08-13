import { connect as netConnect, type Socket } from 'node:net';
import { connect as tlsConnect, type TLSSocket } from 'node:tls';

const MAIL_TIMEOUT_MS = 5_000;

export type TransactionalMail = {
  to: string;
  subject: string;
  text: string;
};

export type MailDeliveryResult = {
  delivered: boolean;
  provider: 'resend' | 'smtp' | 'none';
  reason: string;
};

export type SmtpSecurityMode = 'implicit-tls' | 'starttls';

export function smtpSecurityForPort(port: number): SmtpSecurityMode | null {
  if (port === 465) return 'implicit-tls';
  if (port === 587) return 'starttls';
  return null;
}

export function shouldFallbackToLoginAfterPlain(code: number) {
  return code === 535;
}

function safeReason(error: unknown) {
  if (error instanceof Error) return `${error.name}:${error.message}`.slice(0, 180);
  return String(error || 'unknown').slice(0, 180);
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAIL_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timeout);
  }
}

async function sendViaResend(mail: TransactionalMail): Promise<MailDeliveryResult> {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) return { delivered: false, provider: 'none', reason: 'resend_not_configured' };

  const from = String(process.env.RESEND_FROM_EMAIL || process.env.PC_MAIL_FROM || '').trim();
  if (!from) return { delivered: false, provider: 'none', reason: 'resend_from_not_configured' };

  try {
    const response = await fetchWithTimeout('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text }),
    });
    if (!response.ok) return { delivered: false, provider: 'resend', reason: `resend_${response.status}` };
    return { delivered: true, provider: 'resend', reason: 'sent' };
  } catch (error) {
    return { delivered: false, provider: 'resend', reason: `resend_failed:${safeReason(error)}` };
  }
}

function smtpConfigured() {
  return Boolean(process.env.PC_SMTP_HOST && process.env.PC_SMTP_USER && process.env.PC_SMTP_PASS);
}

async function readResponse(socket: Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timeout = setTimeout(() => cleanup(new Error('smtp_timeout')), MAIL_TIMEOUT_MS);

    function cleanup(error?: Error) {
      clearTimeout(timeout);
      socket.off('data', onData);
      socket.off('error', onError);
      if (error) reject(error);
    }
    function onError(error: Error) { cleanup(error); }
    function onData(data: Buffer) {
      buffer += data.toString('utf8');
      const last = buffer.split(/\r?\n/).filter(Boolean).at(-1) || '';
      if (/^\d{3}\s/.test(last)) {
        cleanup();
        resolve(buffer);
      }
    }

    socket.on('data', onData);
    socket.on('error', onError);
  });
}

function responseCode(response: string) {
  return Number(response.slice(0, 3));
}

function assertCode(response: string, allowed: number[]) {
  const code = responseCode(response);
  if (!allowed.includes(code)) throw new Error(`smtp_${code || 'unknown'}`);
}

async function command(socket: Socket, value: string, allowed: number[]) {
  socket.write(`${value}\r\n`);
  const response = await readResponse(socket);
  assertCode(response, allowed);
  return response;
}

function waitForConnect(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('smtp_connect_timeout'));
    }, MAIL_TIMEOUT_MS);
    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    function cleanup() {
      clearTimeout(timeout);
      socket.off('connect', onConnect);
      socket.off('error', onError);
    }
    socket.once('connect', onConnect);
    socket.once('error', onError);
  });
}

function waitForSecureConnect(socket: TLSSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('smtp_tls_timeout'));
    }, MAIL_TIMEOUT_MS);
    const onSecureConnect = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    function cleanup() {
      clearTimeout(timeout);
      socket.off('secureConnect', onSecureConnect);
      socket.off('error', onError);
    }
    socket.once('secureConnect', onSecureConnect);
    socket.once('error', onError);
  });
}

async function openSmtpTlsSocket(host: string, port: number): Promise<TLSSocket> {
  const security = smtpSecurityForPort(port);
  if (!security) throw new Error('smtp_unsupported_port');

  if (security === 'implicit-tls') {
    const socket = tlsConnect({ host, port, servername: host, rejectUnauthorized: true });
    try {
      await waitForSecureConnect(socket);
      assertCode(await readResponse(socket), [220]);
      await command(socket, 'EHLO transparent-price.local', [250]);
      return socket;
    } catch (error) {
      socket.destroy();
      throw error;
    }
  }

  const plainSocket = netConnect({ host, port });
  try {
    await waitForConnect(plainSocket);
    assertCode(await readResponse(plainSocket), [220]);
    await command(plainSocket, 'EHLO transparent-price.local', [250]);
    await command(plainSocket, 'STARTTLS', [220]);

    const secureSocket = tlsConnect({
      socket: plainSocket,
      servername: host,
      rejectUnauthorized: true,
    });
    try {
      await waitForSecureConnect(secureSocket);
      await command(secureSocket, 'EHLO transparent-price.local', [250]);
      return secureSocket;
    } catch (error) {
      secureSocket.destroy();
      throw error;
    }
  } catch (error) {
    plainSocket.destroy();
    throw error;
  }
}

async function authenticateSmtp(socket: TLSSocket, user: string, pass: string) {
  const plainResponse = await command(
    socket,
    `AUTH PLAIN ${Buffer.from(`\u0000${user}\u0000${pass}`, 'utf8').toString('base64')}`,
    [235, 535],
  );
  const plainCode = responseCode(plainResponse);
  if (plainCode === 235) return;
  if (!shouldFallbackToLoginAfterPlain(plainCode)) throw new Error(`smtp_${plainCode || 'unknown'}`);

  await command(socket, 'AUTH LOGIN', [334]);
  await command(socket, Buffer.from(user, 'utf8').toString('base64'), [334]);
  await command(socket, Buffer.from(pass, 'utf8').toString('base64'), [235]);
}

async function sendViaSmtp(mail: TransactionalMail): Promise<MailDeliveryResult> {
  if (!smtpConfigured()) return { delivered: false, provider: 'none', reason: 'smtp_not_configured' };

  const host = process.env.PC_SMTP_HOST as string;
  const port = Number(process.env.PC_SMTP_PORT || 465);
  const user = process.env.PC_SMTP_USER as string;
  const pass = process.env.PC_SMTP_PASS as string;
  const from = String(process.env.PC_MAIL_FROM || user).trim();
  const mime = [
    `From: <${from}>`,
    `To: ${mail.to}`,
    `Subject: ${encodeHeader(mail.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    mail.text,
  ].join('\r\n');

  let socket: TLSSocket | undefined;
  try {
    socket = await openSmtpTlsSocket(host, port);
    await authenticateSmtp(socket, user, pass);
    await command(socket, `MAIL FROM:<${from}>`, [250]);
    await command(socket, `RCPT TO:<${mail.to}>`, [250, 251]);
    await command(socket, 'DATA', [354]);
    socket.write(`${mime}\r\n.\r\n`);
    assertCode(await readResponse(socket), [250]);
    socket.write('QUIT\r\n');
    socket.end();
    return { delivered: true, provider: 'smtp', reason: 'sent' };
  } catch (error) {
    socket?.destroy();
    return { delivered: false, provider: 'smtp', reason: `smtp_failed:${safeReason(error)}` };
  }
}

export async function sendTransactionalMail(mail: TransactionalMail): Promise<MailDeliveryResult> {
  const resend = await sendViaResend(mail);
  if (resend.delivered) return resend;

  const smtp = await sendViaSmtp(mail);
  if (smtp.delivered) return smtp;

  return {
    delivered: false,
    provider: smtp.provider !== 'none' ? smtp.provider : resend.provider,
    reason: `${resend.reason};${smtp.reason}`,
  };
}
