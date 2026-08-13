import { UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { requireSecret } from '../../common/config/secrets';

/**
 * Единственный формат access-токена платформы.
 *
 * Продукт Гекта пользуется этим же токеном и этим же секретом: второй системы
 * токенов не создаётся. Область действия сессии в токен не кладётся — она
 * читается из auth.sessions при каждой проверке, поэтому подменить её на
 * стороне клиента невозможно.
 */

const JWT_SECRET = requireSecret('JWT_SECRET');
const ACCESS_TOKEN_TTL = '15m';
const ACCESS_ISSUER = 'transparent-price-api';
const ACCESS_AUDIENCE = 'transparent-price-platform';

export type AccessClaims = jwt.JwtPayload & {
  sub: string;
  sid: string;
  typ: 'access';
};

export function signAccessToken(userId: string, sessionId: string, credentialVersion: number): string {
  return jwt.sign(
    {
      typ: 'access',
      sid: sessionId,
      cv: credentialVersion,
    },
    JWT_SECRET,
    {
      subject: userId,
      issuer: ACCESS_ISSUER,
      audience: ACCESS_AUDIENCE,
      expiresIn: ACCESS_TOKEN_TTL,
      jwtid: randomUUID(),
    },
  );
}

export function verifyAccessClaims(token: string): AccessClaims {
  try {
    const raw = jwt.verify(token, JWT_SECRET, {
      issuer: ACCESS_ISSUER,
      audience: ACCESS_AUDIENCE,
    });
    if (
      typeof raw === 'string'
      || raw.typ !== 'access'
      || typeof raw.sub !== 'string'
      || typeof raw.sid !== 'string'
    ) {
      throw new Error('Invalid access claims');
    }
    return raw as AccessClaims;
  } catch {
    throw new UnauthorizedException('Invalid or expired access token');
  }
}
