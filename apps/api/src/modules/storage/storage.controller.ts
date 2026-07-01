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
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('api/storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  /**
   * Шаг 1 — запросить presigned URL для загрузки файла (ТЗ 8.4)
   * POST /api/storage/request-upload
   */
  @Post('request-upload')
  async requestUpload(
    @Body() body: {
      filename: string;
      mimeType: string;
      sizeBytes?: number;
      dealId?: string;
      uploadedBy?: string;
    },
  ) {
    return this.storage.requestUpload({
      filename: body.filename,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      uploadedBy: body.uploadedBy ?? 'api',
      dealId: body.dealId,
    });
  }

  /**
   * Шаг 2 — подтвердить загрузку с SHA-256 хешем (ТЗ 8.4)
   * POST /api/storage/confirm-upload/:fileId
   */
  @Post('confirm-upload/:fileId')
  async confirmUpload(
    @Param('fileId') fileId: string,
    @Body() body: { sha256: string },
  ) {
    return this.storage.confirmUpload(fileId, body.sha256);
  }

  /**
   * Получить presigned download URL (TTL 15 мин) (ТЗ 8.4)
   * GET /api/storage/download/:fileId
   */
  @Get('download/:fileId')
  async getDownloadUrl(
    @Param('fileId') fileId: string,
    @Query('ttl') ttl?: string,
  ) {
    return this.storage.getDownloadUrl(fileId, ttl ? parseInt(ttl, 10) : 900);
  }

  /**
   * Проверка целостности файла по SHA-256 (ТЗ 8.4)
   * GET /api/storage/:fileId/integrity
   */
  @Get(':fileId/integrity')
  async verifyIntegrity(@Param('fileId') fileId: string) {
    return this.storage.verifyIntegrity(fileId);
  }

  /**
   * Список файлов по сделке
   * GET /api/storage?dealId=xxx
   */
  @Get()
  listByDeal(@Query('dealId') dealId: string) {
    return this.storage.listByDeal(dealId);
  }

  /**
   * Удалить файл
   * DELETE /api/storage/:fileId
   */
  @Delete(':fileId')
  async delete(@Param('fileId') fileId: string) {
    return this.storage.delete(fileId);
  }
}
