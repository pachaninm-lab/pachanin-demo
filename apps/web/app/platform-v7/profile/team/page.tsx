'use client';

import * as React from 'react';
import Link from 'next/link';

type TeamMember = {
  name: string;
  role: string;
  access: string;
  note: string;
  status: 'Активен' | 'Ограниченный доступ' | 'Ожидает подтверждения';
  rights: string[];
  email: string;
};

type Invite = {
  id: string;
  name: string;
  role: string;
  email: string;
  state: 'Отправлено' | 'Ожидает подтверждения';
};

const TEAM: TeamMember[] = [
  {
    name: 'Максим П.',
    role: 'Директор / владелец процесса',
    access: 'Полный контур: сделки, банк, стратегия',
    note: 'Финальное решение по пилоту, клиентам и банковому сценарию.',
    status: 'Активен',
    rights: ['Сделки', 'Банк', 'Контрагенты', 'Настройки компании', 'Отчёты'],
    email: 'director@company.ru',
  },
  {
    name: 'Оператор сделки',
    role: 'Операционный контур',
    access: 'Control Tower, сделки, документы, споры',
    note: 'Следит за тем, чтобы сделка не выпадала из единого контура.',
    status: 'Активен',
    rights: ['Control Tower', 'Сделки', 'Документы', 'Споры'],
    email: 'ops@company.ru',
  },
  {
    name: 'Бухгалтер / финконтур',
    role: 'Деньги и документы',
    access: 'Платежи, release, резерв, документы',
    note: 'Не должен менять логистику и полевые действия, но видит денежный слой.',
    status: 'Ограниченный доступ',
    rights: ['Платежи', 'Резерв', 'Release', 'Документы'],
    email: 'finance@company.ru',
  },
  {
    name: 'Логист',
    role: 'Маршруты и рейсы',
    access: 'Логистика, водитель, приёмка',
    note: 'Управляет движением машин и фактом прибытия.',
    status: 'Активен',
    rights: ['Логистика', 'Водитель', 'Приёмка'],
    email: 'logistics@company.ru',
  },
];

const INITIAL_INVITES: Invite[] = [
  { id: 'INV-201', name: 'Юрист компании', role: 'Юрист / документы', email: 'legal@company.ru', state: 'Отправлено' },
  { id: 'INV-202', name: 'Финконтролёр', role: 'Финконтроль', email: 'controller@company.ru', state: 'Ожидает подтверждения' },
];

const IAM_METRICS = [
  { label: 'Пользователей', value: '4', note: 'Активные члены команды в контуре' },
  { label: 'Ролей', value: '4', note: 'Директор, оператор, бухгалтер, логист' },
  { label: 'Ограничений', value: '6', note: 'Денежный слой и операционные границы доступа' },
];

const ACCESS_MATRIX = [
  { scope: 'Control Tower', director: true, operator: true, finance: false, logistics: false },
  { scope: 'Сделки', director: true, operator: true, finance: false, logistics: false },
  { scope: 'Банк / release', director: true, operator: false, finance: true, logistics: false },
  { scope: 'Документы', director: true, operator: true, finance: true, logistics: false },
  { scope: 'Логистика', director: false, operator: false, finance: false, logistics: true },
  { scope: 'Отчёты и профиль', director: true, operator: false, finance: true, logistics: false },
];

function statusTone(status: TeamMember['status'] | Invite['state']) {
  if (status === 'Активен') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (status === 'Ограниченный доступ') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  return { bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#2563EB' };
}

export default function TeamPage() {
  const [members, setMembers] = React.useState<TeamMember[]>(TEAM);
  const [invites, setInvites] = React.useState<Invite[]>(INITIAL_INVITES);
  const [filter, setFilter] = React.useState<'Все' | 'Активные' | 'Ограниченные'>('Все');
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const visibleMembers = members.filter((member) => {
    if (filter === 'Активные') return member.status === 'Активен';
    if (filter === 'Ограниченные') return member.status === 'Ограниченный доступ';
    return true;
  });

  function sendInvite() {
    const next: Invite = {
      id: `INV-${203 + invites.length}`,
      name: 'Новый участник',
      role: 'Роль уточняется',
      email: `new${invites.length + 1}@company.ru`,
      state: 'Отправлено',
    };
    setInvites((prev) => [next, ...prev]);
    setToast(`Приглашение отправлено: ${next.id}`);
  }

  function resendInvite(id: string) {
    setToast(`Приглашение отправлено повторно: ${id}`);
  }

  function revokeInvite(id: string) {
    setInvites((prev) => prev.filter((item) => item.id !== id));
    setToast(`Приглашение отозвано: ${id}`);
  }

  function toggleMemberStatus(name: string) {
    setMembers((prev) => prev.map((member) => member.name === name ? { ...member, status: member.status === 'Активен' ? 'Ограниченный доступ' : 'Активен' } : member));
    setToast(`Статус доступа обновлён: ${name}`);
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Команда компании</div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
              Рабочая страница multi-user контура: кто в компании за что отвечает, какой у него уровень доступа и где проходит граница между деньгами, исполнением и стратегией.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={sendInvite} style={{ padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
              Пригласить участника
            </button>
            <Link href='/platform-v7/auth' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
              Контур доступа
            </Link>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {IAM_METRICS.map((item) => (
          <div key={item.label} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{item.label}</div>
            <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: '#0F1419' }}>{item.value}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#6B778C', lineHeight: 1.6 }}>{item.note}</div>
          </div>
        ))}
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0F1419' }}>Состав команды</div>
            <div style={{ marginTop: 6, fontSize: 12, color: '#6B778C', lineHeight: 1.6 }}>Живой multi-user слой: фильтры, статусы и быстрые действия по доступам.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['Все', 'Активные', 'Ограниченные'] as const).map((item) => (
              <button key={item} onClick={() => setFilter(item)} style={{ padding: '8px 10px', borderRadius: 999, background: filter === item ? 'rgba(10,122,95,0.08)' : '#F8FAFB', border: filter === item ? '1px solid rgba(10,122,95,0.18)' : '1px solid #E4E6EA', color: filter === item ? '#0A7A5F' : '#475569', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>{item}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {visibleMembers.map((member) => {
            const tone = statusTone(member.status);
            return (
              <section key={member.name} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{member.name}</div>
                    <div style={{ marginTop: 4, fontSize: 13, color: '#6B778C', fontWeight: 700 }}>{member.role}</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: '#6B778C' }}>{member.email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 11, fontWeight: 800 }}>
                      {member.status}
                    </span>
                    <button onClick={() => toggleMemberStatus(member.name)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      Переключить доступ
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}><strong>Контур:</strong> {member.access}</div>
                <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>{member.note}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {member.rights.map((item) => (
                    <span key={item} style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 700 }}>
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0F1419' }}>Приглашения и подключение</div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#6B778C', lineHeight: 1.6 }}>Кто уже приглашён в компанию и на какой стадии подключение в контур.</div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {invites.map((invite) => {
            const tone = statusTone(invite.state);
            return (
              <div key={invite.id} style={{ border: '1px solid #E4E6EA', borderRadius: 14, padding: 14, background: '#F8FAFB', display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 12 }}>{invite.id}</div>
                    <div style={{ marginTop: 4, fontSize: 15, fontWeight: 800, color: '#0F1419' }}>{invite.name}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#6B778C' }}>{invite.role} · {invite.email}</div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 11, fontWeight: 800 }}>
                    {invite.state}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => resendInvite(invite.id)} style={{ padding: '8px 12px', borderRadius: 10, background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Отправить повторно</button>
                  <button onClick={() => revokeInvite(invite.id)} style={{ padding: '8px 12px', borderRadius: 10, background: '#fff', border: '1px solid rgba(220,38,38,0.18)', color: '#B91C1C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Отозвать</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0F1419' }}>Матрица доступов</div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#6B778C', lineHeight: 1.6 }}>Чёткая граница: кто видит деньги, кто — исполнение, а кто — только стратегию и отчёты.</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ textAlign: 'left', background: '#F8FAFB' }}>
                <th style={{ padding: '12px 14px', borderBottom: '1px solid #E4E6EA', fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Контур</th>
                <th style={{ padding: '12px 14px', borderBottom: '1px solid #E4E6EA', fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Директор</th>
                <th style={{ padding: '12px 14px', borderBottom: '1px solid #E4E6EA', fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Оператор</th>
                <th style={{ padding: '12px 14px', borderBottom: '1px solid #E4E6EA', fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Финконтур</th>
                <th style={{ padding: '12px 14px', borderBottom: '1px solid #E4E6EA', fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Логист</th>
              </tr>
            </thead>
            <tbody>
              {ACCESS_MATRIX.map((row) => (
                <tr key={row.scope} style={{ borderTop: '1px solid #E4E6EA' }}>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{row.scope}</td>
                  <Cell ok={row.director} />
                  <Cell ok={row.operator} />
                  <Cell ok={row.finance} />
                  <Cell ok={row.logistics} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {toast ? (
        <div role='status' aria-live='polite' style={{ padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', borderRadius: 12, color: '#0A7A5F', fontSize: 12, fontWeight: 700 }}>
          {toast}
        </div>
      ) : null}

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Почему это важно</div>
        <Bullet text='Одна компания — не один пользователь. В сделке участвуют директор, оператор, бухгалтер и логист.' />
        <Bullet text='Разделение доступов снижает хаос и риск случайных действий не в своей зоне.' />
        <Bullet text='Это усиливает банковый и комплаенс-контур: видно, кто отвечает за деньги, а кто — за исполнение.' />
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/profile' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Профиль компании
        </Link>
        <Link href='/platform-v7/control-tower' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Вернуться в платформу
        </Link>
      </div>
    </div>
  );
}

function Cell({ ok }: { ok: boolean }) {
  return (
    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 800, color: ok ? '#0A7A5F' : '#B91C1C' }}>
      {ok ? 'Да' : 'Нет'}
    </td>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
      <span style={{ fontWeight: 900 }}>•</span>
      <span>{text}</span>
    </div>
  );
}
