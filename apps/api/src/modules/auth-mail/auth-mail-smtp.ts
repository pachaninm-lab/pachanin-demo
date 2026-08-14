import { readFileSync } from 'node:fs';
import { connect, type TLSSocket } from 'node:tls';
import { domainToASCII } from 'node:url';
import type { AuthMailEnvelope } from './auth-mail-crypto';

const OFFICIAL_HOST = 'mail.hosting.reg.ru';
const OFFICIAL_PORT = 465;
const DEFAULT_TIMEOUT_MS = 20_000;
const PLATFORM_MAIL_DOMAIN_ASCII = 'xn----8sbjf4befbjgs9b.xn--p1ai';
const PLATFORM_SENDER_ASCII = `access@${PLATFORM_MAIL_DOMAIN_ASCII}`;

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
};

export class AuthMailTransportError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'AuthMailTransportError';
  }
}

function production(): boolean {
  return String(process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production';
}

function parseEnvFile(raw: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const source of raw.split(/\r?\n/)) {
    const line = source.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) throw new Error('Auth-mail transport secret contains an invalid line');
    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(name) || !value || /[\r\n\0]/.test(value)) {
      throw new Error('Auth-mail transport secret contains an invalid field');
    }
    values[name] = value;
  }
  return values;
}

function asciiMailbox(input: string): { address: string; needsSmtpUtf8: boolean } {
  const value = String(input ?? '').trim();
  if (/^[^\s@]{1,64}@[^\s@]{1,189}$/.test(value) === false || /[\r\n\0<>]/.test(value)) {
    throw new AuthMailTransportError('SMTP_RECIPIENT_INVALID');
  }
  const index = value.lastIndexOf('@');
  const local = value.slice(0, index);
  const domain = value.slice(index + 1);
  const asciiDomain = domainToASCII(domain);
  if (!asciiDomain || asciiDomain.length > 189) throw new AuthMailTransportError('SMTP_RECIPIENT_DOMAIN_INVALID');
  const needsSmtpUtf8 = /[^\x00-\x7F]/.test(local);
  return { address: `${local}@${asciiDomain.toLowerCase()}`, needsSmtpUtf8 };
}

let cachedConfig: SmtpConfig | null = null;

export function resolveAuthMailSmtpConfig(): SmtpConfig {
  if (cachedConfig) return cachedConfig;
  const file = String(process.env.AUTH_MAIL_TRANSPORT_FILE ?? '').trim();
  let values: Record<string, string>;
  if (file) {
    values = parseEnvFile(readFileSync(file, 'utf8'));
  } else {
    if (production()) {
      throw new Error('AUTH_MAIL_TRANSPORT_FILE is required in production; SMTP credentials in process environment are forbidden');
    }
    values = {
      PC_SMTP_HOST: String(process.env.PC_SMTP_HOST ?? ''),
      PC_SMTP_PORT: String(process.env.PC_SMTP_PORT ?? ''),
      PC_SMTP_USER: String(process.env.PC_SMTP_USER ?? ''),
      PC_SMTP_PASS: String(process.env.PC_SMTP_PASS ?? ''),
      PC_MAIL_FROM: String(process.env.PC_MAIL_FROM ?? ''),
    };
  }

  const host = String(values.PC_SMTP_HOST ?? '').trim().toLowerCase();
  const port = Number(values.PC_SMTP_PORT || OFFICIAL_PORT);
  const user = asciiMailbox(values.PC_SMTP_USER ?? '').address;
  const from = asciiMailbox(values.PC_MAIL_FROM || values.PC_SMTP_USER || '').address;
  const password = String(values.PC_SMTP_PASS ?? '');
  const userDomain = user.slice(user.lastIndexOf('@') + 1);

  if (host !== OFFICIAL_HOST || port !== OFFICIAL_PORT) {
    throw new Error(`Auth-mail transport must use ${OFFICIAL_HOST}:${OFFICIAL_PORT}`);
  }
  if (/[^\x00-\x7F]/.test(user) || userDomain !== PLATFORM_MAIL_DOMAIN_ASCII) {
    throw new Error('Auth-mail transport must authenticate with an ASCII mailbox on the canonical platform mail domain');
  }
  if (from !== PLATFORM_SENDER_ASCII) {
    throw new Error('Auth-mail transport must send as the canonical platform mailbox');
  }
  if (password.length < 8 || password.length > 512 || /[\r\n\0]/.test(password)) {
    throw new Error('Auth-mail SMTP password has an invalid shape');
  }

  cachedConfig = { host, port, user, password, from };
  return cachedConfig;
}

function encodeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function normalizeBody(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.startsWith('.') ? `.${line}` : line)
    .join('\r\n');
}

function deterministicMessageId(outboxId: string): string {
  const safe = String(outboxId).replace(/[^A-Za-z0-9._-]/g, '').slice(0, 120);
  if (!safe) throw new AuthMailTransportError('SMTP_MESSAGE_ID_INVALID');
  return `<${safe}@xn----8sbjf4befbjgs9b.xn--p1ai>`;
}

type SmtpResponse = { code: number; lines: string[] };

class SmtpSession {
  private buffer = '';
  private pending?: {
    expected: Set<number>;
    resolve: (response: SmtpResponse) => void;
    reject: (error: Error) => void;
  };

  constructor(private readonly socket: TLSSocket) {
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => this.onData(chunk));
    socket.on('error', () => this.pending?.reject(new AuthMailTransportError('SMTP_SOCKET_ERROR')));
    socket.on('timeout', () => this.pending?.reject(new AuthMailTransportError('SMTP_TIMEOUT')));
    socket.setTimeout(DEFAULT_TIMEOUT_MS);
  }

  async greeting(): Promise<SmtpResponse> {
    return this.waitFor(new Set([220]));
  }

  async command(command: string, expected: number[]): Promise<SmtpResponse> {
    if (/\r|\n/.test(command)) throw new AuthMailTransportError('SMTP_COMMAND_INVALID');
    const promise = this.waitFor(new Set(expected));
    this.socket.write(`${command}\r\n`);
    return promise;
  }

  async data(message: string): Promise<SmtpResponse> {
    const promise = this.waitFor(new Set([250]));
    this.socket.write(`${message}\r\n.\r\n`);
    return promise;
  }

  close(): void {
    this.socket.end();
    this.socket.destroy();
  }

  private waitFor(expected: Set<number>): Promise<SmtpResponse> {
    if (this.pending) throw new AuthMailTransportError('SMTP_PROTOCOL_OVERLAP');
    return new Promise<SmtpResponse>((resolve, reject) => {
      this.pending = { expected, resolve, reject };
      this.consume();
    });
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    if (this.buffer.length > 128 * 1024) {
      this.pending?.reject(new AuthMailTransportError('SMTP_RESPONSE_TOO_LARGE'));
      this.pending = undefined;
      return;
    }
    this.consume();
  }

  private consume(): void {
    if (!this.pending) return;
    const lines: string[] = [];
    while (true) {
      const index = this.buffer.indexOf('\r\n');
      if (index < 0) return;
      const line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 2);
      lines.push(line);
      const match = /^(\d{3})([ -])/.exec(line);
      if (!match) continue;
      if (match[2] === '-') continue;
      const code = Number(match[1]);
      const pending = this.pending;
      this.pending = undefined;
      if (!pending.expected.has(code)) {
        const category = code >= 500 ? 'PERMANENT' : code >= 400 ? 'TRANSIENT' : 'PROTOCOL';
        pending.reject(new AuthMailTransportError(`SMTP_${category}_${code}`));
        return;
      }
      pending.resolve({ code, lines });
      return;
    }
  }
}

async function openSession(config: SmtpConfig): Promise<{ session: SmtpSession; ehlo: SmtpResponse }> {
  const socket = await new Promise<TLSSocket>((resolve, reject) => {
    const candidate = connect({
      host: config.host,
      port: config.port,
      servername: config.host,
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
    });
    candidate.once('secureConnect', () => resolve(candidate));
    candidate.once('error', () => reject(new AuthMailTransportError('SMTP_TLS_CONNECT_FAILED')));
    candidate.setTimeout(DEFAULT_TIMEOUT_MS, () => reject(new AuthMailTransportError('SMTP_TLS_CONNECT_TIMEOUT')));
  });
  const session = new SmtpSession(socket);
  await session.greeting();
  const ehlo = await session.command('EHLO xn----8sbjf4befbjgs9b.xn--p1ai', [250]);
  return { session, ehlo };
}

export async function sendAuthMailSmtp(envelope: AuthMailEnvelope, outboxId: string): Promise<void> {
  const config = resolveAuthMailSmtpConfig();
  const recipient = asciiMailbox(envelope.to);
  const sender = asciiMailbox(config.from);
  const { session, ehlo } = await openSession(config);
  try {
    const capabilities = ehlo.lines.join('\n').toUpperCase();
    if (!capabilities.includes('AUTH')) throw new AuthMailTransportError('SMTP_AUTH_NOT_ADVERTISED');
    if ((recipient.needsSmtpUtf8 || sender.needsSmtpUtf8) && !capabilities.includes('SMTPUTF8')) {
      throw new AuthMailTransportError('SMTPUTF8_REQUIRED_BUT_UNAVAILABLE');
    }

    const auth = Buffer.from(`\u0000${config.user}\u0000${config.password}`, 'utf8').toString('base64');
    await session.command(`AUTH PLAIN ${auth}`, [235]);
    await session.command(`MAIL FROM:<${sender.address}>${recipient.needsSmtpUtf8 ? ' SMTPUTF8' : ''}`, [250]);
    await session.command(`RCPT TO:<${recipient.address}>`, [250, 251]);
    await session.command('DATA', [354]);

    const message = [
      `From: ${encodeHeader('Прозрачная Цена')} <${sender.address}>`,
      `To: <${recipient.address}>`,
      `Subject: ${encodeHeader(envelope.subject)}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: ${deterministicMessageId(outboxId)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      'Auto-Submitted: auto-generated',
      'X-Auto-Response-Suppress: All',
      '',
      normalizeBody(envelope.text),
    ].join('\r\n');

    await session.data(message);
    await session.command('QUIT', [221]).catch(() => undefined);
  } finally {
    session.close();
  }
}

export function resetAuthMailTransportCacheForTests(): void {
  cachedConfig = null;
}
