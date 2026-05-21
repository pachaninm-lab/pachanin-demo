'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

type RoleCard = {
  role: PlatformRole;
  title: string;
  description: string;
  href: string;
  tone: string;
  mark: string;
};

const groups: Array<{ title: string; description: string; cards: RoleCard[] }> = [
  {
    title: 'Сделка и исполнение',
    description: 'Кто запускает, ведёт и закрывает сделку.',
    cards: [
      { role: 'operator', title: 'Оператор', description: 'Центр управления: сделки, блокировки, деньги, сроки, разбор инцидентов.', href: '/platform-v7/control-tower', tone: '#0A7A5F', mark: 'ОП' },
      { role: 'buyer', title: 'Покупатель', description: 'Закупка, отбор предложений, качество партии, выпуск денег после подтверждений.', href: '/platform-v7/buyer', tone: '#0B6B9A', mark: 'ПК' },
      { role: 'seller', title: 'Продавец', description: 'Что загружено, что мешает выплате, сколько денег к получению.', href: '/platform-v7/seller', tone: '#A16207', mark: 'ПР' },
      { role: 'logistics', title: 'Логист', description: 'Рейсы, очередь машин, отклонения маршрута, прибытие, приёмка.', href: '/platform-v7/logistics', tone: '#374151', mark: 'ЛГ' },
    ],
  },
  {
    title: 'Поле и приёмка',
    description: 'Кто подтверждает физическое движение и состояние партии.',
    cards: [
      { role: 'driver', title: 'Водитель', description: 'Маршрут, прибытие, очередь офлайн, подтверждение рейса.', href: '/platform-v7/field', tone: '#0A7A5F', mark: 'ВД' },
      { role: 'surveyor', title: 'Сюрвейер', description: 'Взвешивание, фотофиксация, пломбы, первичное подтверждение факта.', href: '/platform-v7/field', tone: '#7C3AED', mark: 'СЮ' },
      { role: 'elevator', title: 'Элеватор', description: 'Приёмка, разгрузка, очередь, подтверждение допусков и времени.', href: '/platform-v7/field', tone: '#B45309', mark: 'ЭЛ' },
      { role: 'lab', title: 'Лаборатория', description: 'Протокол качества, расхождения, основание для удержания или выпуска.', href: '/platform-v7/field', tone: '#BE123C', mark: 'ЛБ' },
    ],
  },
  {
    title: 'Деньги, контроль и решение',
    description: 'Кто отвечает за выпуск денег, спорность и прозрачность.',
    cards: [
      { role: 'bank', title: 'Банк', description: 'Резерв, удержание, выпуск, ручная проверка расхождений.', href: '/platform-v7/bank', tone: '#0B6B9A', mark: 'БН' },
      { role: 'arbitrator', title: 'Арбитр', description: 'Комната разбора, пакет доказательств, у кого мяч и сколько под удержанием.', href: '/platform-v7/disputes', tone: '#9333EA', mark: 'АР' },
      { role: 'compliance', title: 'Комплаенс', description: 'Журнал действий, выгрузка, фильтры по актору и дате.', href: '/platform-v7/compliance', tone: '#475569', mark: 'КМ' },
      { role: 'executive', title: 'Руководитель', description: 'Короткая сводка: оборот, спорность, скорость закрытия, деньги в контуре.', href: '/platform-v7/analytics', tone: '#111827', mark: 'РК' },
    ],
  },
];

export function RoleEntry() {
  const router = useRouter();
  const { setRole } = usePlatformV7RStore();

  return (
    <div style={{ minHeight: 'calc(100dvh - 72px)', padding: '24px 16px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 1240, display: 'grid', gap: 18 }}>
        <div style={{ background: 'linear-gradient(180deg, rgba(10,122,95,0.08) 0%, rgba(255,255,255,0.96) 100%)', border: '1px solid rgba(10,122,95,0.14)', borderRadius: 20, padding: '22px 22px 18px', boxShadow: '0 10px 30px rgba(15,20,25,0.05)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0A7A5F' }}>Прозрачная Цена</div>
          <h1 style={{ margin: '10px 0 8px', fontSize: 32, lineHeight: 1.15, color: '#0F1419' }}>Выбор рабочего кабинета</h1>
          <p style={{ margin: 0, maxWidth: 760, color: '#556070', fontSize: 14, lineHeight: 1.65 }}>Вход начинается с роли. У каждого кабинета свой первый экран, свои действия, своя логика денег, документов, приёмки и споров.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
            <Link href="/platform-v7/control-tower" style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #DCE3E8', background: '#FFFFFF', color: '#0F1419', fontWeight: 700, fontSize: 13 }}>Открыть центр управления</Link>
            <Link href="/platform-v7/deals" style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #DCE3E8', background: '#FFFFFF', color: '#0F1419', fontWeight: 700, fontSize: 13 }}>Все сделки</Link>
          </div>
        </div>

        {groups.map((group) => (
          <section key={group.title} style={{ background: '#FFFFFF', border: '1px solid #E4E6EA', borderRadius: 20, padding: 18, boxShadow: '0 8px 26px rgba(9,30,66,0.04)' }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0F1419' }}>{group.title}</div>
              <div style={{ fontSize: 13, color: '#6B778C', marginTop: 4 }}>{group.description}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {group.cards.map((card) => (
                <button key={card.role} onClick={() => { setRole(card.role); router.push(card.href); }} style={{ textAlign: 'left', background: '#FCFDFD', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, cursor: 'pointer', display: 'grid', gap: 14, boxShadow: '0 6px 18px rgba(9,30,66,0.03)' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: `${card.tone}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.tone, fontSize: 14, fontWeight: 800 }}>{card.mark}</div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{card.title}</div>
                    <div style={{ fontSize: 13, color: '#6B778C', marginTop: 7, lineHeight: 1.6 }}>{card.description}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: card.tone, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Перейти в кабинет</div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
