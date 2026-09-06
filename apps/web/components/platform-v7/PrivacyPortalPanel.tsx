'use client';

import { useState, type KeyboardEvent } from 'react';

type Locale = 'ru' | 'en' | 'zh';
type Tab = 'overview' | 'rights' | 'request';

type Copy = Readonly<{
  title: string;
  intro: string;
  tabs: Record<Tab, string>;
  tablist: string;
  overview: readonly (readonly [string, string])[];
  rights: readonly (readonly [string, string])[];
  rightsNote: string;
  requestTitle: string;
  requestText: string;
  contacts: string;
  privacy: string;
}>;

const TAB_KEYS: readonly Tab[] = ['overview', 'rights', 'request'];

const COPY: Record<Locale, Copy> = {
  ru: {
    title: 'Права субъекта персональных данных',
    intro: 'Раздел объясняет доступные действия и не создаёт вымышленные персональные записи, согласия или обращения. Актуальные условия обработки определяются опубликованной политикой конфиденциальности.',
    tabs: { overview: 'Как это устроено', rights: 'Права пользователя', request: 'Куда обратиться' },
    tablist: 'Разделы о персональных данных',
    overview: [
      ['Что здесь можно проверить', 'Какие права доступны пользователю и каким способом направить обращение.'],
      ['Чего здесь нет', 'Нет сгенерированных записей о ваших согласиях, вымышленных получателей данных, фиктивных обработчиков или локально созданных «успешных» запросов.'],
      ['Где смотреть юридически значимую информацию', 'В опубликованной политике конфиденциальности и связанных обязательных документах платформы.'],
    ],
    rights: [
      ['Доступ к данным', 'Запросить сведения о персональных данных и их обработке.'],
      ['Уточнение данных', 'Сообщить о неточности и запросить исправление в применимых случаях.'],
      ['Ограничение или прекращение обработки', 'Направить требование, если для него есть предусмотренное законом основание.'],
      ['Отзыв согласия', 'Отзыв согласия рассматривается с учётом иных законных оснований обработки и обязанностей по хранению.'],
    ],
    rightsNote: 'Конкретный объём права и порядок ответа зависят от применимого основания обработки и требований законодательства. Эта страница не подменяет текст опубликованной политики.',
    requestTitle: 'Направить реальное обращение',
    requestText: 'Используйте официальный канал платформы. Ссылка ниже только открывает форму: обращение считается направленным после фактической отправки пользователем.',
    contacts: 'Открыть контакты',
    privacy: 'Политика конфиденциальности',
  },
  en: {
    title: 'Data-subject rights',
    intro: 'This section explains available actions and does not create fictional personal records, consents or requests. Current processing terms are defined by the published privacy policy.',
    tabs: { overview: 'How it works', rights: 'Your rights', request: 'Make a request' },
    tablist: 'Personal-data sections',
    overview: [
      ['What you can check here', 'Which rights are available and how a request can be submitted.'],
      ['What is not created here', 'There are no generated consent records, invented recipients, fictitious processors or locally fabricated successful requests.'],
      ['Where legally significant information lives', 'In the published privacy policy and the platform documents that apply to the relevant processing.'],
    ],
    rights: [
      ['Access to data', 'Request information about personal data and its processing.'],
      ['Data correction', 'Report an inaccuracy and request correction where applicable.'],
      ['Restriction or termination of processing', 'Submit a request where an applicable legal basis exists.'],
      ['Withdrawal of consent', 'Withdrawal is considered together with other lawful processing grounds and applicable retention obligations.'],
    ],
    rightsNote: 'The exact scope of a right and the response procedure depend on the applicable processing basis and legal requirements. This page does not replace the published policy.',
    requestTitle: 'Submit a real inquiry',
    requestText: 'Use the platform’s official contact channel. The link below only opens the form; a request is submitted only after the user actually sends it.',
    contacts: 'Open contact form',
    privacy: 'Privacy policy',
  },
  zh: {
    title: '数据主体权利',
    intro: '本区域说明可用操作，不会创建虚构的个人记录、同意记录或请求。实际数据处理条件以已发布的隐私政策为准。',
    tabs: { overview: '如何运作', rights: '你的权利', request: '提交请求' },
    tablist: '个人数据相关页面',
    overview: [
      ['这里可以确认什么', '可以了解哪些权利以及如何提交请求。'],
      ['这里不会创建什么', '不会生成同意记录、虚构数据接收方、虚假处理方或本地伪造的成功请求。'],
      ['哪里查看具有法律意义的信息', '请查看已发布的隐私政策及适用于相关数据处理的平台文件。'],
    ],
    rights: [
      ['访问数据', '请求了解个人数据及其处理情况。'],
      ['更正数据', '在适用情况下报告不准确内容并请求更正。'],
      ['限制或终止处理', '在存在适用法律依据时提交相应请求。'],
      ['撤回同意', '撤回同意时，还需考虑其他合法处理依据和适用的保存义务。'],
    ],
    rightsNote: '具体权利范围和回复程序取决于适用的数据处理依据和法律要求。本页不替代已发布的隐私政策。',
    requestTitle: '提交真实请求',
    requestText: '请使用平台官方联系渠道。下方链接仅用于打开表单；只有用户实际提交后，请求才被发送。',
    contacts: '打开联系表单',
    privacy: '隐私政策',
  },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export function PrivacyPortalPanel({ locale = 'ru' }: { locale?: string }) {
  const normalizedLocale = localeOf(locale);
  const copy = COPY[normalizedLocale];
  const [tab, setTab] = useState<Tab>('overview');
  const suffix = `?lang=${normalizedLocale}`;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, key: Tab) => {
    const current = TAB_KEYS.indexOf(key);
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % TAB_KEYS.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + TAB_KEYS.length) % TAB_KEYS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TAB_KEYS.length - 1;
    else return;

    event.preventDefault();
    const nextTab = TAB_KEYS[next]!;
    setTab(nextTab);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  const cards = tab === 'overview' ? copy.overview : copy.rights;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid #D7E1DB', background: '#F8FBF9' }}>
        <strong style={{ display: 'block', fontSize: 14, color: '#102019' }}>{copy.title}</strong>
        <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.6, color: '#526159' }}>{copy.intro}</p>
      </div>

      <div role='tablist' aria-label={copy.tablist} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            id={`privacy-tab-${key}`}
            type='button'
            role='tab'
            aria-selected={tab === key}
            aria-controls={`privacy-panel-${key}`}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
            onKeyDown={(event) => handleKeyDown(event, key)}
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
            {copy.tabs[key]}
          </button>
        ))}
      </div>

      {tab !== 'request' ? (
        <section id={`privacy-panel-${tab}`} role='tabpanel' aria-labelledby={`privacy-tab-${tab}`} style={{ display: 'grid', gap: 8 }}>
          {cards.map(([title, text]) => (
            <article key={title} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #E2E8E4', background: '#fff' }}>
              <strong style={{ fontSize: 12, color: '#102019' }}>{title}</strong>
              <p style={{ margin: '4px 0 0', fontSize: 11.5, lineHeight: 1.55, color: '#526159' }}>{text}</p>
            </article>
          ))}
          {tab === 'rights' ? <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, color: '#64748B' }}>{copy.rightsNote}</p> : null}
        </section>
      ) : (
        <section id='privacy-panel-request' role='tabpanel' aria-labelledby='privacy-tab-request' style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid #E2E8E4', background: '#fff' }}>
          <strong style={{ display: 'block', fontSize: 13, color: '#102019' }}>{copy.requestTitle}</strong>
          <p style={{ margin: '6px 0 12px', fontSize: 11.5, lineHeight: 1.55, color: '#526159' }}>{copy.requestText}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={`/platform-v7/contact${suffix}`} style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '8px 14px', borderRadius: 9, background: '#087A3B', color: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 800 }}>
              {copy.contacts}
            </a>
            <a href={`/platform-v7/privacy${suffix}`} style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '8px 14px', borderRadius: 9, border: '1px solid #D7E1DB', color: '#102019', textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>
              {copy.privacy}
            </a>
          </div>
        </section>
      )}
    </div>
  );
}
