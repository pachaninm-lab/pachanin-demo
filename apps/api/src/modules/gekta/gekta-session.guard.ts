import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { RequestProductUser } from '../../common/types/product-session';
import type { RequestUser } from '../../common/types/request-user';

/**
 * Вход в кабинет Гекты.
 *
 * Гекту используют два разных актора, и оба обязаны быть уже проверены
 * AppAuthGuard по живой сессии в PostgreSQL:
 *
 *   1. пользователь платформы — у него есть организация, членство и роль;
 *   2. пользователь продукта — у него нет ничего из этого, только аккаунт.
 *
 * Guard не расширяет права: он лишь приводит два уже проверенных актора к
 * одному идентификатору пользователя. Продуктовая сессия при этом не
 * превращается в платформенную — request.user для неё остаётся пустым,
 * поэтому операторский маршрут Гекты и любой маршрут «Прозрачной Цены»,
 * построенные на JwtAuthGuard, продолжают её отклонять.
 */

export type GektaActorSource = 'PLATFORM' | 'PRODUCT';

export type GektaActor = {
  userId: string;
  source: GektaActorSource;
};

export type GektaSessionRequest = {
  user?: RequestUser;
  productUser?: RequestProductUser;
  gektaActor?: GektaActor;
};

/** Платформенный актор считается пригодным только с полным серверным контекстом. */
export function platformActorOf(user: RequestUser | undefined): GektaActor | null {
  if (!user?.id || !user.sessionId || !user.membershipId || !user.orgId || !user.tenantId || !user.role) {
    return null;
  }
  return { userId: user.id, source: 'PLATFORM' };
}

export function productActorOf(productUser: RequestProductUser | undefined): GektaActor | null {
  if (!productUser?.id || !productUser.sessionId || productUser.scope !== 'GEKTA') return null;
  return { userId: productUser.id, source: 'PRODUCT' };
}

export function resolveGektaActor(request: GektaSessionRequest): GektaActor | null {
  return platformActorOf(request.user) ?? productActorOf(request.productUser);
}

@Injectable()
export class GektaSessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<GektaSessionRequest>();
    const actor = resolveGektaActor(request);
    if (!actor) throw new UnauthorizedException('Verified server session is required');
    request.gektaActor = actor;
    return true;
  }
}
