import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LogisticsService } from './logistics.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { TransitionShipmentDto } from './dto/transition-shipment.dto';

@UseGuards(RolesGuard)
@Roles('LOGISTICIAN', 'DRIVER', 'SUPPORT_MANAGER', 'ADMIN')
@Controller('logistics')
export class LogisticsController {
  constructor(private readonly logistics: LogisticsService) {}

  @Get('summary')
  summary(@CurrentUser() user: any) {
    return this.logistics.summary(user);
  }

  @Get('shipments')
  list(@CurrentUser() user: any) {
    return this.logistics.list(user);
  }

  @Get('shipments/:id')
  getOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.logistics.getOne(id, user);
  }

  @Get('shipments/:id/workspace')
  workspace(@Param('id') id: string, @CurrentUser() user: any) {
    return this.logistics.workspace(id, user);
  }

  @Post('shipments')
  create(@Body() dto: CreateShipmentDto, @CurrentUser() user: any) {
    return this.logistics.create(dto, user);
  }

  @Patch('shipments/:id/transition')
  transition(@Param('id') id: string, @Body() dto: TransitionShipmentDto, @CurrentUser() user: any) {
    return this.logistics.transition(id, dto, user);
  }

  @Patch('shipments/:id/status')
  transitionCompat(@Param('id') id: string, @Body() body: { status?: string; nextState?: string; lat?: number; lng?: number; comment?: string }, @CurrentUser() user: any) {
    return this.logistics.transition(id, { nextState: (body?.nextState || body?.status || '') as any, lat: body?.lat, lng: body?.lng, comment: body?.comment }, user);
  }

  @Post('shipments/:id/checkpoints')
  checkpoint(@Param('id') id: string, @Body() body: { type?: string; lat?: number; lng?: number; comment?: string; timestamp?: string }, @CurrentUser() user: any) {
    return this.logistics.recordCheckpoint(id, body, user);
  }

  @Post('shipments/:id/verify-pin')
  verifyPin(@Param('id') id: string, @Body() body: { pin?: string }, @CurrentUser() user: any) {
    return this.logistics.verifyPin(id, String(body?.pin || ''), user);
  }
}
