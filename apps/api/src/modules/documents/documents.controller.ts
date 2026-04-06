import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

@UseGuards(RolesGuard)
@Roles('FARMER', 'BUYER', 'SUPPORT_MANAGER', 'ACCOUNTING')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.documents.list(user);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documents.getOne(id, user);
  }

  @Get(':id/access')
  access(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documents.getSignedAccess(id, user);
  }

  @Get(':id/content')
  async content(@Param('id') id: string, @CurrentUser() user: any) {
    const payload = await this.documents.streamContent(id, user);
    return payload.file;
  }

  @RateLimit({ name: 'documents_upload', scope: 'user', limit: 20, windowSeconds: 300, limitEnv: 'RATE_LIMIT_UPLOADS', windowEnv: 'RATE_LIMIT_WINDOW_SECONDS' })
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: any, @Body() dto: UploadDocumentDto, @CurrentUser() user: any) {
    return this.documents.upload(file, dto, user);
  }

  @Get(':id/download')
  download(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documents.download(id, user);
  }

  @Post(':id/sign')
  sign(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documents.signDocument(id, user);
  }

  @Post('generate/:dealId')
  generate(@Param('dealId') dealId: string, @CurrentUser() user: any) {
    return this.documents.generateDealPackage(dealId, user);
  }

  @Get(':id/preview')
  preview(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documents.getPreview(id, user);
  }

  @Get(':id/correction')
  correction(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documents.getCorrectionPlan(id, user);
  }
}
