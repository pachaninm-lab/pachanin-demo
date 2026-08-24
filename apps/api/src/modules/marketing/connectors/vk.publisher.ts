import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';

const VK_API_VERSION = '5.199';
const VK_WALL_POST_ENDPOINT = 'https://api.vk.com/method/wall.post';
const VK_TIMEOUT_MS = 10_000;

type VkWallPostResponse = {
  response?: { post_id?: number };
  error?: { error_code?: number };
};

export interface VkPublishResult {
  externalId: string;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ServiceUnavailableException(`Marketing connector is not configured: ${name}`);
  }
  return value;
}

function positiveIntegerEnvironment(name: string): number {
  const raw = requiredEnvironment(name);
  if (!/^\d+$/u.test(raw)) {
    throw new ServiceUnavailableException(`Marketing connector has invalid ${name}.`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ServiceUnavailableException(`Marketing connector has invalid ${name}.`);
  }
  return value;
}

function stableGuid(idempotencyKey: string): string {
  const normalized = idempotencyKey.trim();
  if (!normalized) throw new ServiceUnavailableException('Marketing idempotency key is required.');
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

@Injectable()
export class VkPublisher {
  async publish(
    text: string,
    idempotencyKey: string,
    isAdvertising: boolean,
  ): Promise<VkPublishResult> {
    const normalized = text.trim();
    if (!normalized) {
      throw new ServiceUnavailableException('VK content must not be empty.');
    }

    // Official wall.post schema currently requires a user access token even
    // when publishing as a community (`from_group=1`).
    const accessToken = requiredEnvironment('MARKETING_VK_USER_ACCESS_TOKEN');
    const groupId = positiveIntegerEnvironment('MARKETING_VK_GROUP_ID');
    const guid = stableGuid(idempotencyKey);

    const body = new URLSearchParams({
      access_token: accessToken,
      v: VK_API_VERSION,
      owner_id: String(-groupId),
      from_group: '1',
      message: normalized,
      guid,
      mark_as_ads: isAdvertising ? '1' : '0',
    });

    let response: Response;
    try {
      response = await fetch(VK_WALL_POST_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(VK_TIMEOUT_MS),
      });
    } catch {
      throw new ServiceUnavailableException('VK publish transport failed.');
    }

    let payload: VkWallPostResponse = {};
    try {
      payload = await response.json() as VkWallPostResponse;
    } catch {
      // Keep upstream body out of logs/errors; it is not trusted evidence.
    }

    const postId = payload.response?.post_id;
    if (!response.ok || !Number.isSafeInteger(postId) || (postId as number) <= 0 || payload.error) {
      const code = Number.isSafeInteger(payload.error?.error_code) ? ` API code ${payload.error?.error_code}` : '';
      throw new ServiceUnavailableException(`VK publish failed${code}.`);
    }

    return Object.freeze({ externalId: String(postId) });
  }
}
