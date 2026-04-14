'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

interface RoleConfig {
  id: PlatformRole;
  label: string;
  short: string;
  color: string;
  homeRoute: string;
  description: string;
  permissions: string[];
}

const ROLES: RoleConfig[] = [
  { id: 'operator', label: 'Оператор', short: 'ОП', color: '#0A7A5F', homeRoute: '/platform-v7/control-tower', description: 'Полный доступ к платформе: управление сделками, деньгами, инцидентами', permissions: ['Все сделки', 'Блокировки', 'Деньги', 'Инциденты', 'Аналитика'] },
  { id: 'buyer', label: 'Покупатель', short: 'ПК', color: '#0B6B9A', homeRoute: '/platform-v7/buyer', description: 'Закупки, контроль качества и выпуск денег под свои сделки', permissions: ['Свои закупки', 'Подтверждение качества', 'Выпуск денег', 'Просмотр споров'] },
  { id: 'seller', label: 'Продавец', short: 'ПР', color: '#A16207', homeRoute: '/platform-v7/seller', description: 'Отслеживание выплат, статусов сделок и документооборот', permissions: ['Свои сделки', 'Логистика', 'Статус выплаты', 'Загрузка документов'] },
  { id: 'logistics', label: 'Логист', short: 'ЛГ', color: '#374151', homeRoute: '/platform-v7/logistics', description: 'Диспетчерская по маршрутам, ТС и очередям на элеваторах', permissions: ['Маршруты', 'ТС и водители', 'Очереди', 'ETA'] },
  { id: 'driver', label: 'Водитель', short: 'ВД', color: '#0A7A5F', homeRoute: '/platform-v7r/driver', description: 'Мобильный кабинет для подтверждения рейсов и фиксации прибытия', permissions: ['Мой рейс', 'Подтверждение прибытия', 'Офлайн-события'] },
  { id: 'surveyor', label: 'Сюрвейер', short: 'СЮ', color: '#7C3AED', homeRoute: '/platform-v7r/surveyor', description: 'Подписание актов взвешивания и проверка качества на месте', permissions: ['Акты ВЗФ', 'Фотофиксация', 'Пломбы', 'КЭП подпись'] },
  { id: 'elevator', label: 'Элеватор', short: 'ЭЛ', color: '#B45309', homeRoute: '/platform-v7r/elevator', description: 'Управление очередью, приёмка и подтверждение разгрузки', permissions: ['Очередь машин', 'Форма приёмки', 'СДИЗ/ФГИС', 'Весовая'] },
  { id: 'lab', label: 'Лаборатория', short: 'ЛБ', color: '#BE123C', homeRoute: '/platform-v7r/lab', description: 'Ввод и подписание лабораторных протоколов качества', permissions: ['Пробы', 'Протоколы', 'Допуски ГОСТ', 'Уведомление банка'] },
  { id: 'bank', label: 'Банк', short: 'БН', color: '#0B6B9A', homeRoute: '/platform-v7/bank', description: 'Контроль резервов, выпусков и ручная обработка расхождений', permissions: ['Резервы', 'Выпуск средств', 'Расхождения', 'Эскалации'] },
  { id: 'arbitrator', label: 'Арбитр', short: 'АР', color: '#9333EA', homeRoute: '/platform-v7r/arbitrator', description: 'Комнаты разбора споров, пакеты доказательств и решения', permissions: ['Комнаты разбора', 'Пакет доказательств', 'Решение арбитра', 'Частичный выпуск'] },
  { id: 'compliance', label: 'Комплаенс', short: 'КМ', color: '#475569', homeRoute: '/platform-v7/compliance', description: 'Журнал действий, аудит и выгрузка CSV для проверок', permissions: ['Журнал аудита', 'Фильтрация', 'CSV-выгрузка', 'Все объекты'] },
  { id: 'executive', label: 'Руководитель', short: 'РК', color: '#111827', homeRoute: '/platform-v7r/analytics', description: 'Executive дашборд с графиками оборота, сделок и спорности', permissions: ['Аналитика', 'KPI', 'Топ контрагенты', 'Тренды'] },
];

const GROUPS = [
  { title: 'Сделка и исполнение', ids: ['operator', 'buyer', 'seller', 'logistics'] },
  { title: 'Поле и приёмка', ids: ['driver', 'surveyor', 'elevator', 'lab'] },
  { title: 'Деньги, контроль и разрешение', ids: ['bank', 'arbitrator', 'compliance', 'executive'] },
];

export default function RolesPage() {
  const router = useRouter();
  const { setRole } = usePlatformV7RStore();

  function openCabinet(role: RoleConfig) {
    setRole(role.id);
    router.push(role.homeRoute);
  }

  return (
    <div style={{ display: 'grid', gap: 32 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F1419', margin: 0, borderLeft: '4px solid #0A7A5F', paddingLeft: 14 }}>Все роли платформы</h1>
        <p style={{ fontSize: 13, color: '#6B778C', marginTop: 6, paddingLeft: 18 }}>
          12 ролей охватывают полный цикл исполнения зерновых сделок. Выберите кабинет для переключения.
        </p>
      </div>

      {GROUPS.map(group => {
        const groupRoles = ROLES.filter(r => group.ids.includes(r.id));
        return (
          <div key={group.title}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>{group.title}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {groupRoles.map(role => (
                <div key={role.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 14,
                      background: `${role.color}18`,
                      border: `1px solid ${role.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800, color: role.color, flexShrink: 0,
                    }}>
                      {role.short}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#0F1419' }}>{role.label}</div>
                    </div>
                  </div>

                  <p style={{ fontSize: 12, color: '#6B778C', margin: 0, lineHeight: 1.6 }}>{role.description}</p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {role.permissions.map(perm => (
                      <span key={perm} style={{
                        padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: `${role.color}10`, color: role.color, border: `1px solid ${role.color}20`,
                      }}>{perm}</span>
                    ))}
                  </div>

                  <button
                    onClick={() => openCabinet(role)}
                    style={{
                      padding: '10px 14px', borderRadius: 12, border: 'none',
                      background: role.color, color: '#fff',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 'auto',
                    }}>
                    Открыть кабинет
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
