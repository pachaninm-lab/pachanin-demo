import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ServiceProvidersService } from './service-providers.service';
import type { ProviderComplianceCategory, ProviderComplianceContext, ProviderLegalRole, ProviderRegistryEvidence, ProviderSelectionContext, ServiceProviderCategory, ServiceProviderStage } from '../../../../../packages/domain-core/src';

@UseGuards(RolesGuard)
@Roles('LOGISTICIAN', 'LAB', 'ELEVATOR', 'ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN')
@Controller('service-providers')
export class ServiceProvidersController {
  constructor(private readonly serviceProviders: ServiceProvidersService) {}

  @Get('summary')
  summary() {
    return this.serviceProviders.summary();
  }

  @Get('catalog')
  catalog(@Query('category') category?: ServiceProviderCategory) {
    return this.serviceProviders.catalog(category);
  }

  @Get('plan')
  plan(
    @Query('stage') stage: ServiceProviderStage,
    @Query('region') region?: string,
    @Query('culture') culture?: string,
    @Query('pilotMode') pilotMode?: string,
    @Query('exportFlow') exportFlow?: string,
    @Query('disputeSensitive') disputeSensitive?: string,
    @Query('requiresEpd') requiresEpd?: string,
    @Query('requiresGpsEvidence') requiresGpsEvidence?: string,
    @Query('needPortLink') needPortLink?: string,
    @Query('needRailLink') needRailLink?: string,
    @Query('docsReady') docsReady?: string,
    @Query('targetHours') targetHours?: string,
    @Query('urgency') urgency?: 'LOW' | 'MEDIUM' | 'HIGH',
    @Query('amountRub') amountRub?: string,
  ) {
    const context: ProviderSelectionContext = {
      region,
      culture,
      pilotMode: pilotMode === 'true',
      exportFlow: exportFlow === 'true',
      disputeSensitive: disputeSensitive === 'true',
      requiresEpd: requiresEpd === 'true',
      requiresGpsEvidence: requiresGpsEvidence === 'true',
      needPortLink: needPortLink === 'true',
      needRailLink: needRailLink === 'true',
      docsReady: docsReady === 'true',
      targetHours: targetHours ? Number(targetHours) : undefined,
      urgency,
      amountRub: amountRub ? Number(amountRub) : undefined,
    };
    return this.serviceProviders.plan(stage, context);
  }

  @Get('compliance')
  compliance(
    @Query('category') category: ProviderComplianceCategory,
    @Query('legalRole') legalRole?: ProviderLegalRole,
    @Query('disputeSensitive') disputeSensitive?: string,
    @Query('moneySensitive') moneySensitive?: string,
    @Query('exportFlow') exportFlow?: string,
    @Query('requiresEpd') requiresEpd?: string,
    @Query('requiresQualifiedSignature') requiresQualifiedSignature?: string,
    @Query('requiresGpsEvidence') requiresGpsEvidence?: string,
    @Query('requiresBankWhitelist') requiresBankWhitelist?: string,
    @Query('labAccreditation') labAccreditation?: string,
    @Query('declarationValidity') declarationValidity?: string,
    @Query('goslogCarrier') goslogCarrier?: string,
    @Query('goslogExpeditor') goslogExpeditor?: string,
    @Query('epdReady') epdReady?: string,
    @Query('qualifiedSignature') qualifiedSignature?: string,
    @Query('gpsEvidence') gpsEvidence?: string,
    @Query('bankWhitelist') bankWhitelist?: string,
  ) {
    const context: ProviderComplianceContext = {
      category,
      legalRole,
      disputeSensitive: disputeSensitive === 'true',
      moneySensitive: moneySensitive === 'true',
      exportFlow: exportFlow === 'true',
      requiresEpd: requiresEpd === 'true',
      requiresQualifiedSignature: requiresQualifiedSignature === 'true',
      requiresGpsEvidence: requiresGpsEvidence === 'true',
      requiresBankWhitelist: requiresBankWhitelist === 'true',
    };
    const evidence: ProviderRegistryEvidence = {
      lab_accreditation: labAccreditation ? { status: labAccreditation as any } : undefined,
      declaration_validity: declarationValidity ? { status: declarationValidity as any } : undefined,
      goslog_carrier: goslogCarrier ? { status: goslogCarrier as any } : undefined,
      goslog_expeditor: goslogExpeditor ? { status: goslogExpeditor as any } : undefined,
      epd_ready: epdReady ? { status: epdReady as any } : undefined,
      qualified_signature: qualifiedSignature ? { status: qualifiedSignature as any } : undefined,
      gps_evidence: gpsEvidence ? { status: gpsEvidence as any } : undefined,
      bank_whitelist: bankWhitelist ? { status: bankWhitelist as any } : undefined,
    };
    return this.serviceProviders.compliance(context, evidence);
  }

  @Get('recommendation')
  recommendation(
    @Query('category') category: ServiceProviderCategory,
    @Query('region') region?: string,
    @Query('culture') culture?: string,
    @Query('pilotMode') pilotMode?: string,
    @Query('exportFlow') exportFlow?: string,
    @Query('disputeSensitive') disputeSensitive?: string,
    @Query('requiresEpd') requiresEpd?: string,
    @Query('requiresGpsEvidence') requiresGpsEvidence?: string,
    @Query('needPortLink') needPortLink?: string,
    @Query('needRailLink') needRailLink?: string,
    @Query('docsReady') docsReady?: string,
    @Query('targetHours') targetHours?: string,
    @Query('urgency') urgency?: 'LOW' | 'MEDIUM' | 'HIGH',
    @Query('amountRub') amountRub?: string,
  ) {
    const context: ProviderSelectionContext = {
      region,
      culture,
      pilotMode: pilotMode === 'true',
      exportFlow: exportFlow === 'true',
      disputeSensitive: disputeSensitive === 'true',
      requiresEpd: requiresEpd === 'true',
      requiresGpsEvidence: requiresGpsEvidence === 'true',
      needPortLink: needPortLink === 'true',
      needRailLink: needRailLink === 'true',
      docsReady: docsReady === 'true',
      targetHours: targetHours ? Number(targetHours) : undefined,
      urgency,
      amountRub: amountRub ? Number(amountRub) : undefined,
    };
    return this.serviceProviders.recommendation(category, context);
  }
}
