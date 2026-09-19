import { writeStructuredLog } from '../../apps/api/src/common/logging/structured-logger';

type PaymentEvent = { dealId: string; type: 'RESERVE'|'HOLD'|'PARTIAL_RELEASE'|'FINAL_RELEASE'; status: string };

const PAYMENT_EVENTS: PaymentEvent[] = [
  { dealId: 'DEAL-240312-01', type: 'RESERVE', status: 'BOOKED' },
  { dealId: 'DEAL-240312-02', type: 'HOLD', status: 'BOOKED' },
  { dealId: 'DEAL-240312-02', type: 'PARTIAL_RELEASE', status: 'PENDING_REVIEW' }
];

export async function runPaymentCallbackSimulator() {
  for (const event of PAYMENT_EVENTS) {
    writeStructuredLog({
      source: 'worker.payment-callback-simulator',
      message: 'Payment callback simulated',
      eventType: 'payment.callback.simulated',
      objectType: 'deal',
      objectId: event.dealId,
      data: event
    });
  }
}
