import { Injectable } from '@nestjs/common';
import { buildProviderCategorySummary, buildProviderSelection, buildProviderStagePlan, evaluateProviderComplianceGate, listServiceProviders, type ProviderComplianceCategory, type ProviderComplianceContext, type ProviderRegistryEvidence, type ProviderSelectionContext, type ServiceProviderCategory, type ServiceProviderStage } from '../../../../../packages/domain-core/src';

@Injectable()
export class ServiceProvidersService {
  summary() {
    return {
      generatedAt: new Date().toISOString(),
      categories: buildProviderCategorySummary(),
      bankDefault: 'prov-bank-sber',
      stages: ['DISPATCH', 'LAB', 'RECEIVING', 'EXPORT', 'PAYMENT'],
    };
  }

  catalog(category?: ServiceProviderCategory) {
    return {
      generatedAt: new Date().toISOString(),
      category: category || null,
      items: listServiceProviders(category),
    };
  }

  recommendation(category: ServiceProviderCategory, context: ProviderSelectionContext) {
    return {
      generatedAt: new Date().toISOString(),
      ...buildProviderSelection(category, context),
    };
  }

  plan(stage: ServiceProviderStage, context: ProviderSelectionContext) {
    return {
      generatedAt: new Date().toISOString(),
      ...buildProviderStagePlan(stage, context),
    };
  }

  compliance(context: ProviderComplianceContext, evidence?: ProviderRegistryEvidence) {
    return {
      generatedAt: new Date().toISOString(),
      decision: evaluateProviderComplianceGate({ context, evidence })
    };
  }
}
