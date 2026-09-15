import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ForbiddenException } from '@nestjs/common';

import { AppAuthGuard } from './auth.guard';
import { AuthService } from '../../modules/auth/auth.service';

/**
 * ASVS 5.0 V7.5.3: further authentication with at least one factor, or
 * secondary verification, before a highly sensitive operation.
 *
 * Releasing funds is the most sensitive operation this platform performs, and
 * the gate that guards it lives in the global auth guard rather than in the
 * command policy or the command service - which is why it is easy to look for
 * it in the wrong file and conclude it is absent. These run the real guard so
 * the gate is proven by behaviour, and pin the two couplings it depends on: the
 * command id being in the set, and the route actually carrying that id as the
 * parameter the guard reads.
 */

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

function context(actionId: string) {
  const request = {
    headers: { authorization: 'Bearer token' },
    params: { actionId },
    body: {},
    originalUrl: `/api/deals/deal-1/commands/${actionId}`,
  };
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }),
  } as never;
}

function guard(user: unknown) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
  const authService = {
    verifyAccessToken: jest.fn().mockResolvedValue(user),
    // The real implementation, so the freshness arithmetic is not faked away.
    assertRecentFinancialMfa: AuthService.prototype.assertRecentFinancialMfa,
  };
  return new AppAuthGuard(
    reflector as never,
    authService as never,
    { enrichActor: jest.fn() } as never,
    { tryVerifyAccessToken: jest.fn() } as never,
  );
}

const verifiedAgo = (ms: number) => ({
  id: 'u1',
  mfaVerified: true,
  mfaVerifiedAt: new Date(Date.now() - ms).toISOString(),
});

describe('releasing funds needs a recently proven second factor', () => {
  it('refuses a session whose second factor was proven too long ago', async () => {
    const user = verifiedAgo(FIFTEEN_MINUTES_MS + 60_000);
    await expect(guard(user).canActivate(context('request_release')))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a session that never proved one', async () => {
    const user = { id: 'u1', mfaVerified: false };
    await expect(guard(user).canActivate(context('request_release')))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('admits a session that proved one within the window', async () => {
    const user = verifiedAgo(60_000);
    await expect(guard(user).canActivate(context('request_release'))).resolves.toBe(true);
  });

  it('guards the reserve command the same way', async () => {
    const user = verifiedAgo(FIFTEEN_MINUTES_MS + 60_000);
    await expect(guard(user).canActivate(context('request_reserve')))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not impose the same gate on an ordinary command', async () => {
    // Recorded so the boundary is visible: this is a step-up for the money
    // commands, not a blanket freshness requirement on every request.
    const user = verifiedAgo(FIFTEEN_MINUTES_MS + 60_000);
    await expect(guard(user).canActivate(context('confirm_documents'))).resolves.toBe(true);
  });
});

describe('the couplings the gate depends on', () => {
  const guardSource = readFileSync(join(__dirname, 'auth.guard.ts'), 'utf8');
  const controllerSource = readFileSync(
    join(__dirname, '..', '..', 'modules', 'deals', 'deals.controller.ts'),
    'utf8',
  );

  it('names the money commands in the set the guard consults', () => {
    expect(guardSource).toContain("'request_release'");
    expect(guardSource).toContain("'request_reserve'");
  });

  it('reads the command id from the route parameter the route actually declares', () => {
    // The guard keys off req.params.actionId. A route that carried the command
    // somewhere else - in the body, or under another parameter name - would
    // leave the gate looking at an empty string and silently admitting.
    expect(guardSource).toContain("req.params?.actionId");
    expect(controllerSource).toContain("@Post(':id/commands/:actionId')");
    expect(controllerSource).toContain("@Param('actionId')");
  });

  it('asks for the threshold itself, so the gate does not depend on a declared amount', () => {
    // Passing FINANCIAL_MFA_THRESHOLD_KOPECKS rather than the body amount is
    // what makes the release command always gated: a request that declared no
    // amount, or a small one, would otherwise walk past.
    expect(guardSource).toContain('assertRecentFinancialMfa(req.user, FINANCIAL_MFA_THRESHOLD_KOPECKS)');
  });
});
