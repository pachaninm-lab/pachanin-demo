import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import { AuctionAuthorityService } from './auction-authority.service';
import {
  AuctionCommandService,
  type CloseAuctionLotInput,
  type PlaceAuctionBidInput,
  type RecordAuctionAdmissionInput,
} from './auction-command.service';
import { validateAuctionInventoryRegistration } from './auction-inventory.contract';
import { RegisterAuctionInventoryLotDto } from './dto/auction-inventory.dto';

@UseGuards(RolesGuard)
@Roles('FARMER', 'BUYER', 'SUPPORT_MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER', 'EXECUTIVE')
@Controller('auctions')
export class AuctionsController {
  constructor(
    private readonly authority: AuctionAuthorityService,
    private readonly commands: AuctionCommandService,
  ) {}

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

  @Post('lots')
  @Roles('FARMER')
  @RateLimit({ name: 'auction_register_lot', scope: 'org', limit: 10, windowSeconds: 60 })
  registerLot(
    @Body() _dto: RegisterAuctionInventoryLotDto,
    @CurrentUser() user: RequestUser,
    @Req() request: Pick<Request, 'body'>,
  ) {
    const body: unknown = request.body;
    validateAuctionInventoryRegistration(body);
    return this.commands.registerLot(body, user);
  }

  @Post('lots/:lotId/admissions')
  @Roles('ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER')
  @RateLimit({
    name: 'auction_record_admission',
    scope: 'org',
    limit: 20,
    windowSeconds: 60,
    includeParams: ['lotId'],
  })
  recordAdmission(
    @Param('lotId') lotId: string,
    @Body() body: RecordAuctionAdmissionInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.commands.recordAdmission(
      lotId,
      body ?? ({} as RecordAuctionAdmissionInput),
      user,
    );
  }

  @Post('lots/:lotId/bids')
  @Roles('BUYER')
  @RateLimit({
    name: 'auction_place_bid',
    scope: 'org',
    limit: 30,
    windowSeconds: 60,
    includeParams: ['lotId'],
  })
  placeBid(
    @Param('lotId') lotId: string,
    @Body() body: PlaceAuctionBidInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.commands.placeBid(lotId, body ?? ({} as PlaceAuctionBidInput), user);
  }

  @Post('lots/:lotId/close')
  @Roles('FARMER', 'ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER')
  @RateLimit({
    name: 'auction_close_lot',
    scope: 'org',
    limit: 10,
    windowSeconds: 60,
    includeParams: ['lotId'],
  })
  closeLot(
    @Param('lotId') lotId: string,
    @Body() body: CloseAuctionLotInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.commands.closeLot(lotId, body ?? ({} as CloseAuctionLotInput), user);
  }
}
