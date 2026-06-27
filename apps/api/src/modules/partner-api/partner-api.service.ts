import { ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser } from '../../common/types/request-user';

export interface ApiKey {
  id: string;
  orgId: string;
  name: string;
  keyHash: string;
  prefix: string;
  scopes: string[];
  rateLimit: number;
  expiresAt: string;
  createdByUserId: string;
  createdAt: string;
  revokedAt?: string;
}

export interface WebhookSubscription {
  id: string;
  orgId: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: string;
}

const AVAILABLE_SCOPES = ['deals:read', 'deals:write', 'shipments:read', 'documents:read', 'payments:read'];

@Injectable()
export class PartnerApiService {
  private readonly logger = new Logger(PartnerApiService.name);
  private readonly apiKeys = new Map<string, ApiKey>();
  private readonly webhooks = new Map<string, WebhookSubscription>();

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  generateApiKey(
    params: { name: string; scopes: string[]; rateLimit?: number; expiresInDays?: number },
    user: RequestUser,
  ): { apiKey: string; keyId: string; prefix: string; expiresAt: string } {
    const invalidScopes = params.scopes.filter((s) => !AVAILABLE_SCOPES.includes(s));
    if (invalidScopes.length > 0) throw new ForbiddenException(`Unknown scopes: ${invalidScopes.join(', ')}`);

    const rawKey = `gf_${randomBytes(32).toString('hex')}`;
    const prefix = rawKey.slice(0, 12);
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const expiresAt = new Date(Date.now() + (params.expiresInDays ?? 90) * 86_400_000).toISOString();

    const id = `apikey-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: ApiKey = {
      id,
      orgId: user.orgId,
      name: params.name,
      keyHash,
      prefix,
      scopes: params.scopes,
      rateLimit: params.rateLimit ?? 100,
      expiresAt,
      createdByUserId: user.id,
      createdAt: new Date().toISOString(),
    };
    this.apiKeys.set(id, entry);
    this.logger.log(`API key generated: id=${id} org=${user.orgId} scopes=${params.scopes.join(',')}`);
    return { apiKey: rawKey, keyId: id, prefix, expiresAt };
  }

  listApiKeys(user: RequestUser): Omit<ApiKey, 'keyHash'>[] {
    return Array.from(this.apiKeys.values())
      .filter((k) => k.orgId === user.orgId && !k.revokedAt)
      .map(({ keyHash: _, ...rest }) => rest);
  }

  revokeApiKey(keyId: string, user: RequestUser): { revoked: boolean } {
    const key = this.apiKeys.get(keyId);
    if (!key) throw new NotFoundException(`API key ${keyId} not found`);
    if (key.orgId !== user.orgId) throw new ForbiddenException('Cannot revoke key belonging to another org');
    key.revokedAt = new Date().toISOString();
    return { revoked: true };
  }

  verifyApiKey(rawKey: string): ApiKey | null {
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    for (const key of this.apiKeys.values()) {
      if (key.keyHash === keyHash && !key.revokedAt && new Date(key.expiresAt) > new Date()) {
        return key;
      }
    }
    return null;
  }

  subscribeWebhook(
    params: { url: string; events: string[] },
    user: RequestUser,
  ): { subscriptionId: string; secret: string } {
    const id = `wh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const secret = `whsec_${randomBytes(24).toString('hex')}`;
    const sub: WebhookSubscription = {
      id,
      orgId: user.orgId,
      url: params.url,
      events: params.events,
      secret,
      active: true,
      createdAt: new Date().toISOString(),
    };
    this.webhooks.set(id, sub);
    this.logger.log(`Webhook subscribed: id=${id} org=${user.orgId} url=${params.url}`);
    return { subscriptionId: id, secret };
  }

  listWebhooks(user: RequestUser): Omit<WebhookSubscription, 'secret'>[] {
    return Array.from(this.webhooks.values())
      .filter((w) => w.orgId === user.orgId)
      .map(({ secret: _, ...rest }) => rest);
  }

  deleteWebhook(id: string, user: RequestUser): { deleted: boolean } {
    const wh = this.webhooks.get(id);
    if (!wh) throw new NotFoundException(`Webhook ${id} not found`);
    if (wh.orgId !== user.orgId) throw new ForbiddenException('Cannot delete webhook of another org');
    this.webhooks.delete(id);
    return { deleted: true };
  }

  getPartnerDealStatus(dealId: string, apiKey: ApiKey): { dealId: string; status: string; updatedAt: string } {
    if (!apiKey.scopes.includes('deals:read')) throw new ForbiddenException('API key missing deals:read scope');
    return { dealId, status: 'PUBLISHED', updatedAt: new Date().toISOString() };
  }
}
