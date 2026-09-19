import { BaseMockAdapter } from '../adapter.interface';

export interface EscrowAccount {
  accountNumber: string;
  dealId: string;
  sellerInn: string;
  buyerInn: string;
  amountKopecks: number;
  currency: string;
  conditions: string[]; // trigger conditions for release
  createdAt: string;
  status: 'OPEN' | 'HELD' | 'RELEASED' | 'REFUNDED' | 'DISPUTED';
}

export interface BankPaymentOrder {
  id: string;
  dealId: string;
  fromAccount: string;
  toAccount: string;
  amountKopecks: number;
  currency: string;
  purpose: string;  // назначение платежа
  reference: string;
}

export interface BankStatement {
  accountNumber: string;
  period: { from: string; to: string };
  entries: BankStatementEntry[];
}

export interface BankStatementEntry {
  id: string;
  date: string;
  amountKopecks: number;
  direction: 'CREDIT' | 'DEBIT';
  counterpartyInn?: string;
  counterpartyName?: string;
  reference: string;
  purpose: string;
}

export interface BankAdapter {
  createEscrow(params: Omit<EscrowAccount, 'accountNumber' | 'createdAt' | 'status'>): Promise<EscrowAccount>;
  releaseEscrow(accountNumber: string, conditionsMet: string[]): Promise<void>;
  refundEscrow(accountNumber: string, reason: string): Promise<void>;
  getEscrowStatus(accountNumber: string): Promise<EscrowAccount>;
  sendPayment(order: Omit<BankPaymentOrder, 'id'>): Promise<{ paymentId: string; status: string }>;
  getStatement(accountNumber: string, from: Date, to: Date): Promise<BankStatement>;
  verifyAccount(bik: string, account: string): Promise<{ valid: boolean; bankName: string }>;
}

export class MockBankAdapter extends BaseMockAdapter<unknown, unknown> implements BankAdapter {
  readonly name = 'BANK';
  readonly version = '1.0.0';

  private readonly escrows = new Map<string, EscrowAccount>();

  async execute(request: unknown): Promise<unknown> {
    return { mock: true, request };
  }

  async createEscrow(params: Omit<EscrowAccount, 'accountNumber' | 'createdAt' | 'status'>): Promise<EscrowAccount> {
    const accountNumber = `40702810${Date.now().toString().slice(-10)}`;
    const escrow: EscrowAccount = { ...params, accountNumber, createdAt: new Date().toISOString(), status: 'OPEN' };
    this.escrows.set(accountNumber, escrow);
    return escrow;
  }

  async releaseEscrow(accountNumber: string, _conditionsMet: string[]): Promise<void> {
    const escrow = this.escrows.get(accountNumber);
    if (escrow) escrow.status = 'RELEASED';
  }

  async refundEscrow(accountNumber: string, _reason: string): Promise<void> {
    const escrow = this.escrows.get(accountNumber);
    if (escrow) escrow.status = 'REFUNDED';
  }

  async getEscrowStatus(accountNumber: string): Promise<EscrowAccount> {
    const escrow = this.escrows.get(accountNumber);
    if (!escrow) throw new Error(`Escrow account ${accountNumber} not found`);
    return escrow;
  }

  async sendPayment(order: Omit<BankPaymentOrder, 'id'>): Promise<{ paymentId: string; status: string }> {
    return { paymentId: `PAY-${Date.now()}`, status: 'ACCEPTED' };
  }

  async getStatement(accountNumber: string, from: Date, to: Date): Promise<BankStatement> {
    return { accountNumber, period: { from: from.toISOString(), to: to.toISOString() }, entries: [] };
  }

  async verifyAccount(_bik: string, _account: string): Promise<{ valid: boolean; bankName: string }> {
    return { valid: true, bankName: 'АО "Тестовый Банк"' };
  }
}
