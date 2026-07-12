import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import { DocAction, DocumentMatrixService } from './document-matrix.service';
import { DocumentTemplateService, TemplateId } from './document-template.service';
import { DocumentsService } from './documents.service';
import { GenerateDocumentPackageDto } from './dto/generate-document-package.dto';
import { SignDocumentDto } from './dto/sign-document.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

@UseGuards(RolesGuard)
@Roles(
  'FARMER',
  'BUYER',
  'SUPPORT_MANAGER',
  'COMPLIANCE_OFFICER',
  'ACCOUNTING',
  'LAB',
  'LOGISTICIAN',
  'SURVEYOR',
  'ELEVATOR',
  'EXECUTIVE',
  'ADMIN',
)
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly matrix: DocumentMatrixService,
    private readonly templates: DocumentTemplateService,
  ) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.documents.list(user);
  }

  @Get('templates')
  listTemplates() {
    return this.templates.listTemplates();
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.documents.getOne(id, user);
  }

  @Get(':id/access')
  access(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.documents.getSignedAccess(id, user);
  }

  @Get(':id/content')
  async content(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const payload = await this.documents.streamContent(id, user);
    return payload.file;
  }

  @RateLimit({ name: 'documents_upload', scope: 'user', limit: 20, windowSeconds: 300, limitEnv: 'RATE_LIMIT_UPLOADS', windowEnv: 'RATE_LIMIT_WINDOW_SECONDS' })
  @Post('upload')
  upload(@Body() dto: UploadDocumentDto, @CurrentUser() user: RequestUser) {
    return this.documents.upload(dto, user);
  }

  @Get(':id/download')
  download(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.documents.download(id, user);
  }

  @Post(':id/sign')
  sign(
    @Param('id') id: string,
    @Body() dto: SignDocumentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.documents.signDocument(id, dto, user);
  }

  @Post('generate/:dealId')
  generate(
    @Param('dealId') dealId: string,
    @Body() dto: GenerateDocumentPackageDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.documents.generateDealPackage(dealId, dto, user);
  }

  @Get(':id/preview')
  preview(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.documents.getPreview(id, user);
  }

  @Get(':id/correction')
  correction(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.documents.getCorrectionPlan(id, user);
  }

  @Get('matrix/:action')
  matrixForAction(@Param('action') action: string) {
    return this.matrix.getRequirementsForAction(action as DocAction);
  }

  @Get('gate/release/:dealId')
  releaseGate(@Param('dealId') dealId: string, @CurrentUser() user: RequestUser) {
    return this.documents.getReleaseGate(dealId, user);
  }

  @Post(':id/edo/send')
  edoSend() {
    return this.documents.edoSend();
  }

  @Post(':id/edo/sign')
  edoSign() {
    return this.documents.edoSign();
  }

  @Get(':id/edo/status')
  edoStatus() {
    return this.documents.edoGetStatus();
  }

  @Post('templates/:id/generate')
  generateFromTemplate(
    @Param('id') templateId: string,
    @Body() variables: Record<string, string | number>,
  ) {
    return this.templates.generateDocument(templateId as TemplateId, variables);
  }

  @Post(':id/verify-signature')
  verifySignature() {
    return this.documents.verifySignature();
  }

  @Get('certificates/my')
  getUserCertificates() {
    return this.documents.getUserCertificates();
  }

  @Get('certificates/:certId/status')
  checkCertStatus() {
    return this.documents.checkCertificateStatus();
  }

  @Post('batch-sign')
  batchSign() {
    return this.documents.edoSign();
  }
}
