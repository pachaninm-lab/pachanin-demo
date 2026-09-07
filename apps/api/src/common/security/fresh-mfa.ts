import { ForbiddenException } from '@nestjs/common';

import type { RequestUser } from '../types/request-user';

/**
 * Повторная аутентификация перед изменением чувствительных атрибутов учётной
 * записи (ASVS V7.5.1).
 *
 * Проверка уже существовала в дереве в пяти местах, объявленная заново в каждом,
 * и в двух РАЗНЫХ смыслах: часть допускает 30 секунд расхождения часов вперёд,
 * часть отвергает любой отрицательный возраст. Здесь она сведена в одно место с
 * явно записанной семантикой, чтобы новый вызывающий не выбирал случайно.
 *
 * Смысл именно такой:
 *  - фактор должен быть подтверждён (mfaVerified), а не просто настроен;
 *  - отметка должна разбираться как время: нечитаемая даёт NaN и отвергается,
 *    потому что любое сравнение с NaN ложно;
 *  - подтверждение должно быть свежим - в пределах окна;
 *  - отметка из будущего допустима лишь на расхождение часов, иначе она была бы
 *    способом сделать подтверждение вечно свежим.
 */
export const MFA_FRESHNESS_WINDOW_MS = 15 * 60 * 1000;

/** Допуск на расхождение часов между узлами; больше - отметка из будущего. */
export const MFA_CLOCK_SKEW_TOLERANCE_MS = 30_000;

export function isFreshMfa(
  user: Pick<RequestUser, 'mfaVerified' | 'mfaVerifiedAt'> | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!user?.mfaVerified) return false;
  const verifiedAt = Date.parse(String(user.mfaVerifiedAt || ''));
  if (verifiedAt > now + MFA_CLOCK_SKEW_TOLERANCE_MS) return false;
  // Нечитаемая отметка даёт NaN, а любое сравнение с NaN ложно, поэтому она
  // отвергается последней строкой сама. Отдельная проверка на Number.isFinite
  // здесь стояла и была снята: доказать её мутацией невозможно, а недоказуемая
  // строка в контроле безопасности хуже, чем её отсутствие. Свойство закреплено
  // тестом, а не этой строкой.
  return now - verifiedAt <= MFA_FRESHNESS_WINDOW_MS;
}

/**
 * @throws ForbiddenException с кодом FRESH_MFA_REQUIRED - тем же, что уже
 * возвращают существующие площадки, чтобы клиент не различал их по коду.
 */
export function requireFreshMfa(
  user: Pick<RequestUser, 'mfaVerified' | 'mfaVerifiedAt'> | null | undefined,
  now: number = Date.now(),
): void {
  if (!isFreshMfa(user, now)) {
    throw new ForbiddenException({ code: 'FRESH_MFA_REQUIRED' });
  }
}
