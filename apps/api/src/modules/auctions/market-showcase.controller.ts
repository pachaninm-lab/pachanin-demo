import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MarketShowcaseService } from './market-showcase.service';

/**
 * Публичная (внутриплатформенная) витрина открытых лотов.
 *
 * Доступна всем допущенным покупателям и надзорным ролям платформы независимо
 * от tenant продавца. Возвращает только обезличенные данные лота — состав
 * колонок зафиксирован SQL-функцией market.list_open_lots.
 */
@UseGuards(RolesGuard)
@Controller('market')
export class MarketShowcaseController {
  constructor(private readonly showcase: MarketShowcaseService) {}

  @Get('lots')
  @Roles('BUYER', 'FARMER', 'SUPPORT_MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER', 'EXECUTIVE')
  @RateLimit({ name: 'market_list_open_lots', scope: 'user', limit: 60, windowSeconds: 60 })
  listOpenLots(
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.showcase.listOpenLots(limit, cursor);
  }
}
