import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import {
  TaiDelegatedIdentity,
  TAI_PLATFORM_TOOL_MODES,
  TaiPlatformToolName,
} from './tai-tool-assertion';
import { TaiToolAssertionGuard } from './tai-tool-assertion.guard';
import { TaiToolsService } from './tai-tools.service';

type TaiToolBody = {
  readonly arguments?: unknown;
};

type TaiAuthenticatedRequest = {
  readonly taiToolIdentity?: TaiDelegatedIdentity;
};

@Public()
@UseGuards(TaiToolAssertionGuard)
@Controller('internal/tai/tools')
export class TaiToolsController {
  constructor(private readonly tools: TaiToolsService) {}

  @Post(':toolName')
  @HttpCode(200)
  @RateLimit({
    name: 'tai-platform-safe-tools',
    scope: 'ip',
    limit: 600,
    windowSeconds: 60,
    limitEnv: 'TAI_PLATFORM_TOOL_RATE_LIMIT_PER_MINUTE',
    includeParams: ['toolName'],
  })
  execute(
    @Param('toolName') rawToolName: string,
    @Body() body: TaiToolBody,
    @Req() request: TaiAuthenticatedRequest,
  ) {
    if (
      !Object.prototype.hasOwnProperty.call(TAI_PLATFORM_TOOL_MODES, rawToolName) ||
      !request.taiToolIdentity
    ) {
      throw new UnauthorizedException({ code: 'TAI_TOOL_IDENTITY_MISSING' });
    }
    return this.tools.execute(
      rawToolName as TaiPlatformToolName,
      body,
      request.taiToolIdentity,
    );
  }
}
