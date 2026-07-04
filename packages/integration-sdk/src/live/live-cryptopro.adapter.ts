/**
 * Live КриптоПро DSS adapter (УКЭП/МЧД: signing & verification) over the shared
 * HTTP client. The per-vendor work left is endpoint paths + field mapping
 * (marked "VENDOR MAPPING") and the mTLS/DSS credential setup. Stays at
 * pre-integration maturity until a real DSS contract and certificates land.
 */

import type {
  CryptoproAdapter,
  UkepCertificate,
  UkepSignature,
  UkepVerificationResult,
} from '../adapters/cryptopro.adapter';
import { LiveAdapterBase } from './live-adapter-base';

export class LiveCryptoproAdapter extends LiveAdapterBase implements CryptoproAdapter {
  readonly name = 'CRYPTOPRO_DSS';
  readonly version = '1.0.0-live';

  async getCertificates(userId: string): Promise<UkepCertificate[]> {
    // VENDOR MAPPING: DSS certificate list for the user's key container.
    return this.http.request<UkepCertificate[]>({
      method: 'GET',
      path: '/certificates',
      query: { userId },
    });
  }

  async signDocument(documentHash: string, certificateId: string): Promise<UkepSignature> {
    return this.http.request<UkepSignature>({
      method: 'POST',
      path: '/sign',
      body: { documentHash, certificateId },
      // Signing the same hash with the same cert must be idempotent.
      idempotencyKey: `dss-sign:${certificateId}:${documentHash}`,
    });
  }

  async verifySignature(documentHash: string, signature: UkepSignature): Promise<UkepVerificationResult> {
    return this.http.request<UkepVerificationResult>({
      method: 'POST',
      path: '/verify',
      body: { documentHash, signature },
    });
  }

  async checkCertificateStatus(certificateId: string): Promise<'valid' | 'revoked' | 'expired'> {
    const res = await this.http.request<{ status: 'valid' | 'revoked' | 'expired' }>({
      method: 'GET',
      path: `/certificates/${encodeURIComponent(certificateId)}/status`,
    });
    return res.status;
  }

  async batchSign(documentHashes: string[], certificateId: string): Promise<UkepSignature[]> {
    return this.http.request<UkepSignature[]>({
      method: 'POST',
      path: '/sign/batch',
      body: { documentHashes, certificateId },
      idempotencyKey: `dss-batch:${certificateId}:${documentHashes.length}:${documentHashes[0] ?? ''}`,
    });
  }
}
