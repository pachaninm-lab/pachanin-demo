/**
 * Factory that turns a resolved IntegrationConfig into a ready HttpIntegrationClient
 * with the right auth strategy wired in. This is the single seam every live adapter
 * uses, so an adapter never re-implements auth/transport.
 */

import { HttpIntegrationClient, type FetchLike, type Logger } from './http-integration-client';
import { apiKeyAuth, bearerAuth, noAuth, oauth2ClientCredentials } from './auth';
import { assertLiveReady, type IntegrationConfig } from './integration-config';

export interface BuildClientDeps {
  readonly fetchImpl?: FetchLike;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly logger?: Logger;
}

export function buildAuthProvider(config: IntegrationConfig, fetchImpl?: FetchLike) {
  switch (config.auth) {
    case 'api_key':
      return apiKeyAuth(config.apiKeyHeader, config.apiKey ?? '');
    case 'bearer':
      return bearerAuth(config.bearerToken ?? '');
    case 'oauth2':
      return oauth2ClientCredentials({
        tokenUrl: config.oauth?.tokenUrl ?? '',
        clientId: config.oauth?.clientId ?? '',
        clientSecret: config.oauth?.clientSecret ?? '',
        scope: config.oauth?.scope,
        fetchImpl,
      });
    case 'none':
    default:
      return noAuth();
  }
}

export function buildHttpClient(config: IntegrationConfig, deps: BuildClientDeps = {}): HttpIntegrationClient {
  assertLiveReady(config);
  return new HttpIntegrationClient({
    name: config.name,
    baseUrl: config.baseUrl ?? '',
    auth: buildAuthProvider(config, deps.fetchImpl),
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
    fetchImpl: deps.fetchImpl,
    sleep: deps.sleep,
    logger: deps.logger,
  });
}
