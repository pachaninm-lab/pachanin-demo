import { P7Page } from '@/components/platform-v7/P7Page';
import { evaluateReleaseSafety, executionContourFixtures, acceptBid } from '@/lib/platform-v7/execution-contour';

const deal = acceptBid({ lot: executionContourFixtures.lots[0], bids: executionContourFixtures.bids, bidId: 'BID-7002' }).deal;
const check = evaluateReleaseSafety({
  deal,
  reserveConfirmed: true,
  fgisReady: true,
  edoReady: false,
  manualReviewOpen: false,
});

export function MoneySafetyScreen() {
  return (
    <P7Page title="Проверка выпуска денег" subtitle="Деньги не двигаются, пока не закрыты ставка, резерв, рейс, вес, лаборатория, ФГИС/СДИЗ, транспортный пакет, спор и ручная проверка." testId="platform-v7-money-safety-neutral">
      <section style={{ border: '1px solid #E4E6EA', borderRadius: 20, padding: 18, display: 'grid', gap: 12, background: '#FFFFFF' }}>
        <h2 style={{ margin: 0 }}>{check.title}</h2>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {check.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
        <div style={{ color: '#667085', fontSize: 13 }}>Ответственный: {check.responsible}. Следующее действие: {check.nextAction}</div>
      </section>
    </P7Page>
  );
}
