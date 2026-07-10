import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { DocumentsService } from './documents.service';
import { DocumentMatrixService } from './document-matrix.service';
import { DocumentTemplateService, TemplateId } from './document-template.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

@UseGuards(RolesGuard)
@Roles('FARMER', 'BUYER', 'SUPPORT_MANAGER', 'ACCOUNTING', 'LAB', 'LOGISTICIAN', 'EXECUTIVE', 'ADMIN')
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly matrix: DocumentMatrixService,
    private readonly templates: DocumentTemplateService,
  ) {}

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

  @RateLimit({ name: 'documents_upload', scope: 'user', limit: 20, windowSeconds: 300, limitEnv: 'RATE_LIMIT_UPLOADS', windowEnv: 'RATE_LIMIT_UPLOADS_WINDOW_SECONDS' })
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

  /** Returns all doc requirements for a given action */
  @Get('matrix/:action')
  matrixForAction(@Param('action') action: string) {
    return this.matrix.getRequirementsForAction(action as any);
  }

  /** Full release readiness gate check for a deal */
  @Get('gate/release/:dealId')
  releaseGate(@Param('dealId') dealId: string, @CurrentUser() user: any) {
    return this.documents.getReleaseGate(dealId, user);
  }

  @Post(':id/edo/send')
  edoSend(@Param('id') id: string, @Body() body: { recipientInn: string; recipientBoxId?: string }, @CurrentUser() user: any) {
    return this.documents.edoSend(id, body, user);
  }

  @Post(':id/edo/sign')
  edoSign(@Param('id') id: string, @Body() body: { certificateId?: string }, @CurrentUser() user: any) {
    return this.documents.edoSign(id, body.certificateId, user);
  }

  @Get(':id/edo/status')
  edoStatus(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documents.edoGetStatus(id, user);
  }

  @Get('templates')
  listTemplates() {
    return this.templates.listTemplates();
  }

  @Post('templates/:id/generate')
  generateFromTemplate(
    @Param('id') templateId: string,
    @Body() variables: Record<string, string | number>,
  ) {
    return this.templates.generateDocument(templateId as TemplateId, variables);
  }

  @Post(':id/verify-signature')
  verifySignature(
    @Param('id') id: string,
    @Body() body: { signatureBase64: string; certificateId: string; documentHash?: string },
    @CurrentUser() user: any,
  ) {
    return this.documents.verifySignature(id, body, user);
  }

  @Get('certificates/my')
  getUserCertificates(@CurrentUser() user: any) {
    return this.documents.getUserCertificates(user);
  }

  @Get('certificates/:certId/status')
  checkCertStatus(@Param('certId') certId: string) {
    return this.documents.checkCertificateStatus(certId);
  }

  @Post('batch-sign')
  async batchSign(
    @Body() body: { documentIds: string[]; certificateId?: string },
    @CurrentUser() user: any,
  ) {
    if (body.documentIds.length > 50) {
      return { error: 'Batch signing limit is 50 documents' };
    }
    const results = await Promise.all(
      body.documentIds.map(id => this.documents.edoSign(id, body.certificateId, user).catch(err => ({ id, error: String(err) })))
    );
    return {
      processed: results.length,
      signed: results.filter((r: any) => !r.error).length,
      failed: results.filter((r: any) => r.error).length,
      results,
    };
  }
}
