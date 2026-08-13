import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { RequestProductUser } from '../../common/types/product-session';
import { Role, type RequestUser } from '../../common/types/request-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GektaSessionGuard, resolveGektaActor, type GektaSessionRequest } from './gekta-session.guard';
import { GektaOperatorGuard } from './gekta-operator.guard';
import { Reflector } from '@nestjs/core';

const platformUser: RequestUser = {
  id: 'user-1',
  email: 'owner@example.test',
  orgId: 'org-1',
  tenantId: 'tenant-1',
  membershipId: 'membership-1',
  role: Role.FARMER,
  sessionId: 'ses-platform-1',
};

const productUser: RequestProductUser = {
  id: 'user-2',
  email: 'agronom@example.test',
  fullName: 'Агроном',
  sessionId: 'ses-gekta-1',
  scope: 'GEKTA',
  credentialVersion: 1,
  mfaVerified: true,
};

function contextFor(request: GektaSessionRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('Кабинет Гекты принимает двух разных проверенных акторов', () => {
  it('пропускает пользователя платформы', () => {
    const request: GektaSessionRequest = { user: platformUser };
    expect(new GektaSessionGuard().canActivate(contextFor(request))).toBe(true);
    expect(request.gektaActor).toEqual({ userId: 'user-1', source: 'PLATFORM' });
  });

  it('пропускает пользователя продукта без организации', () => {
    const request: GektaSessionRequest = { productUser };
    expect(new GektaSessionGuard().canActivate(contextFor(request))).toBe(true);
    expect(request.gektaActor).toEqual({ userId: 'user-2', source: 'PRODUCT' });
  });

  it('отклоняет запрос без единой проверенной сессии', () => {
    expect(() => new GektaSessionGuard().canActivate(contextFor({}))).toThrow(UnauthorizedException);
  });

  it('не принимает продуктовую сессию с чужой областью действия', () => {
    const foreign = { ...productUser, scope: 'PLATFORM' as unknown as RequestProductUser['scope'] };
    expect(resolveGektaActor({ productUser: foreign })).toBeNull();
  });

  it('не принимает неполный платформенный контекст', () => {
    for (const missing of ['sessionId', 'membershipId', 'orgId', 'tenantId', 'role'] as const) {
      const partial = { ...platformUser, [missing]: undefined } as unknown as RequestUser;
      expect(resolveGektaActor({ user: partial })).toBeNull();
    }
  });

  it('предпочитает платформенного актора, когда присутствуют оба', () => {
    expect(resolveGektaActor({ user: platformUser, productUser })).toEqual({
      userId: 'user-1',
      source: 'PLATFORM',
    });
  });
});

describe('Продуктовая сессия не открывает ни одного закрытого маршрута', () => {
  it('отклоняется платформенным guard, на котором построена «Прозрачная Цена»', () => {
    // request.user для продуктовой сессии остаётся пустым, поэтому отказ
    // происходит без единой правки в самом JwtAuthGuard.
    expect(() => new JwtAuthGuard().canActivate(contextFor({ productUser })))
      .toThrow(UnauthorizedException);
  });

  it('не получает ни одной операторской роли Гекты', async () => {
    const guard = new GektaOperatorGuard(
      new Reflector(),
      { enrichActor: jest.fn() } as never,
    );
    // Операторский маршрут читает актора из request.user: у продуктовой
    // сессии его нет, поэтому ролей тоже нет.
    await expect(guard.canActivate(contextFor({ productUser }) as ExecutionContext))
      .rejects.toBeInstanceOf(Error);
  });
});
