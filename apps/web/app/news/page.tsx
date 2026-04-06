import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { ModuleHub } from '../../components/module-hub';
import { RuntimeSourceBanner } from '../../components/runtime-source-banner';
import { getRuntimeSnapshot } from '../../lib/runtime-server';
import { PageAccessGuard } from '../../components/page-access-guard';
import { ALL_AUTHENTICATED_ROLES } from '../../lib/route-roles';

export default async function NewsHubPage() {
  const snapshot = await getRuntimeSnapshot();
  const notes = snapshot.notifications.filter((item) => String(item.scope || '').includes('MARKET') || String(item.type || '').includes('MARKET')).slice(0, 4);

  return (
    <PageAccessGuard allowedRoles={[...ALL_AUTHENTICATED_ROLES]} title="Новости доступны только после входа" subtitle="Новости не должны быть тупиком: из них пользователь идёт в аналитику, лоты, прогнозы или action-module.">
      <AppShell title="Новости и сигналы рынка" subtitle="Связующий hub между новостями, ценовой аналитикой, прогнозами и торговыми действиями." actions={<Link href="/market-news" className="primary-link">Открыть ленту рынка</Link>}>
        <RuntimeSourceBanner snapshot={snapshot} />
        <section className="dashboard-grid-3">
          <Link href="/market-news" className="dashboard-card">
            <div className="dashboard-card-title">Лента рынка</div>
            <div className="dashboard-card-value">News</div>
            <div className="dashboard-card-caption">Канонический поток рыночных событий и их влияния.</div>
          </Link>
          <Link href="/analytics" className="dashboard-card">
            <div className="dashboard-card-title">Ценовая проверка</div>
            <div className="dashboard-card-value">EXW</div>
            <div className="dashboard-card-caption">После новости нужно сразу проверить индексы и динамику.</div>
          </Link>
          <Link href="/forecasting" className="dashboard-card">
            <div className="dashboard-card-title">Прогноз</div>
            <div className="dashboard-card-value">Next</div>
            <div className="dashboard-card-caption">Дальше — сценарий и прогноз влияния на культуру или сделку.</div>
          </Link>
        </section>

        <ModuleHub
          title="Логические переходы после новости"
          subtitle="Любой сигнал должен завершаться либо торговым действием, либо аналитическим выводом."
          items={[
            { href: '/market-news', label: 'Лента рынка', detail: 'Все новости с каноническим рыночным контекстом.', icon: '☰', tone: 'blue' },
            { href: '/analytics', label: 'Аналитика', detail: 'Проверить индексы, средние цены и рыночную динамику.', icon: '↗', tone: 'green' },
            { href: '/forecasting', label: 'Прогнозы', detail: 'Сценарии изменения цен и поведения участников.', icon: '∿', tone: 'amber' },
            { href: '/lots', label: 'Витрина лотов', detail: 'Если сигнал влияет на цену — переход к лотам и торгам.', icon: '◌', tone: 'green' },
            { href: '/lots/create', label: 'Создать или скорректировать лот', detail: 'Если новость влияет на предложение, действуем через seller workflow.', icon: '+', tone: 'green' }
          ]}
        />

        <section className="section-card">
          <div className="panel-title-row">
            <div>
              <div className="dashboard-section-title">Последние сигналы</div>
              <div className="dashboard-section-subtitle">Строки ведут в market-news, а дальше — в аналитику, прогнозы и действие.</div>
            </div>
          </div>
          <div className="section-stack" style={{ marginTop: 16 }}>
            {notes.length ? notes.map((item) => (
              <Link key={item.id} href={item.actionHref || '/market-news'} className="list-row linkable">
                <div>
                  <b>{item.title || item.id}</b>
                  <div className="muted small">{item.scope || item.type || 'market signal'}</div>
                </div>
                <div className="muted small">Открыть</div>
              </Link>
            )) : <div className="empty-state">Сигналы рынка сейчас не выделены отдельно. Используй каноническую ленту рынка.</div>}
          </div>
        </section>
      </AppShell>
    </PageAccessGuard>
  );
}
