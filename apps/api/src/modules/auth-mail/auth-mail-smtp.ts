import { resolve4, resolveMx } from 'node:dns/promises';
import { readFileSync } from 'node:fs';
import { connect as connectTcp, type Socket } from 'node:net';
import { connect as connectTls, type TLSSocket } from 'node:tls';
import { domainToASCII } from 'node:url';
import type { AuthMailEnvelope } from './auth-mail-crypto';

const OFFICIAL_HOST = 'mail.hosting.reg.ru';
const OFFICIAL_PORT = 465;
const DIRECT_MX_PORT = 25;
const DIRECT_MX_LIMIT = 3;
const DIRECT_MX_ADDRESS_LIMIT = 2;
const DEFAULT_TIMEOUT_MS = 20_000;
const PLATFORM_DOMAIN_ASCII = 'xn----8sbjf4befbjgs9b.xn--p1ai';
const PLATFORM_SENDER_ASCII = `access@${PLATFORM_DOMAIN_ASCII}`;

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
};

type DirectMxTarget = {
  host: string;
  address: string;
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

function isPlatformAuthMailbox(address: string): boolean {
  const separator = address.lastIndexOf('@');
  if (separator <= 0) return false;
  const domain = address.slice(separator + 1).toLowerCase();
  return domain === PLATFORM_DOMAIN_ASCII || domain.endsWith(`.${PLATFORM_DOMAIN_ASCII}`);
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
  const userMailbox = asciiMailbox(values.PC_SMTP_USER ?? '');
  const user = userMailbox.address;
  const from = asciiMailbox(values.PC_MAIL_FROM || values.PC_SMTP_USER || '').address;
  const password = String(values.PC_SMTP_PASS ?? '');

  if (host !== OFFICIAL_HOST || port !== OFFICIAL_PORT) {
    throw new Error(`Auth-mail transport must use ${OFFICIAL_HOST}:${OFFICIAL_PORT}`);
  }
  if (userMailbox.needsSmtpUtf8 || !isPlatformAuthMailbox(user)) {
    throw new Error('Auth-mail transport must authenticate with a platform-domain mailbox');
  }
  if (from !== PLATFORM_SENDER_ASCII) {
    throw new Error('Auth-mail transport must send as the canonical platform sender');
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
  return `<${safe}@${PLATFORM_DOMAIN_ASCII}>`;
}

function buildMessage(envelope: AuthMailEnvelope, outboxId: string, sender: string, recipient: string): string {
  return [
    `From: ${encodeHeader('Прозрачная Цена')} <${sender}>`,
    `To: <${recipient}>`,
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
}

type SmtpResponse = { code: number; lines: string[] };

class SmtpSession {
  private buffer = Buffer.alloc(0);
  private pending?: {
    expected: Set<number>;
    lines: string[];
    resolve: (response: SmtpResponse) => void;
    reject: (error: Error) => void;
  };

  private readonly dataHandler = (chunk: Buffer | string) => this.onData(chunk);
  private readonly errorHandler = () => this.rejectPending(new AuthMailTransportError('SMTP_SOCKET_ERROR'));
  private readonly timeoutHandler = () => this.rejectPending(new AuthMailTransportError('SMTP_TIMEOUT'));

  constructor(private readonly socket: Socket) {
    socket.on('data', this.dataHandler);
    socket.on('error', this.errorHandler);
    socket.on('timeout', this.timeoutHandler);
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

  releaseSocket(): Socket {
    if (this.pending) throw new AuthMailTransportError('SMTP_PROTOCOL_OVERLAP');
    if (this.buffer.length !== 0) throw new AuthMailTransportError('SMTP_PROTOCOL_BUFFER_NOT_EMPTY');
    this.detach();
    this.socket.setTimeout(0);
    return this.socket;
  }

  close(): void {
    this.detach();
    this.socket.end();
    this.socket.destroy();
  }

  private detach(): void {
    this.socket.off('data', this.dataHandler);
    this.socket.off('error', this.errorHandler);
    this.socket.off('timeout', this.timeoutHandler);
  }

  private rejectPending(error: Error): void {
    const pending = this.pending;
    this.pending = undefined;
    pending?.reject(error);
  }

  private waitFor(expected: Set<number>): Promise<SmtpResponse> {
    if (this.pending) throw new AuthMailTransportError('SMTP_PROTOCOL_OVERLAP');
    return new Promise<SmtpResponse>((resolve, reject) => {
      this.pending = { expected, lines: [], resolve, reject };
      this.consume();
    });
  }

  private onData(chunk: Buffer | string): void {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8');
    this.buffer = Buffer.concat([this.buffer, bytes]);
    if (this.buffer.length > 128 * 1024) {
      this.rejectPending(new AuthMailTransportError('SMTP_RESPONSE_TOO_LARGE'));
      return;
    }
    this.consume();
  }

  private consume(): void {
    while (this.pending) {
      const index = this.buffer.indexOf('\r\n');
      if (index < 0) return;
      const line = this.buffer.subarray(0, index).toString('utf8');
      this.buffer = this.buffer.subarray(index + 2);
      this.pending.lines.push(line);
      const match = /^(\d{3})([ -])/.exec(line);
      if (!match || match[2] === '-') continue;
      const code = Number(match[1]);
      const pending = this.pending;
      this.pending = undefined;
      if (!pending.expected.has(code)) {
        const category = code >= 500 ? 'PERMANENT' : code >= 400 ? 'TRANSIENT' : 'PROTOCOL';
        pending.reject(new AuthMailTransportError(`SMTP_${category}_${code}`));
        return;
      }
      pending.resolve({ code, lines: pending.lines });
      return;
    }
  }
}

async function openRelaySession(config: SmtpConfig): Promise<{ session: SmtpSession; ehlo: SmtpResponse }> {
  const socket = await new Promise<TLSSocket>((resolve, reject) => {
    const candidate = connectTls({
      host: config.host,
      port: config.port,
      servername: config.host,
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
    });
    const fail = () => reject(new AuthMailTransportError('SMTP_TLS_CONNECT_FAILED'));
    const timeout = () => reject(new AuthMailTransportError('SMTP_TLS_CONNECT_TIMEOUT'));
    candidate.once('secureConnect', () => {
      candidate.off('error', fail);
      candidate.off('timeout', timeout);
      resolve(candidate);
    });
    candidate.once('error', fail);
    candidate.setTimeout(DEFAULT_TIMEOUT_MS, timeout);
  });
  const session = new SmtpSession(socket);
  await session.greeting();
  const ehlo = await session.command(`EHLO ${PLATFORM_DOMAIN_ASCII}`, [250]);
  return { session, ehlo };
}

async function upgradeToTls(rawSocket: Socket, mxHost: string): Promise<TLSSocket> {
  return new Promise<TLSSocket>((resolve, reject) => {
    const candidate = connectTls({
      socket: rawSocket,
      servername: mxHost,
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
    });
    const fail = () => reject(new AuthMailTransportError('SMTP_DIRECT_MX_TLS_FAILED'));
    const timeout = () => reject(new AuthMailTransportError('SMTP_DIRECT_MX_TLS_TIMEOUT'));
    candidate.once('secureConnect', () => {
      candidate.off('error', fail);
      candidate.off('timeout', timeout);
      resolve(candidate);
    });
    candidate.once('error', fail);
    candidate.setTimeout(DEFAULT_TIMEOUT_MS, timeout);
  });
}

async function openDirectMxSession(mxHost: string, mxAddress: string): Promise<{ session: SmtpSession; ehlo: SmtpResponse }> {
  const rawSocket = await new Promise<Socket>((resolve, reject) => {
    const candidate = connectTcp({ host: mxAddress, family: 4, port: DIRECT_MX_PORT });
    const fail = () => reject(new AuthMailTransportError('SMTP_DIRECT_MX_CONNECT_FAILED'));
    const timeout = () => reject(new AuthMailTransportError('SMTP_DIRECT_MX_CONNECT_TIMEOUT'));
    candidate.once('connect', () => {
      candidate.off('error', fail);
      candidate.off('timeout', timeout);
      resolve(candidate);
    });
    candidate.once('error', fail);
    candidate.setTimeout(DEFAULT_TIMEOUT_MS, timeout);
  });

  const plain = new SmtpSession(rawSocket);
  try {
    await plain.greeting();
    const ehlo = await plain.command(`EHLO ${PLATFORM_DOMAIN_ASCII}`, [250]);
    const capabilities = ehlo.lines.join('\n').toUpperCase();
    if (!capabilities.includes('STARTTLS')) throw new AuthMailTransportError('SMTP_DIRECT_MX_STARTTLS_REQUIRED');
    await plain.command('STARTTLS', [220]);
    const released = plain.releaseSocket();
    const tlsSocket = await upgradeToTls(released, mxHost);
    const session = new SmtpSession(tlsSocket);
    const tlsEhlo = await session.command(`EHLO ${PLATFORM_DOMAIN_ASCII}`, [250]);
    return { session, ehlo: tlsEhlo };
  } catch (error) {
    plain.close();
    throw error;
  }
}

function recipientDomain(address: string): string {
  const separator = address.lastIndexOf('@');
  if (separator <= 0) throw new AuthMailTransportError('SMTP_RECIPIENT_DOMAIN_INVALID');
  return address.slice(separator + 1).toLowerCase();
}

export function isPublicIpv4(address: string): boolean {
  const parts = address.split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map((part) => Number(part));
  if (octets.some((part, index) => !/^\d{1,3}$/.test(parts[index]) || !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

async function resolveDirectMxTargets(domain: string): Promise<DirectMxTarget[]> {
  let rows: Awaited<ReturnType<typeof resolveMx>>;
  try {
    rows = await resolveMx(domain);
  } catch {
    throw new AuthMailTransportError('SMTP_DIRECT_MX_DNS_FAILED');
  }

  const hosts = rows
    .sort((left, right) => left.priority - right.priority)
    .map((row) => row.exchange.replace(/\.$/, '').toLowerCase())
    .filter((host) => host.length > 0 && host.length <= 253 && /^[a-z0-9.-]+$/.test(host));
  const uniqueHosts = [...new Set(hosts)].slice(0, DIRECT_MX_LIMIT);
  if (uniqueHosts.length === 0) throw new AuthMailTransportError('SMTP_DIRECT_MX_NOT_FOUND');

  const targets: DirectMxTarget[] = [];
  const seenAddresses = new Set<string>();
  for (const host of uniqueHosts) {
    let addresses: string[];
    try {
      addresses = await resolve4(host);
    } catch {
      continue;
    }
    for (const address of addresses.slice(0, DIRECT_MX_ADDRESS_LIMIT)) {
      if (!isPublicIpv4(address) || seenAddresses.has(address)) continue;
      seenAddresses.add(address);
      targets.push({ host, address });
    }
  }
  if (targets.length === 0) throw new AuthMailTransportError('SMTP_DIRECT_MX_NO_PUBLIC_ADDRESS');
  return targets;
}

function isPermanentSmtpFailure(error: unknown): boolean {
  return error instanceof AuthMailTransportError && /^SMTP_PERMANENT_5\d\d$/.test(error.code);
}

export function shouldUseDirectMxFallback(error: unknown): boolean {
  return error instanceof AuthMailTransportError && error.code === 'SMTP_TRANSIENT_451';
}

async function sendAuthMailDirectMx(
  recipient: { address: string; needsSmtpUtf8: boolean },
  sender: { address: string; needsSmtpUtf8: boolean },
  message: string,
): Promise<void> {
  const mxTargets = await resolveDirectMxTargets(recipientDomain(recipient.address));
  let lastError: unknown = new AuthMailTransportError('SMTP_DIRECT_MX_UNAVAILABLE');

  for (const target of mxTargets) {
    let session: SmtpSession | undefined;
    let payloadSubmitted = false;
    try {
      const opened = await openDirectMxSession(target.host, target.address);
      session = opened.session;
      const capabilities = opened.ehlo.lines.join('\n').toUpperCase();
      if ((recipient.needsSmtpUtf8 || sender.needsSmtpUtf8) && !capabilities.includes('SMTPUTF8')) {
        throw new AuthMailTransportError('SMTPUTF8_REQUIRED_BUT_UNAVAILABLE');
      }
      await session.command(`MAIL FROM:<${sender.address}>${recipient.needsSmtpUtf8 ? ' SMTPUTF8' : ''}`, [250]);
      await session.command(`RCPT TO:<${recipient.address}>`, [250, 251]);
      await session.command('DATA', [354]);
      payloadSubmitted = true;
      await session.data(message);
      await session.command('QUIT', [221]).catch(() => undefined);
      return;
    } catch (error) {
      lastError = error;
      if (
        payloadSubmitted
        || isPermanentSmtpFailure(error)
        || error instanceof AuthMailTransportError && error.code === 'SMTPUTF8_REQUIRED_BUT_UNAVAILABLE'
      ) {
        throw error;
      }
    } finally {
      session?.close();
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new AuthMailTransportError('SMTP_DIRECT_MX_UNAVAILABLE');
}

export async function sendAuthMailSmtp(envelope: AuthMailEnvelope, outboxId: string): Promise<void> {
  const config = resolveAuthMailSmtpConfig();
  const recipient = asciiMailbox(envelope.to);
  const sender = asciiMailbox(config.from);
  const message = buildMessage(envelope, outboxId, sender.address, recipient.address);
  const { session, ehlo } = await openRelaySession(config);
  try {
    const capabilities = ehlo.lines.join('\n').toUpperCase();
    if (!capabilities.includes('AUTH')) throw new AuthMailTransportError('SMTP_AUTH_NOT_ADVERTISED');
    if ((recipient.needsSmtpUtf8 || sender.needsSmtpUtf8) && !capabilities.includes('SMTPUTF8')) {
      throw new AuthMailTransportError('SMTPUTF8_REQUIRED_BUT_UNAVAILABLE');
    }

    const auth = Buffer.from(`\u0000${config.user}\u0000${config.password}`, 'utf8').toString('base64');
    await session.command(`AUTH PLAIN ${auth}`, [235]);
    await session.command(`MAIL FROM:<${sender.address}>${recipient.needsSmtpUtf8 ? ' SMTPUTF8' : ''}`, [250]);
    try {
      await session.command(`RCPT TO:<${recipient.address}>`, [250, 251]);
    } catch (error) {
      if (!shouldUseDirectMxFallback(error)) throw error;
      session.close();
      await sendAuthMailDirectMx(recipient, sender, message);
      return;
    }
    await session.command('DATA', [354]);
    await session.data(message);
    await session.command('QUIT', [221]).catch(() => undefined);
  } finally {
    session.close();
  }
}

export function resetAuthMailTransportCacheForTests(): void {
  cachedConfig = null;
}
