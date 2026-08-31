import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GektaController, GektaOperatorController } from '../../modules/gekta/gekta.controller';
import { PRODUCT_SESSION_ROUTE } from '../decorators/product-session.decorator';
import { PUBLIC_ROUTE, PUBLIC_ROUTE_OPTIONS } from '../decorators/public.decorator';
import type { RequestProductUser } from '../types/product-session';
import { Role, type RequestUser } from '../types/request-user';
import { AppAuthGuard } from './auth.guard';

const productUser: RequestProductUser = {
  id: 'user-product',
  email: 'agronom@example.test',
  fullName: 'Агроном',
  sessionId: 'session-product',
  scope: 'GEKTA',
  credentialVersion: 1,
  mfaVerified: true,
};

const platformUser: RequestUser = {
  id: 'user-platform',
  email: 'owner@example.test',
  fullName: 'Owner',
  role: Role.FARMER,
  orgId: 'org-1',
  tenantId: 'tenant-1',
  membershipId: 'membership-1',
  sessionId: 'session-platform',
  isOrgAdmin: false,
  mfaVerified: false,
};

function requestContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function route() {},
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
}

function guard(allowsProductSession: boolean) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === PUBLIC_ROUTE) return false;
      if (key === PUBLIC_ROUTE_OPTIONS) return {};
      if (key === PRODUCT_SESSION_ROUTE) return allowsProductSession;
      return undefined;
    }),
  };
  const authService = {
    verifyAccessToken: jest.fn(),
    assertRecentFinancialMfa: jest.fn(),
  };
  const staffAccess = {
    enrichActor: jest.fn(),
    resolveAccessSession: jest.fn(),
  };
  const productSessions = {
    tryVerifyAccessToken: jest.fn(),
  };
  return {
    instance: new AppAuthGuard(
      reflector as never,
      authService as never,
      staffAccess as never,
      productSessions as never,
    ),
    authService,
    productSessions,
  };
}

describe('AppAuthGuard product-session boundary', () => {
  it('never resolves a product session on an unmarked protected route', async () => {
    const boundary = guard(false);
    boundary.productSessions.tryVerifyAccessToken.mockResolvedValue(productUser);
    boundary.authService.verifyAccessToken.mockRejectedValue(new UnauthorizedException('SESSION_NOT_FOUND'));
    const request = { headers: { authorization: 'Bearer product-token' }, params: {}, body: {} };

    await expect(boundary.instance.canActivate(requestContext(request)))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(boundary.productSessions.tryVerifyAccessToken).not.toHaveBeenCalled();
    expect(request).not.toHaveProperty('productUser');
  });

  it('accepts a product session only on an explicit opt-in route', async () => {
    const boundary = guard(true);
    boundary.productSessions.tryVerifyAccessToken.mockResolvedValue(productUser);
    const request = { headers: { authorization: 'Bearer product-token' }, params: {}, body: {} };

    await expect(boundary.instance.canActivate(requestContext(request))).resolves.toBe(true);
    expect(request).toHaveProperty('productUser', productUser);
    expect(boundary.authService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('still accepts a platform session on the dual-actor Gekta surface', async () => {
    const boundary = guard(true);
    boundary.productSessions.tryVerifyAccessToken.mockResolvedValue(null);
    boundary.authService.verifyAccessToken.mockResolvedValue(platformUser);
    const request = { headers: { authorization: 'Bearer platform-token' }, params: {}, body: {} };

    await expect(boundary.instance.canActivate(requestContext(request))).resolves.toBe(true);
    expect(request).toHaveProperty('user', platformUser);
  });

  it('marks only the user account controller, never the operator controller', () => {
    const reflector = new Reflector();
    expect(reflector.get(PRODUCT_SESSION_ROUTE, GektaController)).toBe(true);
    expect(reflector.get(PRODUCT_SESSION_ROUTE, GektaOperatorController)).not.toBe(true);
  });
});
