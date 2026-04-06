import { Injectable } from '@nestjs/common';

@Injectable()
export class AntiFraudService {
  check(entityId: string, context: any) {
    return {
      flagged: false,
      score: 0,
      reasons: [] as string[],
      entityId,
      checkedAt: new Date().toISOString(),
    };
  }
}
