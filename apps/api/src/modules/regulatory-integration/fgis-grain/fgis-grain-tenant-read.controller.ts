import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import type { RequestUser } from '../../../common/types/request-user';
import {
  AttestFgisGrainTenantReadDto,
  AuthorizeFgisGrainTenantReadDto,
  ExecuteFgisGrainTenantReadDto,
} from '../dto/fgis-grain-tenant-read.dto';
import { FgisGrainTenantReadRepository } from './fgis-grain-tenant-read.repository';

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/u;
const VERSION = /^(?:0|[1-9][0-9]{0,18})$/u;

function assertPathId(value: string): string {
  if (!SAFE_ID.test(value)) throw new Error('Invalid route identifier');
  return value;
}

function assertIfMatch(value: string | undefined, expected: string): void {
  if (!value) return;
  const normalized = value.trim().replace(/^W\//u, '').replace(/^"|"$/gu, '');
  if (!VERSION.test(normalized) || normalized !== expected) {
    throw new Error('If-Match authorization version does not match request body');
  }
}

@UseGuards(RolesGuard)
@Roles('ANY_AUTHENTICATED')
@Controller('platform-v7/integrations/fgis-grain/tenant-read')
export class FgisGrainTenantReadController {
  constructor(private readonly repository: FgisGrainTenantReadRepository) {}

  @Get('authorizations/:authorizationId')
  @RateLimit({
    name: 'fgis_grain_tenant_read_status',
    scope: 'user',
    limit: 120,
    windowSeconds: 60,
    includeParams: ['authorizationId'],
  })
  async status(
    @Param('authorizationId') authorizationId: string,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'private, no-store');
    return this.repository.getView(user, assertPathId(authorizationId));
  }

  @Post('authorizations')
  @HttpCode(201)
  @RateLimit({ name: 'fgis_grain_tenant_read_authorize', scope: 'user', limit: 10, windowSeconds: 60 })
  async authorize(
    @Body() dto: AuthorizeFgisGrainTenantReadDto,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const receipt = await this.repository.authorize(user, dto);
    response.setHeader('ETag', `"${receipt.authorizationVersion}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    return receipt;
  }

  @Post('attestations')
  @HttpCode(200)
  @RateLimit({ name: 'fgis_grain_tenant_read_attest', scope: 'user', limit: 10, windowSeconds: 60 })
  async attest(
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: AttestFgisGrainTenantReadDto,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    assertIfMatch(ifMatch, dto.authorizationVersion);
    const receipt = await this.repository.attest(user, dto);
    response.setHeader('ETag', `"${receipt.authorizationVersion}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    return receipt;
  }

  @Post('execute')
  @HttpCode(200)
  @RateLimit({ name: 'fgis_grain_tenant_read_execute', scope: 'user', limit: 30, windowSeconds: 60 })
  async execute(
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: ExecuteFgisGrainTenantReadDto,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    assertIfMatch(ifMatch, dto.authorizationVersion);
    const receipt = await this.repository.execute(user, dto);
    response.setHeader('Cache-Control', 'private, no-store');
    return receipt;
  }
}
