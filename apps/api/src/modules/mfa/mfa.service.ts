import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, createHash } from 'crypto';

// RFC 6238 TOTP implementation (no external dependency)
function hotp(secret: Buffer, counter: number, digits = 6): string {
  const buf = Buffer.alloc(8);
  let tmp = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = tmp & 0xff;
    tmp = Math.floor(tmp / 256);
  }
  const hmac = createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % Math.pow(10, digits)).padStart(digits, '0');
}

function totp(secret: Buffer, window = 1): { code: string; validCodes: string[] } {
  const step = 30;
  const counter = Math.floor(Date.now() / 1000 / step);
  const validCodes: string[] = [];
  for (let i = -window; i <= window; i++) {
    validCodes.push(hotp(secret, counter + i));
  }
  return { code: validCodes[window], validCodes };
}

function base32Decode(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = encoded.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = Buffer.alloc(Math.floor((clean.length * 5) / 8));
  for (const char of clean) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return output.slice(0, index);
}

function base32Encode(buf: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

@Injectable()
export class MfaService {
  generateSecret(): { secret: string; otpauthUrl: (issuer: string, email: string) => string } {
    const secret = base32Encode(randomBytes(20));
    return {
      secret,
      otpauthUrl: (issuer: string, email: string) =>
        `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`,
    };
  }

  verifyTotp(secret: string, code: string): boolean {
    if (!/^\d{6}$/.test(code)) return false;
    try {
      const secretBuf = base32Decode(secret);
      const { validCodes } = totp(secretBuf, 1);
      return validCodes.includes(code);
    } catch {
      return false;
    }
  }

  generateBackupCodes(count = 8): { plain: string[]; hashed: string[] } {
    const plain: string[] = [];
    const hashed: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = randomBytes(4).toString('hex').toUpperCase();
      plain.push(`${code.slice(0, 4)}-${code.slice(4)}`);
      hashed.push(createHash('sha256').update(code).digest('hex'));
    }
    return { plain, hashed };
  }

  verifyBackupCode(code: string, hashedCodes: string[]): { valid: boolean; usedIndex: number } {
    const normalized = code.replace(/-/g, '').toUpperCase();
    const hash = createHash('sha256').update(normalized).digest('hex');
    const usedIndex = hashedCodes.indexOf(hash);
    return { valid: usedIndex >= 0, usedIndex };
  }

  assertMfaVerified(mfaVerified: boolean | undefined, requireMfa: boolean): void {
    if (requireMfa && !mfaVerified) {
      throw new UnauthorizedException('MFA verification required for this operation');
    }
  }
}
