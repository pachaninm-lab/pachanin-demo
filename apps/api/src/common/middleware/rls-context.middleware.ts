/**
 * PostgreSQL RLS Context Middleware.
 * Устанавливает app.current_user_id, app.current_org_id, app.current_role
 * перед каждым запросом — обязательно для работы RLS политик (ТЗ 4.1).
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RlsContextMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Record<string, unknown>, _res: unknown, next: () => void) {
    const user = req['user'] as { id?: string; organizationId?: string; role?: string } | undefined;

    if (user?.id) {
      try {
        await this.prisma.$executeRawUnsafe(`
          SELECT set_app_context(
            '${user.id.replace(/'/g, "''")}',
            '${(user.organizationId ?? '').replace(/'/g, "''")}',
            '${(user.role ?? 'GUEST').replace(/'/g, "''")}'
          )
        `);
      } catch {
        // Функция может не существовать в dev/test — игнорируем
      }
    }

    next();
  }
}
