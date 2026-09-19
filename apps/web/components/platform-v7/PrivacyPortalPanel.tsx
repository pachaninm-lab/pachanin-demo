'use client';

import { useState } from 'react';

type Tab = 'overview' | 'rights' | 'request';

const tabs: Record<Tab, string> = {
  overview: 'Как это устроено',
  rights: 'Права пользователя',
  request: 'Куда обратиться',
};

const rights = [
  ['Доступ к данным', 'Запросить сведения о персональных данных и их обработке.'],
  ['Уточнение данных', 'Сообщить о неточности и запросить исправление в применимых случаях.'],
  ['Ограничение или прекращение обработки', 'Направить требование, если для него есть предусмотренное законом основание.'],
  ['Отзыв согласия', 'Отзыв согласия рассматривается с учётом иных законных оснований обработки и обязанностей по хранению.'],
] as const;

export function PrivacyPortalPanel() {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid #D7E1DB', background: '#F8FBF9' }}>
        <strong style={{ display: 'block', fontSize: 14, color: '#102019' }}>Права субъекта персональных данных</strong>
        <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.6, color: '#526159' }}>
          Этот раздел объясняет доступные действия и не показывает вымышленные персональные записи, согласия, обращения или статусы. Актуальные условия обработки определяются опубликованной политикой конфиденциальности.
        </p>
      </div>

      <div role='tablist' aria-label='Разделы о персональных данных' style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(Object.keys(tabs) as Tab[]).map((key) => (
          <button
            key={key}
            type='button'
            role='tab'
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            style={{
              minHeight: 44,
              padding: '8px 13px',
              borderRadius: 9,
              border: tab === key ? '1px solid #087A3B' : '1px solid #D7E1DB',
              background: tab === key ? '#EDF8F1' : '#fff',
              color: '#102019',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {tabs[key]}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <section role='tabpanel' style={{ display: 'grid', gap: 8 }}>
          {[
            ['Что здесь можно проверить', 'Какие права доступны пользователю и каким способом направить обращение.'],
            ['Чего здесь нет', 'Нет сгенерированных записей о ваших согласиях, вымышленных получателей данных, фиктивных обработчиков или локально созданных «успешных» запросов.'],
            ['Где смотреть юридически значимую информацию', 'В опубликованной политике конфиденциальности и связанных обязательных документах платформы.'],
          ].map(([title, text]) => (
            <article key={title} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #E2E8E4', background: '#fff' }}>
              <strong style={{ fontSize: 12, color: '#102019' }}>{title}</strong>
              <p style={{ margin: '4px 0 0', fontSize: 11.5, lineHeight: 1.55, color: '#526159' }}>{text}</p>
            </article>
          ))}
        </section>
      )}

      {tab === 'rights' && (
        <section role='tabpanel' style={{ display: 'grid', gap: 8 }}>
          {rights.map(([title, text]) => (
            <article key={title} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #E2E8E4', background: '#fff' }}>
              <strong style={{ fontSize: 12, color: '#102019' }}>{title}</strong>
              <p style={{ margin: '4px 0 0', fontSize: 11.5, lineHeight: 1.55, color: '#526159' }}>{text}</p>
            </article>
          ))}
          <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, color: '#64748B' }}>
            Конкретный объём права и порядок ответа зависят от применимого основания обработки и требований законодательства. Эта страница не подменяет текст опубликованной политики.
          </p>
        </section>
      )}

      {tab === 'request' && (
        <section role='tabpanel' style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid #E2E8E4', background: '#fff' }}>
          <strong style={{ display: 'block', fontSize: 13, color: '#102019' }}>Направить реальное обращение</strong>
          <p style={{ margin: '6px 0 12px', fontSize: 11.5, lineHeight: 1.55, color: '#526159' }}>
            Используйте опубликованные контакты платформы. Нажатие на ссылку ниже не создаёт фиктивную заявку и не показывает неподтверждённый статус — обращение считается направленным только после фактической отправки через доступный канал связи.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href='/platform-v7/contact' style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '8px 14px', borderRadius: 9, background: '#087A3B', color: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 800 }}>
              Открыть контакты
            </a>
            <a href='/platform-v7/privacy' style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '8px 14px', borderRadius: 9, border: '1px solid #D7E1DB', color: '#102019', textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>
              Политика конфиденциальности
            </a>
          </div>
        </section>
      )}
    </div>
  );
}
