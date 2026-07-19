import { Body, Controller, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { TaiDelegatedIdentity, TAI_PLATFORM_TOOL_MODES, TaiPlatformToolName } from './tai-tool-assertion';
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
  execute(
    @Param('toolName') rawToolName: string,
    @Body() body: TaiToolBody,
    @Req() request: TaiAuthenticatedRequest,
  ) {
    if (!(rawToolName in TAI_PLATFORM_TOOL_MODES) || !request.taiToolIdentity) {
      throw new Error('TAI tool guard did not establish an authorized tool identity');
    }
    return this.tools.execute(
      rawToolName as TaiPlatformToolName,
      body,
      request.taiToolIdentity,
    );
  }
}
