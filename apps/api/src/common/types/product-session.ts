/**
 * Идентичность продуктовой сессии.
 *
 * Тип намеренно не совместим с RequestUser: у него нет ни orgId, ни tenantId,
 * ни membershipId, ни role. Поэтому продуктовую сессию нельзя передать туда,
 * где ожидается платформенный актор, — это не соглашение об именовании, а
 * запрет на уровне компиляции.
 *
 * Продуктовая сессия живёт в отдельном поле запроса (`request.productUser`),
 * а `request.user` для неё остаётся пустым. Любой существующий платформенный
 * guard, читающий `request.user`, отклоняет её без единой правки.
 */
export const PRODUCT_SESSION_SCOPES = ['GEKTA'] as const;

export type ProductSessionScope = typeof PRODUCT_SESSION_SCOPES[number];

export function isProductSessionScope(value: unknown): value is ProductSessionScope {
  return typeof value === 'string' && (PRODUCT_SESSION_SCOPES as readonly string[]).includes(value);
}

export type RequestProductUser = {
  id: string;
  email: string;
  fullName: string;
  sessionId: string;
  scope: ProductSessionScope;
  credentialVersion: number;
  mfaVerified: boolean;
  mfaVerifiedAt?: string;
};

/** Запрос, к которому AppAuthGuard мог приложить продуктовую сессию. */
export type ProductSessionRequest = {
  productUser?: RequestProductUser;
};
