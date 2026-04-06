import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { INTERNAL_ONLY_ROLES, EXECUTIVE_ROLES } from '../../../lib/route-roles';
import { readCommercialWorkspace } from '../../../lib/commercial-workspace-store';

export default async function ConnectorDetailPage({ params }: { params: { id: string } }) {
  const state = await readCommercialWorkspace();
  const connector = state.connectors.find((item) => item.id === params.id) || null;

  if (!connector) {
    return (
      <PageFrame title="Коннектор не найден" subtitle="Карточка интеграции отсутствует в текущем workspace.">
        <div className="section-card">
          <div className="section-title">Нет данных</div>
          <div className="muted" style={{ marginTop: 8 }}>Вернись в connectors rail и открой актуальный connector.</div>
          <div className="cta-stack" style={{ marginTop: 16 }}>
            <Link href="/connectors" className="primary-link">Connectors rail</Link>
            <Link href="/support" className="secondary-link">Support</Link>
          </div>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageAccessGuard allowedRoles={[...INTERNAL_ONLY_ROLES, ...EXECUTIVE_ROLES]} title="Карточка интеграции ограничена" subtitle="Карточка connector нужна внутренним и техническим управляющим ролям.">
      <PageFrame title={connector.id} subtitle={`${connector.system} · ${connector.status}`} breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/connectors', label: 'Connectors' }, { label: connector.id }]} />}>
        <SourceNote source="commercial workspace / connector projection" warning="Карточка connector должна быть рабочим integration rail: health, callback, backlog и связанный operational impact." compact />
        <DetailHero
          kicker="Connector rail"
          title={connector.system}
          description={`Смотрим status, callback health, backlog и какой operational rail страдает от деградации connector.`}
          chips={[connector.status, connector.callbackHealth, connector.owner, connector.latencyLabel]}
          nextStep={connector.nextAction}
          owner={connector.owner}
          blockers={connector.blocker || '—'}
          actions={[
            { href: '/connectors', label: 'Назад в connectors' },
            { href: '/support', label: 'Support', variant: 'secondary' },
            { href: '/notifications', label: 'Notifications', variant: 'secondary' },
          ]}
        />
        <div className="mobile-two-grid">
          <div className="section-card-tight">
            <div className="section-title">Техническое состояние</div>
            <div className="section-stack" style={{ marginTop: 12 }}>
              <div className="list-row"><span>Status</span><b>{connector.status}</b></div>
              <div className="list-row"><span>Callback</span><b>{connector.callbackHealth}</b></div>
              <div className="list-row"><span>Latency</span><b>{connector.latencyLabel}</b></div>
              <div className="list-row"><span>Backlog</span><b>{connector.backlog}</b></div>
              <div className="list-row"><span>Owner</span><b>{connector.owner}</b></div>
            </div>
          </div>
          <div className="section-card-tight">
            <div className="section-title">Что страдает при деградации</div>
            <div className="detail-meta" style={{ marginTop: 12 }}>
              {connector.affectedRails.map((item) => <span key={item} className="mini-chip">{item}</span>)}
            </div>
            <div className="muted small" style={{ marginTop: 16 }}>Connector rail обязан явно показывать operational impact: money, docs, dispatch, notifications и т.д.</div>
          </div>
        </div>
        <ModuleHub
          title="Связанные rails интеграции"
          subtitle="Карточка connector должна вести дальше в support, notifications и affected rails, а не быть только health-таблицей."
          items={[
            { href: '/support', label: 'Support rail', detail: 'Открыть инцидент и owner action по деградации.', icon: '🛠', meta: connector.owner, tone: 'blue' },
            { href: '/notifications', label: 'Notifications', detail: 'Проверить, что ушло пользователям и что застряло.', icon: '🔔', meta: connector.callbackHealth, tone: 'green' },
            { href: '/payments', label: 'Payments', detail: 'Если connector влияет на money rail — сразу открыть payment impact.', icon: '₽', meta: connector.affectedRails.includes('Payments') ? 'affected' : 'check', tone: 'amber' },
            { href: '/documents', label: 'Documents', detail: 'Если connector бьёт по docs rail — проверить completeness и callback status.', icon: '⌁', meta: connector.affectedRails.includes('Documents') ? 'affected' : 'check', tone: 'gray' },
          ]}
        />
        <NextStepBar
          title="Открыть следующий rail по connector issue"
          detail={connector.nextAction}
          primary={{ href: '/support', label: 'Открыть support' }}
          secondary={[{ href: '/notifications', label: 'Notifications' }, { href: '/payments', label: 'Payments' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
