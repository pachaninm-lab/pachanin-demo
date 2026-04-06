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
import { ALL_AUTHENTICATED_ROLES } from '../../lib/route-roles';

function chatTarget(room: any) {
  if (room.scope === 'deal') return { href: `/deals/${room.linkedId}`, label: 'Сделка', detail: 'Коммерческий и операционный чат по сделке' };
  if (room.scope === 'logistics') return { href: `/logistics/${room.linkedId}`, label: 'Логистика', detail: 'Маршрут, ETA, deviation и handoff' };
  if (room.scope === 'finance') return { href: `/payments/${room.linkedId}`, label: 'Платежи', detail: 'Hold, release и спорные расчёты' };
  if (room.scope === 'lab') return { href: `/disputes/${room.linkedId}`, label: 'Спор / качество', detail: 'Re-test и quality clarification' };
  return { href: '/support', label: 'Поддержка', detail: 'Support-диалог и операторские комментарии' };
}

export default async function ChatsPage() {
  const snapshot = await getRuntimeSnapshot();
  const chats = snapshot.chats || [];

  return (
    <AppShell
      title="Коммуникации и связанные чаты"
      subtitle="Чаты должны быть встроены в сделку: из каждого диалога — переход в объект, owner и следующий шаг."
      breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Чаты' }]} />}
    >
      <PageAccessGuard allowedRoles={[...ALL_AUTHENTICATED_ROLES]} title="Чаты доступны после входа" subtitle="Коммуникации должны жить внутри авторизованного рабочего контура, а не быть публичным входом.">
        <RuntimeSourceBanner snapshot={snapshot} />
        <SourceNote source={snapshot.meta?.source || 'runtime.chats'} updatedAt={snapshot.meta?.lastSimulatedAt || null} warning="Чат нужен не для болтовни, а для фиксации договорённостей по объекту. Из каждого диалога оператор и участник должны переходить в реальный модуль сделки." compact />

        <DetailHero
          kicker="Deal-bound communications"
          title="Диалоги должны быть привязаны к объекту и приводить к действию"
          description="Здесь собраны чаты по сделкам, логистике, support, финансам и лаборатории. Каждый диалог открывает связанный модуль и следующий шаг по кейсу."
          chips={[
            <span key="rooms">Комнат {chats.length}</span>,
            <span key="bound">Все чаты привязаны к объектам</span>
          ]}
          nextStep="Открыть нужную комнату, проверить последнее сообщение и перейти в связанный рабочий модуль"
          owner="участник сделки / operator"
          blockers="чат не должен быть тупиком: у каждой комнаты должен быть объект, owner и переход в рабочий модуль"
          actions={[
            { href: '/support', label: 'Поддержка' },
            { href: '/deals', label: 'Сделки', variant: 'secondary' },
            { href: '/disputes', label: 'Споры', variant: 'secondary' }
          ]}
        />

        <div className="stack-sm">
          {chats.map((room: any) => {
            const target = chatTarget(room);
            const lastMessage = room.messages?.[room.messages.length - 1];
            return (
              <Link key={room.id} href={`/chats/${room.id}`} className="mobile-list-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div>
                    <div className="dashboard-list-title">{room.title}</div>
                    <div className="dashboard-list-subtitle">{room.scope} · {room.linkedId}</div>
                  </div>
                  <span className="status-pill blue">{room.participants.length} участников</span>
                </div>
                <div className="muted small" style={{ marginTop: 10 }}>{lastMessage ? `${lastMessage.who}: ${lastMessage.text}` : 'Сообщений пока нет'}</div>
                <div className="muted small" style={{ marginTop: 8 }}>Открывает модуль: {target.label} · {target.detail}</div>
              </Link>
            );
          })}
        </div>

        <ModuleHub
          title="Связанные модули"
          subtitle="Из чата должен быть быстрый переход туда, где реально выполняется работа."
          items={chats.map((room: any) => {
            const target = chatTarget(room);
            return {
              href: target.href,
              label: room.title,
              detail: target.detail,
              meta: target.label,
              tone: 'blue',
              icon: '↗'
            };
          })}
        />

        <NextStepBar
          title="Открыть нужную комнату и перейти в связанный объект сделки"
          detail="Чаты нужны для фиксации решений, а не как отдельный мессенджер без контекста."
          primary={{ href: '/support', label: 'Поддержка' }}
          secondary={[
            { href: '/deals', label: 'Сделки' },
            { href: '/logistics', label: 'Логистика' }
          ]}
        />
      </PageAccessGuard>
    </AppShell>
  );
}
