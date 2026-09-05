import { BadRequestException, Body, Controller, Get, Post, Query, Res, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { InventoryError } from '../../../../../packages/domain-core/src/inventory';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import { InventoryCommandDto } from './dto/inventory-api.dto';
import { validateInventoryCommand } from './inventory.contract';
import { InventoryRepository } from './inventory.repository';

@UseGuards(RolesGuard)
@Roles('FARMER', 'BUYER', 'LOGISTICIAN', 'DRIVER', 'SURVEYOR', 'LAB', 'ELEVATOR', 'ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER', 'ARBITRATOR')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryRepository) {}

  @Get('me')
  @RateLimit({ name: 'inventory_me', scope: 'user', limit: 120, windowSeconds: 60 })
  list(@CurrentUser() user: RequestUser, @Query('after') after: string | undefined, @Res({ passthrough: true }) response: Response) {
    if (after !== undefined && (typeof after !== 'string' || !/^[A-Za-z0-9:_.-]{1,240}$/u.test(after))) {
      throw new BadRequestException({ code: 'INVENTORY_CURSOR_INVALID' });
    }
    response.setHeader('Cache-Control', 'private, no-store');
    return this.inventory.listOwn(user, after);
  }

  @Post('commands')
  @RateLimit({ name: 'inventory_command', scope: 'user', limit: 30, windowSeconds: 60 })
  async command(@CurrentUser() user: RequestUser, @Body() dto: InventoryCommandDto, @Res({ passthrough: true }) response: Response) {
    try {
      validateInventoryCommand(dto);
      const receipt = await this.inventory.execute(user, dto);
      response.setHeader('ETag', `"${receipt.position.stateVersion}"`);
      response.setHeader('Cache-Control', 'private, no-store');
      return receipt;
    } catch (error) {
      if (error instanceof InventoryError) throw new UnprocessableEntityException({ code: error.code });
      throw error;
    }
  }
}
