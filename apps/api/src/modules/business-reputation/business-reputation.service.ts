import { Injectable } from '@nestjs/common';

@Injectable()
export class BusinessReputationService {
  getScore(orgId: string) {
    return {
      orgId,
      score: 85,
      tier: 'B',
      lastUpdated: new Date().toISOString(),
    };
  }
}
