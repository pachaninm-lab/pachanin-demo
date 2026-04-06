import { Injectable } from '@nestjs/common';

export interface LedgerEntry {
  id: string;
  dealId: string;
  amount: number;
  type: string;
  note?: string;
  createdAt: string;
}

@Injectable()
export class LedgerService {
  private readonly entries: LedgerEntry[] = [];

  record(entry: { dealId: string; amount: number; type: string; note?: string }) {
    const record: LedgerEntry = {
      id: `ledger-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...entry,
      createdAt: new Date().toISOString(),
    };
    this.entries.push(record);
    return record;
  }

  list(dealId: string) {
    return this.entries.filter((e) => e.dealId === dealId);
  }
}
