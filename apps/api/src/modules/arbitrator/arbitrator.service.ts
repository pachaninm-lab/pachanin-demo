import { Injectable } from '@nestjs/common';
import { RequestUser } from '../../common/types/request-user';
import { DisputesService } from '../disputes/disputes.service';
import { DecideDisputeDto } from '../disputes/dto/decide-dispute.dto';

@Injectable()
export class ArbitratorService {
  constructor(private readonly disputes: DisputesService) {}

  getAssignedDisputes(user: RequestUser) {
    return this.disputes.getAssignedDisputes(user);
  }

  assignSelf(disputeId: string, user: RequestUser) {
    return this.disputes.assignSelf(disputeId, user);
  }

  getDisputeCase(disputeId: string, user: RequestUser) {
    return this.disputes.getOne(disputeId, user);
  }

  addNote(disputeId: string, note: string, user: RequestUser) {
    return this.disputes.addNote(disputeId, note, user);
  }

  resolve(
    disputeId: string,
    body: {
      outcome: 'BUYER_WIN' | 'SELLER_WIN' | 'SPLIT' | 'NO_CLAIM' | 'CANCELLED';
      splitPct?: number;
      note?: string;
      commandId: string;
      idempotencyKey: string;
    },
    user: RequestUser,
  ) {
    const dto: DecideDisputeDto = {
      outcome: body.outcome,
      splitPct: body.splitPct,
      note: body.note,
      commandId: body.commandId,
      idempotencyKey: body.idempotencyKey,
    };
    return this.disputes.resolve(disputeId, dto, user);
  }
}
