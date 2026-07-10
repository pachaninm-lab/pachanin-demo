import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StorageService } from './storage.service';

@Controller('api/storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('request-upload')
  requestUpload(
    @Body() body: {
      filename: string;
      mimeType: string;
      sizeBytes: number;
      dealId: string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    return this.storage.requestUpload(body, user);
  }

  @Post('confirm-upload/:fileId')
  confirmUpload(
    @Param('fileId') fileId: string,
    @Body() body: { sha256: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.storage.confirmUpload(fileId, body.sha256, user);
  }

  @Get('download/:fileId')
  getDownloadUrl(
    @Param('fileId') fileId: string,
    @CurrentUser() user: RequestUser,
    @Query('ttl') ttl?: string,
  ) {
    return this.storage.getDownloadUrl(fileId, ttl ? Number.parseInt(ttl, 10) : 900, user);
  }

  @Get(':fileId/integrity')
  verifyIntegrity(
    @Param('fileId') fileId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.storage.verifyIntegrity(fileId, user);
  }

  @Get()
  listByDeal(
    @Query('dealId') dealId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.storage.listByDeal(dealId, user);
  }

  @Delete(':fileId')
  delete(
    @Param('fileId') fileId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.storage.delete(fileId, user);
  }
}
