import { AppShell } from '../../components/app-shell';
import { MarketNewsRail } from '../../components/market-news-rail';

export default function MarketNewsPage() {
  return (
    <AppShell title="Market news" subtitle="Рыночный фон, который влияет на execution, price and timing">
      <MarketNewsRail />
    </AppShell>
  );
}
