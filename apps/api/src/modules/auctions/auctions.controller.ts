import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import { AuctionAuthorityService } from './auction-authority.service';

@UseGuards(RolesGuard)
@Roles('FARMER', 'BUYER', 'SUPPORT_MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER', 'EXECUTIVE')
@Controller('auctions')
export class AuctionsController {
  constructor(private readonly authority: AuctionAuthorityService) {}

  @Get('origin-modes')
  originModes(@CurrentUser() user: RequestUser) {
    return this.authority.listOriginModes(user);
  }

  @Get('lots/:lotId/workspace')
  workspace(
    @Param('lotId') lotId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.authority.getWorkspace(lotId, user);
  }
}
