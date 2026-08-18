import { resolve4, resolveMx } from 'node:dns/promises';
import { connect as connectTcp, isIP, type Socket } from 'node:net';
import { connect as connectTls, type TLSSocket } from 'node:tls';
import { domainToASCII } from 'node:url';
import { AuthMailTransportError } from './auth-mail-transport-error';

const DIRECT_MX_PORT = 25;
const DIRECT_MX_LIMIT = 2;
const DEFAULT_TIMEOUT_MS = 20_000;
const PLATFORM_EHLO = 'xn----8sbjf4befbjgs9b.xn--p1ai';

type DirectMxTarget = { hostname: string; address: string };
type SmtpResponse = { code: number; lines: string[] };

export type DirectMxDelivery = {
  recipient: string;
  sender: string;
  message: string;
  needsSmtpUtf8: boolean;
};

class DirectPostDataFailure extends Error {
  constructor(public readonly originalError: unknown) {
    super('SMTP_DIRECT_POST_DATA_FAILURE');
    this.name = 'DirectPostDataFailure';
  }
}

function isPublicIpv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function normalizeMxHostname(input: string): string | null {
  const value = String(input ?? '').trim().replace(/\.$/, '').toLowerCase();
  const ascii = domainToASCII(value);
  if (!ascii || ascii.length > 253 || !/^[a-z0-9.-]+$/.test(ascii)) return null;
  if (ascii.startsWith('.') || ascii.endsWith('.') || ascii.includes('..')) return null;
  return ascii;
}

function transportCode(error: unknown): string {
  return error instanceof AuthMailTransportError ? error.code : '';
}

function isPermanentSmtpError(error: unknown): boolean {
  return /^SMTP_PERMANENT_5\d\d$/.test(transportCode(error));
}

class DirectSmtpSession {
  private buffer = '';
  private pending?: {
    expected: Set<number>;
    lines: string[];
    resolve: (response: SmtpResponse) => void;
    reject: (error: Error) => void;
  };

  private readonly dataHandler = (chunk: Buffer | string) => this.onData(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk);
  private readonly errorHandler = () => this.rejectPending(new AuthMailTransportError('SMTP_SOCKET_ERROR'));
  private readonly timeoutHandler = () => this.rejectPending(new AuthMailTransportError('SMTP_TIMEOUT'));

  constructor(private readonly socket: Socket) {
    socket.on('data', this.dataHandler);
    socket.on('error', this.errorHandler);
    socket.on('timeout', this.timeoutHandler);
    socket.setTimeout(DEFAULT_TIMEOUT_MS);
  }

  greeting(): Promise<SmtpResponse> {
    return this.waitFor(new Set([220]));
  }

  command(command: string, expected: number[]): Promise<SmtpResponse> {
    if (/\r|\n/.test(command)) throw new AuthMailTransportError('SMTP_COMMAND_INVALID');
    const promise = this.waitFor(new Set(expected));
    this.socket.write(`${command}\r\n`);
    return promise;
  }

  data(message: string): Promise<SmtpResponse> {
    const promise = this.waitFor(new Set([250]));
    this.socket.write(`${message}\r\n.\r\n`);
    return promise;
  }

  releaseForTls(): Socket {
    if (this.pending) throw new AuthMailTransportError('SMTP_DIRECT_STARTTLS_STATE_INVALID');
    if (this.buffer.length !== 0) throw new AuthMailTransportError('SMTP_DIRECT_STARTTLS_BUFFER_INVALID');
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

  private onData(chunk: string): void {
    this.buffer += chunk;
    if (this.buffer.length > 128 * 1024) {
      this.rejectPending(new AuthMailTransportError('SMTP_RESPONSE_TOO_LARGE'));
      return;
    }
    this.consume();
  }

  private consume(): void {
    if (!this.pending) return;
    while (true) {
      const index = this.buffer.indexOf('\r\n');
      if (index < 0) return;
      const line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 2);
      const pending = this.pending;
      pending.lines.push(line);
      const match = /^(\d{3})([ -])/.exec(line);
      if (!match) continue;
      if (match[2] === '-') continue;
      const code = Number(match[1]);
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

async function resolvePublicMxTargets(recipient: string): Promise<DirectMxTarget[]> {
  const separator = recipient.lastIndexOf('@');
  if (separator <= 0) throw new AuthMailTransportError('SMTP_RECIPIENT_DOMAIN_INVALID');
  const domain = recipient.slice(separator + 1);
  let records: Awaited<ReturnType<typeof resolveMx>>;
  try {
    records = await resolveMx(domain);
  } catch {
    throw new AuthMailTransportError('SMTP_DIRECT_MX_RESOLUTION_FAILED');
  }

  const targets: DirectMxTarget[] = [];
  const seen = new Set<string>();
  for (const record of [...records].sort((left, right) => left.priority - right.priority)) {
    const hostname = normalizeMxHostname(record.exchange);
    if (!hostname) continue;
    let addresses: string[];
    try {
      addresses = await resolve4(hostname);
    } catch {
      continue;
    }
    for (const address of addresses) {
      if (!isPublicIpv4(address)) continue;
      const key = `${hostname}|${address}`;
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push({ hostname, address });
      break;
    }
    if (targets.length >= DIRECT_MX_LIMIT) break;
  }
  if (targets.length === 0) throw new AuthMailTransportError('SMTP_DIRECT_PUBLIC_MX_UNAVAILABLE');
  return targets;
}

async function openTcpSocket(address: string): Promise<Socket> {
  return new Promise<Socket>((resolve, reject) => {
    const socket = connectTcp({ host: address, port: DIRECT_MX_PORT });
    const cleanup = () => {
      socket.off('connect', onConnect);
      socket.off('error', onError);
      socket.off('timeout', onTimeout);
    };
    const onConnect = () => { cleanup(); socket.setTimeout(0); resolve(socket); };
    const onError = () => { cleanup(); socket.destroy(); reject(new AuthMailTransportError('SMTP_DIRECT_CONNECT_FAILED')); };
    const onTimeout = () => { cleanup(); socket.destroy(); reject(new AuthMailTransportError('SMTP_DIRECT_CONNECT_TIMEOUT')); };
    socket.once('connect', onConnect);
    socket.once('error', onError);
    socket.setTimeout(DEFAULT_TIMEOUT_MS, onTimeout);
  });
}

async function upgradeTls(socket: Socket, servername: string): Promise<TLSSocket> {
  return new Promise<TLSSocket>((resolve, reject) => {
    const tlsSocket = connectTls({ socket, servername, rejectUnauthorized: true, minVersion: 'TLSv1.2' });
    const cleanup = () => {
      tlsSocket.off('secureConnect', onSecure);
      tlsSocket.off('error', onError);
      tlsSocket.off('timeout', onTimeout);
    };
    const onSecure = () => { cleanup(); tlsSocket.setTimeout(0); resolve(tlsSocket); };
    const onError = () => { cleanup(); tlsSocket.destroy(); reject(new AuthMailTransportError('SMTP_DIRECT_TLS_CONNECT_FAILED')); };
    const onTimeout = () => { cleanup(); tlsSocket.destroy(); reject(new AuthMailTransportError('SMTP_DIRECT_TLS_CONNECT_TIMEOUT')); };
    tlsSocket.once('secureConnect', onSecure);
    tlsSocket.once('error', onError);
    tlsSocket.setTimeout(DEFAULT_TIMEOUT_MS, onTimeout);
  });
}

async function openDirectSession(target: DirectMxTarget): Promise<{ session: DirectSmtpSession; ehlo: SmtpResponse }> {
  const raw = await openTcpSocket(target.address);
  let plain: DirectSmtpSession | undefined = new DirectSmtpSession(raw);
  let secure: DirectSmtpSession | undefined;
  try {
    await plain.greeting();
    const ehlo = await plain.command(`EHLO ${PLATFORM_EHLO}`, [250]);
    if (!ehlo.lines.join('\n').toUpperCase().includes('STARTTLS')) {
      throw new AuthMailTransportError('SMTP_DIRECT_STARTTLS_REQUIRED');
    }
    await plain.command('STARTTLS', [220]);
    const released = plain.releaseForTls();
    plain = undefined;
    const socket = await upgradeTls(released, target.hostname);
    secure = new DirectSmtpSession(socket);
    const tlsEhlo = await secure.command(`EHLO ${PLATFORM_EHLO}`, [250]);
    const result = { session: secure, ehlo: tlsEhlo };
    secure = undefined;
    return result;
  } catch (error) {
    plain?.close();
    secure?.close();
    throw error;
  }
}

async function sendTarget(target: DirectMxTarget, delivery: DirectMxDelivery): Promise<void> {
  const { session, ehlo } = await openDirectSession(target);
  let dataStarted = false;
  try {
    const capabilities = ehlo.lines.join('\n').toUpperCase();
    if (delivery.needsSmtpUtf8 && !capabilities.includes('SMTPUTF8')) {
      throw new AuthMailTransportError('SMTPUTF8_REQUIRED_BUT_UNAVAILABLE');
    }
    await session.command(`MAIL FROM:<${delivery.sender}>${delivery.needsSmtpUtf8 ? ' SMTPUTF8' : ''}`, [250]);
    await session.command(`RCPT TO:<${delivery.recipient}>`, [250, 251]);
    await session.command('DATA', [354]);
    dataStarted = true;
    await session.data(delivery.message);
    await session.command('QUIT', [221]).catch(() => undefined);
  } catch (error) {
    if (dataStarted) throw new DirectPostDataFailure(error);
    throw error;
  } finally {
    session.close();
  }
}

export async function sendAuthMailDirectMx(delivery: DirectMxDelivery): Promise<void> {
  const targets = await resolvePublicMxTargets(delivery.recipient);
  let lastError: unknown = new AuthMailTransportError('SMTP_DIRECT_DELIVERY_FAILED');
  for (const target of targets) {
    try {
      await sendTarget(target, delivery);
      return;
    } catch (error) {
      if (error instanceof DirectPostDataFailure) throw error.originalError;
      lastError = error;
      if (isPermanentSmtpError(error)) throw error;
    }
  }
  throw lastError;
}

export const authMailDirectMxInternalsForTests = Object.freeze({ isPublicIpv4, normalizeMxHostname });
