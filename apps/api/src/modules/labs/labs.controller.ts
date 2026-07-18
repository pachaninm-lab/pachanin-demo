import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import { LabsService } from './labs.service';
import {
  LabAuthorityService,
  type ProvisionLabAuthorityCommand,
  type IssueLabSampleAdmissionCommand,
} from './lab-authority.service';
import { LabEvidenceUploadService } from './lab-evidence-upload.service';
import { CreateSampleDto } from './dto/create-sample.dto';
import { CollectSampleDto } from './dto/collect-sample.dto';
import { RecordCustodyDto } from './dto/record-custody.dto';
import { RecordTestDto } from './dto/record-test.dto';
import {
  RequestProvisioningEvidenceUploadDto,
  RequestSampleEvidenceUploadDto,
} from './dto/request-lab-evidence-upload.dto';

@UseGuards(RolesGuard)
@Roles('LAB', 'SUPPORT_MANAGER', 'ADMIN', 'BUYER', 'FARMER', 'SURVEYOR', 'ELEVATOR', 'COMPLIANCE_OFFICER')
@Controller('labs')
export class LabsController {
  constructor(
    private readonly labs: LabsService,
    private readonly authority: LabAuthorityService,
    private readonly evidenceUploads: LabEvidenceUploadService,
  ) {}

  /**
   * Онбординг лаборатории как поставщика услуг сделки: регистрация авторитета
   * (аккредитация, уполномоченные акторы, методы, оборудование). Привилегированное
   * решение оператора с идемпотентностью и purpose-bound доказательствами —
   * прежде доступно только внутрисервисно, теперь штатный HTTP-путь.
   */
  @Roles('SUPPORT_MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER')
  @Post('authority')
  provisionAuthority(
    @Body() dto: ProvisionLabAuthorityCommand,
    @CurrentUser() user: RequestUser,
  ) {
    return this.authority.provision(dto, user);
  }

  /** Выдача допуска пробы конкретной лаборатории под перевозку/приёмку сделки. */
  @Roles('SUPPORT_MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER')
  @Post('sample-admissions')
  issueSampleAdmission(
    @Body() dto: IssueLabSampleAdmissionCommand,
    @CurrentUser() user: RequestUser,
  ) {
    return this.authority.issueSampleAdmission(dto, user);
  }

  @Get('samples')
  list(@CurrentUser() user: RequestUser) {
    return this.labs.list(user);
  }

  @Get('samples/:id')
  getOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.labs.getOne(id, user);
  }

  @Get('samples/:id/workspace')
  workspace(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.labs.workspace(id, user);
  }

  @Roles('LAB', 'SURVEYOR', 'SUPPORT_MANAGER', 'ADMIN')
  @Post('samples')
  create(@Body() dto: CreateSampleDto, @CurrentUser() user: RequestUser) {
    return this.labs.create(dto, user);
  }

  @Roles('LAB', 'SURVEYOR', 'SUPPORT_MANAGER', 'ADMIN')
  @Patch('samples/:id/collect')
  collect(
    @Param('id') id: string,
    @Body() dto: CollectSampleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.labs.collect(id, dto, user);
  }

  @Roles('LAB', 'SURVEYOR', 'SUPPORT_MANAGER', 'ADMIN')
  @Post('samples/:id/custody')
  recordCustody(
    @Param('id') id: string,
    @Body() dto: RecordCustodyDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.labs.recordCustody(id, dto, user);
  }

  @Roles('LAB', 'SUPPORT_MANAGER', 'ADMIN')
  @Post('samples/:id/tests')
  recordTest(
    @Param('id') id: string,
    @Body() dto: RecordTestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.labs.recordTest(id, dto, user);
  }

  @Roles('LAB', 'SUPPORT_MANAGER', 'ADMIN')
  @Post('samples/:id/evidence-upload')
  requestSampleEvidenceUpload(
    @Param('id') id: string,
    @Body() dto: RequestSampleEvidenceUploadDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.evidenceUploads.requestForSample(id, dto, user);
  }

  @Roles('SUPPORT_MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER')
  @Post('evidence-upload/provisioning')
  requestProvisioningEvidenceUpload(
    @Body() dto: RequestProvisioningEvidenceUploadDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.evidenceUploads.requestForProvisioning(dto, user);
  }

  @Roles('LAB', 'SUPPORT_MANAGER', 'ADMIN')
  @Patch('samples/:id/finalize')
  finalize(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.labs.finalize(id, user);
  }
}
