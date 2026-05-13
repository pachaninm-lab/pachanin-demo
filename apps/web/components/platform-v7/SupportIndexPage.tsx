'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useSupportCases } from '@/lib/platform-v7/support-client-store';
import { SUPPORT_CATEGORY_LABELS, SUPPORT_MATURITY_LABEL, SUPPORT_PRIORITY_LABELS, SUPPORT_STATUS_LABELS, supportFormatRub, supportLastMessage, supportObjectLabel, supportSortCases } from '@/lib/platform-v7/support-helpers';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const card: CSSProperties = { background: 'var(--pc-bg-card, #fff)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 16 };
const muted: CSSProperties = { color: 'var(--pc-text-muted, #64748b)', fontSize: 13, lineHeight: 1.6 };
const pill: CSSProperties = { display: 'inline-flex', padding: '5px 9px', borderRadius: 999, border: '1px solid var(--pc-border, #E4E6EA)', fontSize: 11, fontWeight: 800 };

const FIELD_SUPPORT_ROLES = new Set<PlatformRole>(['driver', 'surveyor', 'elevator', 'lab']);
const OPERATOR_SUPPORT_ROLES = new Set<PlatformRole>(['operator', 'executive']);
const SCOPED_SUPPORT_ROLES = new Set<PlatformRole>(['bank', 'arbitrator', 'compliance']);

function dt(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function supportIntro(role: PlatformRole) {
  if (FIELD_SUPPORT_ROLES.has(role)) {
    return {
      title: role === 'driver' ? 'Помощь по моему рейсу' : 'Помощь по моей проверке',
      text: 'Здесь видны только мои обращения по рейсу, документу, фото, пломбе, весу, пробе или задержке. Операторские очереди, суммы риска и банковские данные скрыты.',
      listTitle: 'Мои обращения',
      showOperatorMetrics: false,
      showMoney: false,
    };
  }

  if (SCOPED_SUPPORT_ROLES.has(role)) {
    return {
      title: 'Поддержка по моему контуру',
      text: 'Здесь видны обращения, связанные с моей зоной проверки: основание, документ, допуск, спор или ручная сверка. Общая операторская очередь скрыта.',
      listTitle: 'Обращения по моему контуру',
      showOperatorMetrics: false,
      showMoney: role === 'bank' || role === 'arbitrator',
    };
  }

  return {
    title: 'Центр поддержки исполнения сделки',
    text: 'Каждое обращение привязано к сделке, документу, рейсу, деньгам, спору или причине остановки. Пользователь видит статус и следующий шаг. Оператор видит очередь, сумму риска и журнал действий.',
    listTitle: 'Мои обращения',
    showOperatorMetrics: OPERATOR_SUPPORT_ROLES.has(role),
    showMoney: true,
  };
}

export function SupportIndexPage() {
  const role = usePlatformV7RStore((state) => state.role);
  const { cases, messages } = useSupportCases();
  const sortedCases = supportSortCases(cases);
  const totalMoney = sortedCases.reduce((sum, item) => sum + item.moneyAtRiskRub, 0);
  const urgent = sortedCases.filter((item) => item.priority === 'P0' || item.priority === 'P1').length;
  const intro = supportIntro(role);

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1180, margin: '0 auto' }}>
      <section style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ ...pill, width: 'fit-content' }}>{SUPPORT_MATURITY_LABEL}</div>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.1 }}>{intro.title}</h1>
          <p style={muted}>{intro.text}</p>
        </div>
        <Link href='/platform-v7/support/new' style={{ textDecoration: 'none', padding: '12px 14px', borderRadius: 14, background: 'var(--pc-accent, #0A7A5F)', color: '#fff', fontSize: 13, fontWeight: 900, width: 'fit-content' }}>Создать обращение</Link>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
        <div style={card}><div style={muted}>Всего обращений</div><div style={{ fontSize: 28, fontWeight: 900 }}>{sortedCases.length}</div></div>
        <div style={card}><div style={muted}>Срочные</div><div style={{ fontSize: 28, fontWeight: 900 }}>{urgent}</div></div>
        {intro.showMoney ? <div style={card}><div style={muted}>Деньги под риском</div><div style={{ fontSize: 28, fontWeight: 900 }}>{supportFormatRub(totalMoney)}</div></div> : null}
        {intro.showOperatorMetrics ? <div style={card}><div style={muted}>Операторская очередь</div><Link href='/platform-v7/support/operator' style={{ color: 'var(--pc-accent, #0A7A5F)', fontSize: 14, fontWeight: 900, textDecoration: 'none' }}>Открыть очередь</Link></div> : null}
      </section>

      <section style={{ ...card, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>{intro.listTitle}</h2>
          <Link href='/platform-v7/support/new' style={{ color: 'var(--pc-accent, #0A7A5F)', fontWeight: 900, textDecoration: 'none' }}>+ Новое обращение</Link>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {sortedCases.map((item) => (
            <Link key={item.id} href={`/platform-v7/support/${item.id}`} style={{ textDecoration: 'none', color: 'inherit', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 16, padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, background: 'var(--pc-bg-elevated, rgba(15,20,25,0.02))' }}>
              <div style={{ display: 'grid', gap: 7 }}><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><span style={pill}>{item.id}</span><span style={pill}>{SUPPORT_PRIORITY_LABELS[item.priority]}</span><span style={pill}>{SUPPORT_CATEGORY_LABELS[item.category]}</span></div><div style={{ fontSize: 16, fontWeight: 900 }}>{item.title}</div><div style={muted}>{supportLastMessage(item.id, messages)}</div></div>
              <div style={{ display: 'grid', gap: 6 }}><div style={muted}>Статус</div><b>{SUPPORT_STATUS_LABELS[item.status]}</b><div style={muted}>Следующий шаг: {item.nextAction}</div></div>
              <div style={{ display: 'grid', gap: 6 }}><div style={muted}>{supportObjectLabel(item)}</div><b>Срок реакции: {dt(item.slaDueAt)}</b>{intro.showMoney ? <b>{supportFormatRub(item.moneyAtRiskRub)}</b> : null}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
