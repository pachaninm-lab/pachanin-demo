import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { DetailHero } from '../../components/detail-hero';
import { ModuleHub } from '../../components/module-hub';
import { NextStepBar } from '../../components/next-step-bar';
import { RuntimeSourceBanner } from '../../components/runtime-source-banner';
import { SourceNote } from '../../components/source-note';
import { PageAccessGuard } from '../../components/page-access-guard';
import { getRuntimeSnapshot } from '../../lib/runtime-server';
import { INTERNAL_ONLY_ROLES } from '../../lib/route-roles';

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-').replace(/^-+|-+$/g, '');
}

function toneForStatus(status: string) {
  const normalized = String(status).toUpperCase();
  if (['CONNECTED', 'LIVE', 'OK'].includes(normalized)) return 'green';
  if (['SANDBOX', 'MANUAL_FALLBACK'].includes(normalized)) return 'blue';
  if (['WAITING_CREDENTIALS', 'DEGRADED', 'RETRYING', 'UNAVAILABLE'].includes(normalized)) return 'amber';
  return 'red';
}

function moduleForConnector(name: string) {
  const value = name.toLowerCase();
  if (value.includes('эдо')) return { href: '/documents', detail: 'Документный контур, подпись и exchange jobs' };
  if (value.includes('фгис')) return { href: '/onboarding', detail: 'Госконтур, СДИЗ и регистрационные статусы' };
  if (value.includes('банк')) return { href: '/payments', detail: 'Reserve / hold / release и callbacks банка' };
  if (value.includes('gps')) return { href: '/logistics', detail: 'Онлайн рейсы, ETA, stop-forms и route deviation' };
  if (value.includes('лаборат')) return { href: '/lab', detail: 'Протоколы, re-test и price impact' };
  if (value.includes('smartagro')) return { href: '/forecasting', detail: 'Прогнозы, поля и планирование урожая' };
  return { href: '/control', detail: 'Operator-контур и ручной fallback' };
}

export default async function ConnectorsPage() {
  const snapshot = await getRuntimeSnapshot();
  const items = snapshot.connectors || [];
  const degraded = items.filter((item: any) => ['WAITING_CREDENTIALS', 'DEGRADED', 'RETRYING', 'UNAVAILABLE'].includes(String(item.status).toUpperCase())).length;
  const attention = items.filter((item: any) => ['SANDBOX', 'MANUAL_FALLBACK', 'WAITING_CREDENTIALS', 'DEGRADED', 'RETRYING', 'UNAVAILABLE'].includes(String(item.status).toUpperCase())).length;

  return (
    <AppShell
      title="Коннекторы и здоровье интеграций"
      subtitle="Каждый провайдер должен иметь понятный режим работы, связанный рабочий модуль и понятный manual fallback."
      breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/control', label: 'Контроль' }, { label: 'Коннекторы' }]} />}
    >
      <PageAccessGuard allowedRoles={[...INTERNAL_ONLY_ROLES]} internal>
        <RuntimeSourceBanner snapshot={snapshot} />
        <SourceNote source={snapshot.meta?.source || 'runtime.connectors'} updatedAt={snapshot.meta?.lastSimulatedAt || null} warning="Коннектор считается рабочим только тогда, когда у оператора есть не только статус, но и понятное место в продукте: где он влияет на шаг сделки и какой fallback допускается." compact />

        <DetailHero
          kicker="Integration health center"
          title="Интеграции должны быть связаны с шагами сделки, а не жить отдельным техническим списком"
          description="Оператору нужно понимать: что именно деградировало, какой рабочий модуль страдает и можно ли безопасно перевести шаг во временный ручной режим."
          chips={[
            <span key="all">Провайдеров {items.length}</span>,
            <span key="degraded">Блокирующих {degraded}</span>,
            <span key="attention">Под контролем {attention}</span>,
            <span key="live">Зелёных {items.length - attention + (attention - degraded)}</span>
          ]}
          nextStep={degraded > 0 ? 'Разобрать sandbox / degraded провайдеры и проверить, какие модули сейчас работают в manual fallback' : 'Проверить журнал обменов и подтвердить, что backlog синхронизирован'}
          owner="admin / operator"
          blockers={degraded > 0 ? `в зоне внимания ${degraded} провайдеров` : 'критичных деградаций не видно'}
          actions={[
            { href: '/runtime-ops', label: 'Инженерный контур' },
            { href: '/documents', label: 'Документы / ЭДО', variant: 'secondary' },
            { href: '/payments', label: 'Платежи / банк', variant: 'secondary' }
          ]}
        />

        <div className="dashboard-grid-3">
          <div className="dashboard-card"><div className="dashboard-card-title">Всего провайдеров</div><div className="dashboard-card-value">{items.length}</div><div className="dashboard-card-caption">каналы обмена, влияющие на сделку</div></div>
          <div className="dashboard-card"><div className="dashboard-card-title">Нуждаются во внимании</div><div className="dashboard-card-value">{attention}</div><div className="dashboard-card-caption">sandbox, manual fallback или проблемные production-коннекторы</div></div>
          <div className="dashboard-card"><div className="dashboard-card-title">Связанные рабочие модули</div><div className="dashboard-card-value">{new Set(items.map((item: any) => moduleForConnector(item.name).href)).size}</div><div className="dashboard-card-caption">куда должен идти оператор для проверки последствий</div></div>
        </div>

        <div className="dashboard-grid-3" style={{ marginTop: 18 }}>
          {items.map((item: any) => {
            const connectorModule = moduleForConnector(item.name);
            return (
              <Link key={item.name} href={`/connectors/${slugify(item.name)}`} className="dashboard-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div className="dashboard-list-title">{item.name}</div>
                  <span className={`status-pill ${toneForStatus(item.status)}`}>{item.status}</span>
                </div>
                <div className="dashboard-list-subtitle" style={{ marginTop: 10 }}>{item.note}</div>
                <div className="status-line" style={{ marginTop: 14 }}>
                  <span className="mini-chip">Latency {item.latency}</span>
                  <span className="mini-chip">Quality {item.quality}</span>
                </div>
                <div className="muted small" style={{ marginTop: 12 }}>Влияет на: {connectorModule.detail}</div>
              </Link>
            );
          })}
        </div>

        <ModuleHub
          title="Связанные рабочие модули"
          subtitle="Из панели интеграций должен быть быстрый переход туда, где деградация реально ломает шаг сделки."
          items={items.map((item: any) => {
            const connectorModule = moduleForConnector(item.name);
            return {
              href: connectorModule.href,
              label: item.name,
              detail: connectorModule.detail,
              meta: item.status,
              tone: toneForStatus(item.status) as any,
              icon: '↗'
            };
          })}
        />

        <NextStepBar
          title={attention > 0 ? 'Проверить manual fallback и sandbox-рейсы, чтобы они не превратились в скрытый blocker' : 'Проверить, что все боевые шаги сделки идут через зелёные провайдеры'}
          detail="Коннектор — это не просто статус, а гарантия прохождения конкретного шага сделки."
          primary={{ href: '/runtime-ops', label: 'Открыть runtime ops' }}
          secondary={[
            { href: '/audit', label: 'Аудит' },
            { href: '/control', label: 'Контроль' }
          ]}
        />
      </PageAccessGuard>
    </AppShell>
  );
}
