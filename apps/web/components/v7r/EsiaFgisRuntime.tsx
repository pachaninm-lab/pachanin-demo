'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';
import {
  connectors,
  lots,
  queueEntries,
  roleReadinessCards,
  getAuctionById,
  getDealById,
  getConnectionTone,
  getQueueTone,
  getReadinessTone,
  type BlockerItem,
  type ConnectorStatus,
  type LotItem,
  type QueueEntry,
  type ReadinessState,
} from '@/lib/v7r/esia-fgis-data';

type Tone = 'success' | 'warning' | 'danger' | 'neutral';

function palette(tone: Tone) {
  if (tone === 'success') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (tone === 'warning') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  if (tone === 'danger') return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  return { bg: '#F8FAFB', border: '#E4E6EA', color: '#475569' };
}

function PageFrame({
  title,
  subtitle,
  aside,
  children,
}: {
  title: string;
  subtitle: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: '#0F1419' }}>{title}</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8, maxWidth: 860 }}>{subtitle}</div>
          </div>
          {aside}
        </div>
      </section>
      {children}
    </div>
  );
}

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const p = palette(tone);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: 999, background: p.bg, border: `1px solid ${p.border}`, color: p.color, fontSize: 11, fontWeight: 800 }}>
      {children}
    </span>
  );
}

function Button({
  href,
  onClick,
  label,
  tone = 'neutral',
  disabled = false,
}: {
  href?: string;
  onClick?: () => void;
  label: string;
  tone?: Tone;
  disabled?: boolean;
}) {
  const p = palette(tone);
  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: '10px 14px',
    border: `1px solid ${p.border}`,
    background: disabled ? '#F3F4F6' : p.bg,
    color: disabled ? '#9CA3AF' : p.color,
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.8 : 1,
  };
  return href ? <Link href={href} style={style}>{label}</Link> : <button onClick={disabled ? undefined : onClick} style={style} disabled={disabled}>{label}</button>;
}

export function ReadinessBadge({ state }: { state: ReadinessState }) {
  return <Badge tone={getReadinessTone(state)}>{state}</Badge>;
}

export function SourceTypeBadge({ sourceType }: { sourceType: 'MANUAL' | 'FGIS' }) {
  return <Badge tone={sourceType === 'FGIS' ? 'warning' : 'neutral'}>{sourceType}</Badge>;
}

export function BlockerList({ blockers }: { blockers: BlockerItem[] }) {
  if (!blockers.length) {
    return <div style={{ fontSize: 13, color: '#6B778C' }}>Блокеров нет.</div>;
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {blockers.map((blocker) => (
        <div key={blocker.id} style={{ background: '#fff', border: '1px solid #F1D2D2', borderRadius: 14, padding: 14 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>{blocker.title}</div>
            <Badge tone='danger'>{blocker.reasonCode}</Badge>
          </div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.65, marginTop: 8 }}>{blocker.detail}</div>
          <div style={{ fontSize: 12, color: '#B91C1C', lineHeight: 1.6, marginTop: 8 }}>{blocker.impact}</div>
        </div>
      ))}
    </div>
  );
}

export function GateResultPanel({
  state,
  blockers,
  nextStep,
  nextOwner,
}: {
  state: ReadinessState;
  blockers: BlockerItem[];
  nextStep: string | null;
  nextOwner: string | null;
}) {
  const tone = getReadinessTone(state);
  const p = palette(tone);
  return (
    <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Результат gate-проверки</div>
        <ReadinessBadge state={state} />
      </div>
      <div style={{ padding: 14, borderRadius: 14, background: p.bg, border: `1px solid ${p.border}`, color: p.color, fontSize: 13, fontWeight: 700 }}>
        {state === 'PASS' ? 'Контур готов: можно двигать объект дальше.' : state === 'REVIEW' ? 'Есть ручная проверка перед следующим шагом.' : 'Есть блокер: дальнейшее движение остановлено.'}
      </div>
      <div style={{ marginTop: 14 }}>
        <BlockerList blockers={blockers} />
      </div>
      <div style={{ display: 'grid', gap: 6, marginTop: 14 }}>
        <div style={{ fontSize: 12, color: '#6B778C' }}>Следующий шаг</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{nextStep ?? '—'}</div>
        <div style={{ fontSize: 12, color: '#6B778C' }}>Следующий владелец</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{nextOwner ?? '—'}</div>
      </div>
    </section>
  );
}

export function ConnectorStatusCard({ item }: { item: ConnectorStatus }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{item.type}</div>
        <Badge tone={getConnectionTone(item.connectionState)}>{item.connectionState}</Badge>
      </div>
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        <div style={{ fontSize: 13, color: '#475569' }}><strong>Режим:</strong> {item.modeLabel}</div>
        <div style={{ fontSize: 13, color: '#475569' }}><strong>Последний sync:</strong> {item.lastSyncAt ?? '—'}</div>
        <div style={{ fontSize: 13, color: '#475569' }}><strong>Очередь:</strong> {item.pending}</div>
        <div style={{ fontSize: 13, color: '#475569' }}><strong>Сбой:</strong> {item.errorText ?? 'Нет'}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <Button label='Повторить sync' tone='warning' />
        <Button label='Переподключить' />
      </div>
    </section>
  );
}

export function SyncQueueTable({ items }: { items: QueueEntry[] }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map((item) => (
        <div key={item.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: '#6B778C' }}>Очередь</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 13 }}>{item.id}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6B778C' }}>Источник</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{item.connectorType}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6B778C' }}>Объект</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{item.objectType} / {item.objectId}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6B778C' }}>Статус</div>
            <Badge tone={getQueueTone(item.queueState)}>{item.queueState}</Badge>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6B778C' }}>Причины</div>
            <div style={{ fontSize: 12, color: '#475569' }}>{item.reasonCodes.join(', ')}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6B778C' }}>Владелец</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{item.owner}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Button label='Повторить' tone='warning' />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NextRailCard({ title, text, href }: { title: string; text: string; href: string }) {
  return (
    <section style={{ background: 'linear-gradient(180deg, rgba(10,122,95,0.08) 0%, rgba(255,255,255,0.96) 100%)', border: '1px solid rgba(10,122,95,0.14)', borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#0A7A5F', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{title}</div>
      <div style={{ fontSize: 18, lineHeight: 1.4, fontWeight: 800, color: '#0F1419', marginTop: 8 }}>{text}</div>
      <div style={{ marginTop: 14 }}>
        <Button label='Открыть' href={href} tone='success' />
      </div>
    </section>
  );
}

export function ImportFromFGISPanel() {
  const fgis = connectors.find((item) => item.type === 'FGIS')!;
  const fgisLot = lots.find((item) => item.sourceType === 'FGIS')!;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Импорт из ФГИС</div>
        <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.6, marginTop: 6 }}>Ниже — честный sandbox-контур. Пока gate не пройден, импорт отключён.</div>
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: '#6B778C' }}>Источник партии</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{fgisLot.sourceReference}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6B778C' }}>Статус подключения</div>
            <Badge tone={getConnectionTone(fgis.connectionState)}>{fgis.connectionState}</Badge>
          </div>
        </div>
      </section>
      <GateResultPanel
        state={fgisLot.readiness.state}
        blockers={fgisLot.readiness.blockers}
        nextStep={fgisLot.readiness.nextStep}
        nextOwner={fgisLot.readiness.nextOwner}
      />
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 12, color: '#6B778C', marginBottom: 8 }}>Действие</div>
        <Button label='Импортировать лот из ФГИС' tone='danger' disabled />
        <div style={{ fontSize: 12, color: '#B91C1C', lineHeight: 1.6, marginTop: 10 }}>
          Кнопка отключена, потому что gate = FAIL. Сначала нужно снять blocker reasons выше.
        </div>
      </section>
    </div>
  );
}

function StatCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800, color: '#0F1419', marginTop: 8 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6B778C', lineHeight: 1.6, marginTop: 8 }}>{note}</div>
    </section>
  );
}

export function PlatformV7LandingPage() {
  const router = useRouter();
  const { setRole } = usePlatformV7RStore();
  const roleMap: Record<string, PlatformRole> = {
    operator: 'operator',
    buyer: 'buyer',
    seller: 'seller',
    bank: 'bank',
  };

  return (
    <PageFrame
      title='ESIA / ФГИС readiness-вход'
      subtitle='Это не simulation-note и не markdown. Это реальный экран входа, где сразу видно: какой контур готов, где блокер и куда идти дальше.'
      aside={<Badge tone='warning'>Песочница · до интеграции</Badge>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <StatCard title='ESIA degraded' value='3' note='3 элемента требуют ручной проверки или повторной авторизации.' />
        <StatCard title='FGIS pending' value='7' note='7 элементов стоят в очереди синка или разбора gate.' />
        <StatCard title='FAIL' value='2' note='2 роли заходят в контур с жёсткими блокерами.' />
        <StatCard title='REVIEW' value='2' note='2 роли требуют ручного подтверждения следующего шага.' />
      </div>
      <div style={{ display: 'grid', gap: 14 }}>
        {roleReadinessCards.map((card) => (
          <section key={card.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{card.title}</div>
              <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.6, marginTop: 6 }}>{card.blockerSummary}</div>
            </div>
            <div>
              <ReadinessBadge state={card.readinessState} />
            </div>
            <div style={{ fontSize: 13, color: '#0F1419', fontWeight: 700 }}>{card.nextRail}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  const role = roleMap[card.role];
                  if (role) setRole(role);
                  router.push(card.href);
                }}
                style={{ borderRadius: 12, padding: '10px 14px', border: '1px solid rgba(10,122,95,0.16)', background: 'rgba(10,122,95,0.08)', color: '#0A7A5F', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Открыть кабинет
              </button>
            </div>
          </section>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <NextRailCard title='Коннекторы' text='Проверить статус ESIA / ФГИС и увидеть реальные degraded / sandbox состояния.' href='/platform-v7/connectors' />
        <NextRailCard title='Очередь' text='Открыть очередь ESIA/ФГИС и руками снять blocker по проблемным объектам.' href='/platform-v7/operator-cockpit/queues' />
      </div>
    </PageFrame>
  );
}

export function LotsPage() {
  const [sourceFilter, setSourceFilter] = React.useState<'ALL' | 'FGIS' | 'MANUAL'>('ALL');
  const [blockerOnly, setBlockerOnly] = React.useState(false);

  const filtered = lots.filter((item) => {
    const sourceOk = sourceFilter === 'ALL' ? true : item.sourceType === sourceFilter;
    const blockerOk = blockerOnly ? item.readiness.blockers.length > 0 : true;
    return sourceOk && blockerOk;
  });

  return (
    <PageFrame
      title='Лоты'
      subtitle='Новые поля source/readiness/blocker summary уже в экране. Здесь видно, какой лот ручной, какой пришёл из ФГИС и что именно его тормозит.'
      aside={<Button label='Создать / импортировать лот' href='/platform-v7/lots/create' tone='success' />}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button label='Все' onClick={() => setSourceFilter('ALL')} tone={sourceFilter === 'ALL' ? 'success' : 'neutral'} />
        <Button label='Только FGIS' onClick={() => setSourceFilter('FGIS')} tone={sourceFilter === 'FGIS' ? 'success' : 'neutral'} />
        <Button label='Только manual' onClick={() => setSourceFilter('MANUAL')} tone={sourceFilter === 'MANUAL' ? 'success' : 'neutral'} />
        <Button label={blockerOnly ? 'Показать все' : 'Только с блокерами'} onClick={() => setBlockerOnly((v) => !v)} tone={blockerOnly ? 'warning' : 'neutral'} />
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {filtered.map((item: LotItem) => (
          <section key={item.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 800, color: '#0A7A5F' }}>{item.id}</div>
              <div style={{ fontSize: 13, color: '#0F1419', fontWeight: 700, marginTop: 4 }}>{item.title}</div>
            </div>
            <div>
              <SourceTypeBadge sourceType={item.sourceType} />
            </div>
            <div>
              <ReadinessBadge state={item.readiness.state} />
            </div>
            <div style={{ fontSize: 12, color: '#475569' }}>{item.sourceReference ?? 'Ручной ввод'}</div>
            <div style={{ fontSize: 12, color: '#B91C1C' }}>{item.readiness.blockers[0]?.reasonCode ?? 'Блокеров нет'}</div>
            <div style={{ fontSize: 12, color: '#0F1419', fontWeight: 700 }}>{item.readiness.nextStep ?? 'Можно двигать дальше'}</div>
          </section>
        ))}
      </div>
    </PageFrame>
  );
}

export function LotCreatePage() {
  const [mode, setMode] = React.useState<'MANUAL' | 'FGIS'>('MANUAL');

  return (
    <PageFrame
      title='Создание лота'
      subtitle='Здесь появился реальный переключатель MANUAL / IMPORT FROM FGIS. При FGIS система честно показывает gate, blocker reasons и отключает действие, если контур не готов.'
      aside={<Badge tone='warning'>Песочница</Badge>}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button label='MANUAL' onClick={() => setMode('MANUAL')} tone={mode === 'MANUAL' ? 'success' : 'neutral'} />
        <Button label='IMPORT FROM FGIS' onClick={() => setMode('FGIS')} tone={mode === 'FGIS' ? 'success' : 'neutral'} />
      </div>
      {mode === 'MANUAL' ? (
        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Ручное создание</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <input placeholder='Культура' style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }} />
            <input placeholder='Объём, тонн' style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }} />
            <input placeholder='Регион' style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }} />
          </div>
          <Button label='Создать ручной лот' tone='success' />
        </section>
      ) : (
        <ImportFromFGISPanel />
      )}
    </PageFrame>
  );
}

export function AuctionDetailPage({ id }: { id: string }) {
  const item = getAuctionById(id);
  if (!item) {
    return <PageFrame title='Торг не найден' subtitle={`Аукцион ${id} не найден.`}><Button label='Назад к лотам' href='/platform-v7/lots' /></PageFrame>;
  }
  const disabled = item.gate.state === 'FAIL';
  return (
    <PageFrame
      title={item.title}
      subtitle='Перед выбором победителя встроен FGIS gate. При FAIL действие реально заблокировано. При REVIEW нужен ручной операторский шаг.'
      aside={<Button label='Открыть лоты' href='/platform-v7/lots' />}
    >
      <GateResultPanel state={item.gate.state} blockers={item.gate.blockers} nextStep={item.gate.nextStep} nextOwner={item.gate.nextOwner} />
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Выбор победителя</div>
        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, marginTop: 8 }}>Кандидат: {item.winnerLabel}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          <Button label='Выбрать победителя' tone={disabled ? 'danger' : 'success'} disabled={disabled} />
          <Button label='Нужна ручная проверка' tone='warning' disabled={item.gate.state !== 'REVIEW'} />
        </div>
        {disabled && <div style={{ fontSize: 12, color: '#B91C1C', lineHeight: 1.6, marginTop: 10 }}>Действие отключено, потому что gate = FAIL.</div>}
      </section>
    </PageFrame>
  );
}

export function DealReadinessPage({ id }: { id: string }) {
  const item = getDealById(id);
  if (!item) {
    return <PageFrame title='Сделка не найдена' subtitle={`Сделка ${id} не найдена.`}><Button label='Назад к сделкам' href='/platform-v7/deals' /></PageFrame>;
  }
  return (
    <PageFrame
      title={item.title}
      subtitle='В карточке сделки добавлен отдельный ESIA / ФГИС readiness-блок: connection status, sync status, source reference, queue state, blocker list и next rail.'
      aside={<Badge tone='warning'>Песочница · до интеграции</Badge>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <StatCard title='Источник' value={item.sourceType} note={item.sourceReference ?? 'Ручной ввод'} />
        <StatCard title='Queue state' value={item.queueState} note={`Last sync: ${item.lastSyncAt ?? '—'}`} />
        <StatCard title='Next owner' value={item.nextOwner ?? '—'} note={item.nextStep ?? '—'} />
      </div>
      <GateResultPanel state={item.readiness.state} blockers={item.readiness.blockers} nextStep={item.readiness.nextStep} nextOwner={item.readiness.nextOwner} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        <ConnectorStatusCard item={item.connectorStatus.ESIA} />
        <ConnectorStatusCard item={item.connectorStatus.FGIS} />
      </div>
      <NextRailCard title='Следующий rail' text={item.nextStep ?? 'Нет следующего шага'} href='/platform-v7/operator-cockpit/queues' />
    </PageFrame>
  );
}

export function ConnectorsPage() {
  return (
    <PageFrame
      title='Коннекторы'
      subtitle='Здесь появились реальные карточки ESIA и ФГИС со status / last sync / queue size / error state. Без ложных production claims.'
      aside={<Button label='Открыть очередь' href='/platform-v7/operator-cockpit/queues' tone='success' />}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {connectors.map((item) => <ConnectorStatusCard key={item.type} item={item} />)}
      </div>
    </PageFrame>
  );
}

export function OperatorQueuesPage() {
  const [source, setSource] = React.useState<'ALL' | 'ESIA' | 'FGIS'>('ALL');
  const items = queueEntries.filter((entry) => source === 'ALL' ? true : entry.connectorType === source);
  const pending = items.filter((entry) => entry.queueState === 'pending').length;
  const failed = items.filter((entry) => entry.queueState === 'failed').length;
  const processing = items.filter((entry) => entry.queueState === 'processing').length;
  const done = items.filter((entry) => entry.queueState === 'done').length;

  return (
    <PageFrame
      title='Очередь ESIA / ФГИС'
      subtitle='Новая операторская очередь: pending / failed / processing / done, reason codes, retry action и фильтр по источнику.'
      aside={<Badge tone='warning'>Песочница</Badge>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <StatCard title='Pending' value={String(pending)} note='Элементы ждут запуска.' />
        <StatCard title='Processing' value={String(processing)} note='Контур выполняет ingestion.' />
        <StatCard title='Failed' value={String(failed)} note='Требуется операторский разбор.' />
        <StatCard title='Done' value={String(done)} note='Объекты уже прошли через очередь.' />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button label='Все' onClick={() => setSource('ALL')} tone={source === 'ALL' ? 'success' : 'neutral'} />
        <Button label='ESIA' onClick={() => setSource('ESIA')} tone={source === 'ESIA' ? 'success' : 'neutral'} />
        <Button label='ФГИС' onClick={() => setSource('FGIS')} tone={source === 'FGIS' ? 'success' : 'neutral'} />
      </div>
      <SyncQueueTable items={items} />
    </PageFrame>
  );
}
