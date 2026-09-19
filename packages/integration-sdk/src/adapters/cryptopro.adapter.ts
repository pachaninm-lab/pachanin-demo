import { createHash } from 'crypto';
import { BaseMockAdapter } from '../adapter.interface';

export interface UkepCertificate {
  id: string;
  thumbprint: string;
  subject: string;
  issuer: string;
  validFrom: string;
  validUntil: string;
  status: 'VALID' | 'REVOKED' | 'EXPIRED';
}

export interface UkepSignature {
  documentHash: string;    // SHA-256 of document content
  signatureBase64: string; // PKCS#7 detached signature
  certificateId: string;
  signedAt: string;
  algorithm: string;
}

export interface UkepVerificationResult {
  valid: boolean;
  certificateId: string;
  signerName: string;
  signedAt: string;
  error?: string;
}

export interface CryptoproAdapter {
  getCertificates(userId: string): Promise<UkepCertificate[]>;
  signDocument(documentHash: string, certificateId: string): Promise<UkepSignature>;
  verifySignature(documentHash: string, signature: UkepSignature): Promise<UkepVerificationResult>;
  checkCertificateStatus(certificateId: string): Promise<'valid' | 'revoked' | 'expired'>;
  batchSign(documentHashes: string[], certificateId: string): Promise<UkepSignature[]>;
}

export class MockCryptoproAdapter extends BaseMockAdapter<unknown, unknown> implements CryptoproAdapter {
  readonly name = 'CRYPTOPRO_DSS';
  readonly version = '1.0.0';

  async execute(request: unknown): Promise<unknown> {
    return { mock: true, request };
  }

  async getCertificates(userId: string): Promise<UkepCertificate[]> {
    return [{
      id: `cert-${userId}-001`,
      thumbprint: createHash('sha256').update(`${userId}-cert`).digest('hex').slice(0, 40).toUpperCase(),
      subject: `CN=Demo User ${userId}, O=Test Org, C=RU`,
      issuer: 'CN=Test CA, O=Test CA, C=RU',
      validFrom: new Date(Date.now() - 180 * 86400000).toISOString(),
      validUntil: new Date(Date.now() + 180 * 86400000).toISOString(),
      status: 'VALID',
    }];
  }

  async signDocument(documentHash: string, certificateId: string): Promise<UkepSignature> {
    const signatureBase64 = Buffer.from(
      JSON.stringify({ documentHash, certificateId, mock: true, ts: Date.now() })
    ).toString('base64');
    return {
      documentHash,
      signatureBase64,
      certificateId,
      signedAt: new Date().toISOString(),
      algorithm: 'GOST R 34.10-2012/34.11-2012',
    };
  }

  async verifySignature(documentHash: string, signature: UkepSignature): Promise<UkepVerificationResult> {
    const valid = signature.documentHash === documentHash;
    return {
      valid,
      certificateId: signature.certificateId,
      signerName: 'Demo User (mock)',
      signedAt: signature.signedAt,
      error: valid ? undefined : 'Document hash mismatch',
    };
  }

  async checkCertificateStatus(_certificateId: string): Promise<'valid' | 'revoked' | 'expired'> {
    return 'valid';
  }

  async batchSign(documentHashes: string[], certificateId: string): Promise<UkepSignature[]> {
    return Promise.all(documentHashes.map(h => this.signDocument(h, certificateId)));
  }
}
