import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { PageAccessGuard } from '../../components/page-access-guard';
import { EXECUTIVE_ROLES, INTERNAL_ONLY_ROLES } from '../../lib/route-roles';

type ForecastItem = { crop: string; region: string; priceForecast: number; trend: 'up' | 'down' | 'flat'; confidence: number; volumeRiskMt: number; timingWindowDays: number };
type ExecutionRisk = { dealId: string; risk: string; probability: number; impact: string };

const PRICE_FORECAST: ForecastItem[] = [
  { crop: 'Пшеница 3кл', region: 'Юг России', priceForecast: 14800, trend: 'up', confidence: 72, volumeRiskMt: 0, timingWindowDays: 14 },
  { crop: 'Ячмень', region: 'ЮФО', priceForecast: 12400, trend: 'down', confidence: 65, volumeRiskMt: 150, timingWindowDays: 7 },
  { crop: 'Кукуруза', region: 'СКФО', priceForecast: 13200, trend: 'flat', confidence: 80, volumeRiskMt: 0, timingWindowDays: 21 },
  { crop: 'Подсолнечник', region: 'ЦФО', priceForecast: 31500, trend: 'up', confidence: 58, volumeRiskMt: 200, timingWindowDays: 30 },
];

const EXECUTION_RISKS: ExecutionRisk[] = [
  { dealId: 'DEAL-001', risk: 'Задержка логистики — пробки на М4', probability: 35, impact: 'Просрочка SLA доставки на 1-2 дня' },
  { dealId: 'DEAL-002', risk: 'Качество может не пройти — влажность на пределе', probability: 45, impact: 'Спор, задержка платежа' },
  { dealId: 'DEAL-003', risk: 'Нет подтверждения водителя', probability: 20, impact: 'Задержка погрузки' },
];

const TREND_ICON: Record<string, string> = { up: '↑', down: '↓', flat: '→' };
const TREND_COLOR: Record<string, string> = { up: 'green', down: 'red', flat: 'gray' };

export default function ForecastingPage() {
  return (
    <PageAccessGuard allowedRoles={[...EXECUTIVE_ROLES, ...INTERNAL_ONLY_ROLES]}
      title="Прогнозирование ограничено"
      subtitle="Рыночные прогнозы и аналитика рисков доступны исполнительным и внутренним ролям.">
      <AppShell title="Прогнозирование" subtitle="Прогнозы по рынку, объёмам, рискам исполнения и timing окна">
        <div className="space-y-6">
          <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Прогнозирование' }]} />

          <div className="soft-box" style={{ background: 'var(--color-surface-2, #f9fafb)' }}>
            <div className="muted small">
              Прогнозные данные — демо модель на основе исторических рыночных паттернов.
              В production подключается SmartAgro ML и данные торгов.
            </div>
          </div>

          {/* Price forecasts */}
          <div>
            <div className="section-title" style={{ marginBottom: 8 }}>Ценовые прогнозы — 14 дней</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {PRICE_FORECAST.map((f) => (
                <div key={f.crop + f.region} className="soft-box" style={{ flex: '1 1 160px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{f.crop}</div>
                    <span className={`mini-chip ${TREND_COLOR[f.trend]}`}>{TREND_ICON[f.trend]}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{f.priceForecast.toLocaleString('ru-RU')} ₽/т</div>
                  <div className="muted tiny" style={{ marginTop: 4 }}>{f.region}</div>
                  <div className="muted tiny">Уверенность: {f.confidence}%</div>
                  <div className="muted tiny">Окно: {f.timingWindowDays} дн.</div>
                  {f.volumeRiskMt > 0 && (
                    <div className="muted tiny" style={{ color: 'var(--color-amber, #f59e0b)' }}>⚠ Риск объёма: {f.volumeRiskMt} т</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Execution risks */}
          <div>
            <div className="section-title" style={{ marginBottom: 8 }}>Риски исполнения активных сделок</div>
            <div className="section-stack">
              {EXECUTION_RISKS.map((r) => (
                <div key={r.dealId} className="soft-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>
                        <Link href={`/deals/${r.dealId}`} className="mini-chip">{r.dealId}</Link>
                        {' '}{r.risk}
                      </div>
                      <div className="muted small">{r.impact}</div>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: 56 }}>
                      <div style={{
                        fontWeight: 700, fontSize: '1.1rem',
                        color: r.probability >= 40 ? 'var(--color-red, #ef4444)' : r.probability >= 25 ? 'var(--color-amber, #f59e0b)' : 'inherit',
                      }}>
                        {r.probability}%
                      </div>
                      <div className="muted tiny">вероятность</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Volume outlook */}
          <div className="soft-box">
            <div className="section-title" style={{ marginBottom: 8 }}>Объёмный прогноз — 30 дней</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'Ожидаемый объём', value: '85 000 т' },
                { label: 'Прогноз сделок', value: '35–40 шт.' },
                { label: 'Средняя цена', value: '13 800 ₽/т' },
                { label: 'Точность модели', value: '±8%' },
              ].map((m) => (
                <div key={m.label} style={{ flex: '1 1 100px' }}>
                  <div style={{ fontWeight: 700 }}>{m.value}</div>
                  <div className="muted small">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/analytics" className="mini-chip">Аналитика</Link>
            <Link href="/deals" className="mini-chip">Сделки</Link>
            <Link href="/operator-cockpit" className="mini-chip">Кокпит оператора</Link>
          </div>
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
