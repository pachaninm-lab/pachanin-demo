import { describe, expect, it } from 'vitest';

import {
  buildGovIdentityStartUrl,
  isAllowedGovIdentityDestination,
  parseAllowedHosts,
  type GovIdentityBridgeConfig,
} from '@/lib/platform-v7/govIdentityBridge';

/**
 * ASVS 5.0 V3.7.2.
 *
 * The authorization endpoint is read from the environment and used to be handed
 * straight to NextResponse.redirect - whatever it said, whatever its scheme. The
 * one redirect this application makes to a hostname it does not control had no
 * allowlist at all.
 */

function config(overrides: Partial<GovIdentityBridgeConfig> = {}): GovIdentityBridgeConfig {
  return {
    enabled: true,
    authorizationUrl: 'https://id.example.gov/authorize',
    clientId: 'client',
    redirectUri: 'https://app.example.ru/api/platform-v7/gov-id/callback',
    scope: 'openid',
    allowedHosts: ['id.example.gov'],
    ...overrides,
  };
}

describe('gov-identity destination allowlist', () => {
  it('reads a comma-separated list, trimming and lowercasing', () => {
    expect(parseAllowedHosts(' ID.Example.gov , second.example.gov ')).toEqual(['id.example.gov', 'second.example.gov']);
    expect(parseAllowedHosts('one.example.gov,,  ,two.example.gov')).toEqual(['one.example.gov', 'two.example.gov']);
  });

  it('treats an unset or empty allowlist as permitting nothing', () => {
    expect(parseAllowedHosts(undefined)).toEqual([]);
    expect(parseAllowedHosts('')).toEqual([]);
    expect(parseAllowedHosts('   ')).toEqual([]);
  });

  it('permits an allowlisted https host, whatever its case', () => {
    expect(isAllowedGovIdentityDestination(new URL('https://id.example.gov/authorize'), ['id.example.gov'])).toBe(true);
    expect(isAllowedGovIdentityDestination(new URL('https://ID.EXAMPLE.GOV/authorize'), ['id.example.gov'])).toBe(true);
  });

  /** A suffix match would accept `id.example.gov.evil.example`. */
  it('matches the host exactly, so a lookalike domain is refused', () => {
    expect(isAllowedGovIdentityDestination(new URL('https://id.example.gov.evil.example/authorize'), ['id.example.gov'])).toBe(false);
    expect(isAllowedGovIdentityDestination(new URL('https://evil.example/id.example.gov'), ['id.example.gov'])).toBe(false);
    expect(isAllowedGovIdentityDestination(new URL('https://notid.example.gov/x'), ['id.example.gov'])).toBe(false);
  });

  it('refuses anything that is not https, however it is spelled', () => {
    expect(isAllowedGovIdentityDestination(new URL('http://id.example.gov/authorize'), ['id.example.gov'])).toBe(false);
    expect(isAllowedGovIdentityDestination(new URL('javascript:alert(1)'), ['id.example.gov'])).toBe(false);
    expect(isAllowedGovIdentityDestination(new URL('data:text/html,x'), ['id.example.gov'])).toBe(false);
  });

  it('builds the start URL when the destination is allowlisted', () => {
    const url = buildGovIdentityStartUrl(config(), 'state-value', 'nonce-value');
    expect(url?.origin).toBe('https://id.example.gov');
    expect(url?.searchParams.get('state')).toBe('state-value');
    expect(url?.searchParams.get('nonce')).toBe('nonce-value');
    expect(url?.searchParams.get('response_type')).toBe('code');
  });

  /**
   * The refusal that makes the requirement hold by construction: with no
   * allowlist there is no external destination, whatever the environment says.
   */
  it('refuses to build a start URL for a host nobody allowlisted', () => {
    expect(buildGovIdentityStartUrl(config({ allowedHosts: [] }), 's', 'n')).toBeNull();
    expect(buildGovIdentityStartUrl(config({ authorizationUrl: 'https://evil.example/authorize' }), 's', 'n')).toBeNull();
    expect(buildGovIdentityStartUrl(config({ authorizationUrl: 'http://id.example.gov/authorize' }), 's', 'n')).toBeNull();
  });

  it('refuses an authorization URL that cannot be parsed, instead of throwing', () => {
    expect(buildGovIdentityStartUrl(config({ authorizationUrl: 'not a url' }), 's', 'n')).toBeNull();
  });

  it('still refuses when the bridge is not configured at all', () => {
    expect(buildGovIdentityStartUrl(config({ enabled: false }), 's', 'n')).toBeNull();
    expect(buildGovIdentityStartUrl(config({ clientId: null }), 's', 'n')).toBeNull();
    expect(buildGovIdentityStartUrl(config({ redirectUri: null }), 's', 'n')).toBeNull();
  });
});
