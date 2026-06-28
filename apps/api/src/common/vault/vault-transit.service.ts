/**
 * Vault Transit encryption для ПДн (персональные данные).
 * Шифрует чувствительные поля через Vault Transit API (AES256-GCM96).
 * В dev-режиме без VAULT_ADDR — возвращает base64 stub.
 */

import { Injectable, Logger } from '@nestjs/common';

const VAULT_ADDR = process.env.VAULT_ADDR || 'http://vault:8200';
const VAULT_TOKEN = process.env.VAULT_TOKEN || '';
const TRANSIT_KEY = 'grainflow-pdn';

@Injectable()
export class VaultTransitService {
  private readonly logger = new Logger(VaultTransitService.name);
  private readonly devMode = !process.env.VAULT_ADDR;

  async encrypt(plaintext: string): Promise<string> {
    if (this.devMode) {
      return `stub:${Buffer.from(plaintext).toString('base64')}`;
    }
    try {
      const b64 = Buffer.from(plaintext, 'utf-8').toString('base64');
      const resp = await fetch(`${VAULT_ADDR}/v1/transit/encrypt/${TRANSIT_KEY}`, {
        method: 'POST',
        headers: {
          'X-Vault-Token': VAULT_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plaintext: b64 }),
      });
      if (!resp.ok) throw new Error(`Vault encrypt failed: ${resp.status}`);
      const data = await resp.json();
      return data.data.ciphertext as string;
    } catch (err) {
      this.logger.error(`Transit encrypt failed: ${err}`);
      throw err;
    }
  }

  async decrypt(ciphertext: string): Promise<string> {
    if (this.devMode || ciphertext.startsWith('stub:')) {
      return Buffer.from(ciphertext.replace('stub:', ''), 'base64').toString('utf-8');
    }
    try {
      const resp = await fetch(`${VAULT_ADDR}/v1/transit/decrypt/${TRANSIT_KEY}`, {
        method: 'POST',
        headers: {
          'X-Vault-Token': VAULT_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ciphertext }),
      });
      if (!resp.ok) throw new Error(`Vault decrypt failed: ${resp.status}`);
      const data = await resp.json();
      return Buffer.from(data.data.plaintext as string, 'base64').toString('utf-8');
    } catch (err) {
      this.logger.error(`Transit decrypt failed: ${err}`);
      throw err;
    }
  }

  async encryptFields<T extends Record<string, unknown>>(
    obj: T,
    fields: (keyof T)[],
  ): Promise<T> {
    const result = { ...obj };
    for (const field of fields) {
      const val = result[field];
      if (typeof val === 'string' && val) {
        (result as Record<string, unknown>)[field as string] = await this.encrypt(val);
      }
    }
    return result;
  }

  async decryptFields<T extends Record<string, unknown>>(
    obj: T,
    fields: (keyof T)[],
  ): Promise<T> {
    const result = { ...obj };
    for (const field of fields) {
      const val = result[field];
      if (typeof val === 'string' && val) {
        (result as Record<string, unknown>)[field as string] = await this.decrypt(val);
      }
    }
    return result;
  }
}
