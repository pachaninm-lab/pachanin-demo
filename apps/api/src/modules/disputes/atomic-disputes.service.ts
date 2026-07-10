import { Injectable } from '@nestjs/common';
import { RequestUser } from '../../common/types/request-user';
import {
  Dispute,
  DisputesService,
  MoneyInstruction,
} from './disputes.service';
import { DecideDisputeDto } from './dto/decide-dispute.dto';

@Injectable()
export class AtomicDisputesService extends DisputesService {
  async resolve(
    id: string,
    dto: DecideDisputeDto,
    user: RequestUser,
    hooks: any = {},
  ): Promise<Dispute & { moneyInstruction: MoneyInstruction }> {
    const result = await super.resolve(id, dto, user, hooks);
    const amount = result.moneyHold?.amountKopecks ?? result.claimAmountKopecks ?? 0;
    const buyer = buyerShare(amount, dto.outcome, dto.splitPct);
    const seller = amount - buyer;
    return {
      ...result,
      moneyInstruction: {
        action: buyer > 0 && seller > 0
          ? 'SPLIT_PENDING'
          : buyer > 0
            ? 'REFUND_BUYER_PENDING'
            : seller > 0
              ? 'RETURN_TO_ESCROW'
              : 'NO_MONEY_ACTION',
        amountRub: amount / 100,
        amountKopecks: amount,
        sellerShareRub: seller / 100,
        sellerShareKopecks: seller,
        buyerRefundRub: buyer / 100,
        buyerRefundKopecks: buyer,
        note: dto.note ?? result.decisionNote,
        bankBasisDocumentId: result.bankBasisDocumentId,
        bankCallbackRequired: buyer > 0,
      },
    };
  }
}

function buyerShare(
  amount: number,
  outcome: DecideDisputeDto['outcome'],
  splitPct?: number,
): number {
  if (outcome === 'BUYER_WIN' || outcome === 'CANCELLED') return amount;
  if (outcome === 'SELLER_WIN' || outcome === 'NO_CLAIM') return 0;
  return Number((BigInt(amount) * BigInt(splitPct ?? 50)) / 100n);
}
