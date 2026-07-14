import { randomBytes } from 'node:crypto';
import type { IntegrationAdapter, HealthStatus } from '../adapter.interface';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function encodeBase32(input: Uint8Array): string {
  let buffer = 0;
  let bitCount = 0;
  let output = '';

  for (const byte of input) {
    buffer = (buffer << 8) | byte;
    bitCount += 8;

    while (bitCount >= 5) {
      bitCount -= 5;
      output += BASE32_ALPHABET[(buffer >>> bitCount) & 31];
    }

    buffer &= bitCount === 0 ? 0 : (1 << bitCount) - 1;
  }

  if (bitCount > 0) {
    output += BASE32_ALPHABET[(buffer << (5 - bitCount)) & 31];
  }

  return output;
}

// ── TOTP ─────────────────────────────────────────────────────────────────────

export interface TotpEnrollRequest {
  userId: string;
  issuer?: string;
}

export interface TotpEnrollResponse {
  secret: string;
  otpauthUri: string;
  backupCodes: string[];
}

export interface TotpVerifyRequest {
  userId: string;
  code: string;
  secret: string;
}

export interface TotpVerifyResponse {
  valid: boolean;
  usedBackupCode?: boolean;
}

export interface TotpAdapter extends IntegrationAdapter {
  enroll(req: TotpEnrollRequest): Promise<TotpEnrollResponse>;
  verify(req: TotpVerifyRequest): Promise<TotpVerifyResponse>;
  revoke(userId: string): Promise<void>;
}

// ── SMS OTP ───────────────────────────────────────────────────────────────────

export interface SmsOtpSendRequest {
  userId: string;
  phone: string;
  purpose: 'login' | 'deal_sign' | 'payment_release' | 'mfa_enroll';
}

export interface SmsOtpSendResponse {
  requestId: string;
  expiresAt: string; // ISO-8601
  maskedPhone: string;
}

export interface SmsOtpVerifyRequest {
  requestId: string;
  code: string;
}

export interface SmsOtpVerifyResponse {
  valid: boolean;
  remainingAttempts: number;
}

export interface SmsOtpAdapter extends IntegrationAdapter {
  send(req: SmsOtpSendRequest): Promise<SmsOtpSendResponse>;
  verify(req: SmsOtpVerifyRequest): Promise<SmsOtpVerifyResponse>;
}

// ── Mock implementations ──────────────────────────────────────────────────────

export class MockTotpAdapter implements TotpAdapter {
  readonly adapterId = 'TOTP_MOCK';
  private readonly secrets = new Map<string, string>();

  async enroll(req: TotpEnrollRequest): Promise<TotpEnrollResponse> {
    const secret = encodeBase32(randomBytes(20));
    this.secrets.set(req.userId, secret);
    const issuer = req.issuer ?? 'GrainFlow';
    return {
      secret,
      otpauthUri: `otpauth://totp/${issuer}:${req.userId}?secret=${secret}&issuer=${issuer}`,
      backupCodes: Array.from({ length: 8 }, (_, i) => `BACKUP${String(i).padStart(6, '0')}`),
    };
  }

  async verify(req: TotpVerifyRequest): Promise<TotpVerifyResponse> {
    // In mock: code '000000' is always invalid, any 6-digit code passes.
    const valid = /^\d{6}$/.test(req.code) && req.code !== '000000';
    return { valid };
  }

  async revoke(userId: string): Promise<void> {
    this.secrets.delete(userId);
  }

  async health(): Promise<HealthStatus> {
    return { status: 'ok', latencyMs: 1 };
  }
}

export class MockSmsOtpAdapter implements SmsOtpAdapter {
  readonly adapterId = 'SMS_OTP_MOCK';
  private readonly pending = new Map<string, { code: string; expiresAt: number; attempts: number }>();

  async send(req: SmsOtpSendRequest): Promise<SmsOtpSendResponse> {
    const requestId = `sms_${req.userId}_${Date.now()}`;
    const code = '123456'; // deterministic mock
    this.pending.set(requestId, { code, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 3 });
    const masked = req.phone.replace(/(\+?\d{1,3})\d+(\d{2})$/, '$1*****$2');
    return {
      requestId,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      maskedPhone: masked,
    };
  }

  async verify(req: SmsOtpVerifyRequest): Promise<SmsOtpVerifyResponse> {
    const record = this.pending.get(req.requestId);
    if (!record || Date.now() > record.expiresAt) return { valid: false, remainingAttempts: 0 };
    if (record.code === req.code) {
      this.pending.delete(req.requestId);
      return { valid: true, remainingAttempts: record.attempts };
    }
    record.attempts = Math.max(0, record.attempts - 1);
    return { valid: false, remainingAttempts: record.attempts };
  }

  async health(): Promise<HealthStatus> {
    return { status: 'ok', latencyMs: 2 };
  }
}
