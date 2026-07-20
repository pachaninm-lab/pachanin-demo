'use client';

import * as React from 'react';
import { PublicExperienceIcon } from './PublicExperienceIcon';
import styles from './PublicAiInActionSimpleExperience.module.css';

type Locale = 'ru' | 'en' | 'zh';
type ScenarioKey = 'documents' | 'quality' | 'delivery';

type Scenario = {
  tab: string;
  problem: string;
  why: string;
  risk: string;
  time: string;
  money: string;
  action: string;
  proof: string;
};

const COPY = {
  ru: {
    heroEyebrow: 'Просто о работе ИИ',
    heroTitle: 'ИИ замечает проблему и показывает, что делать дальше',
    heroLead: 'Он проверяет документы, сроки и события сделки. Потом простыми словами объясняет: что случилось, почему это важно и кто должен действовать.',
    heroSignal: 'Нет лабораторного протокола · осталось 6 часов · 6,9 млн ₽ могут задержаться',
    start: 'Показать на примере',
    safety: 'Что ИИ не может делать',
    howEyebrow: 'Как это работает',
    howTitle: 'Всего три шага',
    steps: [
      ['1', 'Смотрит', 'Берёт только те данные, которые вам разрешено видеть.'],
      ['2', 'Объясняет', 'Находит проблему и показывает её причину простыми словами.'],
      ['3', 'Предлагает', 'Готовит следующий шаг, но ничего не отправляет без человека.'],
    ],
    exampleEyebrow: 'Живой пример',
    exampleTitle: 'Выберите ситуацию',
    exampleLead: 'Нажмите на карточку. ИИ сразу покажет проблему, риск и понятное действие.',
    labels: {
      problem: 'Что случилось',
      why: 'Почему это важно',
      risk: 'Что может произойти',
      time: 'Сколько времени осталось',
      money: 'Сколько денег под риском',
      action: 'Что делать сейчас',
      proof: 'На чём основан вывод',
    },
    scenarios: {
      documents: {
        tab: 'Нет документа',
        problem: 'Лабораторный протокол не прикреплён к сделке.',
        why: 'Без него нельзя подтвердить качество товара.',
        risk: 'Оплата может задержаться, а следующая отгрузка — сдвинуться.',
        time: '6 часов',
        money: '6,9 млн ₽',
        action: 'Запросить протокол у лаборатории и прикрепить его к сделке.',
        proof: 'Карточка сделки, акт приёмки и реестр документов.',
      },
      quality: {
        tab: 'Проблема с качеством',
        problem: 'В протоколе указано 11,2% белка вместо нужных 12,0%.',
        why: 'Товар не совпадает с согласованными условиями.',
        risk: 'Стороны могут спорить о цене, качестве или приёмке партии.',
        time: 'до 14:30',
        money: '1,8 млн ₽',
        action: 'Проверить протокол и при необходимости запросить повторную пробу.',
        proof: 'Условия сделки, акт отбора пробы и лабораторный протокол.',
      },
      delivery: {
        tab: 'Машина опаздывает',
        problem: 'Машина приедет примерно на 4 часа позже.',
        why: 'Она может не попасть в согласованное время приёмки.',
        risk: 'Возникнут простой, перенос приёмки и дополнительные расходы.',
        time: 'до 17:00',
        money: '82 тыс. ₽',
        action: 'Согласовать новое время с водителем, логистом и элеватором.',
        proof: 'Карточка рейса, маршрут и событие движения машины.',
      },
    } satisfies Record<ScenarioKey, Scenario>,
    boundariesEyebrow: 'Три простых правила',
    boundariesTitle: 'ИИ помогает, но не командует',
    boundariesLead: 'Он работает как внимательный помощник: замечает, объясняет и предлагает. Решение всегда остаётся за человеком.',
    boundaries: [
      ['Только ваши данные', 'ИИ не показывает чужие сделки и документы.', 'people'],
      ['Ничего не меняет сам', 'Он не отправляет запросы, не переводит деньги и не меняет сделку без подтверждения.', 'shield'],
      ['Всегда показывает причину', 'Можно увидеть документ или событие, на котором основан вывод.', 'documents'],
    ] as const,
    finalEyebrow: 'Главная мысль',
    finalTitle: 'ИИ помогает не пропустить важное',
    finalLead: 'Он заранее замечает проблему, объясняет её простыми словами и подсказывает следующий шаг. Человек проверяет и принимает решение.',
    replay: 'Посмотреть пример ещё раз',
    login: 'Войти в платформу',
  },
  en: {
    heroEyebrow: 'AI, explained simply',
    heroTitle: 'AI spots a problem and shows what to do next',
    heroLead: 'It checks documents, deadlines, and deal events. Then it explains what happened, why it matters, and who should act.',
    heroSignal: 'Lab report missing · 6 hours left · ₽6.9m may be delayed',
    start: 'See an example',
    safety: 'What AI cannot do',
    howEyebrow: 'How it works',
    howTitle: 'Only three steps',
    steps: [['1', 'Looks', 'Uses only information you are allowed to see.'], ['2', 'Explains', 'Finds the problem and explains the reason clearly.'], ['3', 'Suggests', 'Prepares the next step but never sends it without a person.']],
    exampleEyebrow: 'Live example',
    exampleTitle: 'Choose a situation',
    exampleLead: 'Select a card. AI will show the problem, the risk, and a clear action.',
    labels: { problem: 'What happened', why: 'Why it matters', risk: 'What may happen', time: 'Time left', money: 'Money at risk', action: 'What to do now', proof: 'What the answer is based on' },
    scenarios: {
      documents: { tab: 'Missing document', problem: 'The lab report is not attached to the deal.', why: 'Without it, product quality cannot be confirmed.', risk: 'Payment may be delayed and the next shipment may move.', time: '6 hours', money: '₽6.9m', action: 'Request the report from the laboratory and attach it to the deal.', proof: 'Deal card, acceptance act, and document registry.' },
      quality: { tab: 'Quality problem', problem: 'The report shows 11.2% protein instead of the required 12.0%.', why: 'The product does not match the agreed terms.', risk: 'The parties may dispute price, quality, or acceptance.', time: 'until 14:30', money: '₽1.8m', action: 'Check the report and request a repeat sample if needed.', proof: 'Deal terms, sampling act, and laboratory report.' },
      delivery: { tab: 'Truck is late', problem: 'The truck is expected about four hours late.', why: 'It may miss the agreed acceptance window.', risk: 'Waiting time, rescheduling, and extra costs may follow.', time: 'until 17:00', money: '₽82k', action: 'Agree a new time with the driver, logistics team, and elevator.', proof: 'Trip card, route, and vehicle movement event.' },
    } satisfies Record<ScenarioKey, Scenario>,
    boundariesEyebrow: 'Three simple rules', boundariesTitle: 'AI helps, but does not command', boundariesLead: 'It acts like an attentive assistant: it notices, explains, and suggests. A person always decides.',
    boundaries: [['Only your data', 'AI does not show other people’s deals or documents.', 'people'], ['No changes by itself', 'It does not send requests, move money, or change a deal without confirmation.', 'shield'], ['Always shows the reason', 'You can see the document or event behind every conclusion.', 'documents']] as const,
    finalEyebrow: 'The main idea', finalTitle: 'AI helps you not miss what matters', finalLead: 'It spots a problem early, explains it clearly, and suggests the next step. A person checks and decides.', replay: 'See the example again', login: 'Sign in',
  },
  zh: {
    heroEyebrow: '用简单的话介绍 AI', heroTitle: 'AI 发现问题，并告诉你下一步该做什么', heroLead: '它检查文件、时间和交易事件，然后说明发生了什么、为什么重要、谁需要处理。', heroSignal: '缺少实验室报告 · 剩余 6 小时 · 690 万卢布可能延迟', start: '查看示例', safety: 'AI 不能做什么',
    howEyebrow: '工作方式', howTitle: '只有三步', steps: [['1', '查看', '只使用你有权查看的数据。'], ['2', '解释', '找到问题并用简单的话说明原因。'], ['3', '建议', '准备下一步，但没有人的确认不会发送。']],
    exampleEyebrow: '实时示例', exampleTitle: '选择一种情况', exampleLead: '点击卡片，AI 会显示问题、风险和清晰的处理方法。',
    labels: { problem: '发生了什么', why: '为什么重要', risk: '可能发生什么', time: '剩余时间', money: '风险金额', action: '现在该做什么', proof: '结论依据' },
    scenarios: {
      documents: { tab: '缺少文件', problem: '实验室报告没有附在交易中。', why: '没有报告就无法确认货物质量。', risk: '付款可能延迟，下一次发货也可能推迟。', time: '6 小时', money: '690 万卢布', action: '向实验室索要报告并附到交易中。', proof: '交易卡、验收单和文件登记。' },
      quality: { tab: '质量问题', problem: '报告显示蛋白质 11.2%，低于要求的 12.0%。', why: '货物不符合双方约定。', risk: '双方可能就价格、质量或验收发生争议。', time: '14:30 前', money: '180 万卢布', action: '检查报告，必要时申请重新取样。', proof: '交易条件、取样单和实验室报告。' },
      delivery: { tab: '车辆晚点', problem: '车辆预计晚到约 4 小时。', why: '它可能错过约定的验收时间。', risk: '可能产生等待、改期和额外费用。', time: '17:00 前', money: '8.2 万卢布', action: '与司机、物流和粮库确认新的时间。', proof: '运输卡、路线和车辆移动事件。' },
    } satisfies Record<ScenarioKey, Scenario>,
    boundariesEyebrow: '三个简单规则', boundariesTitle: 'AI 会帮助，但不会替你做决定', boundariesLead: '它像一个细心的助手：发现、解释、建议。最终决定始终由人作出。', boundaries: [['只看你的数据', 'AI 不会显示别人的交易和文件。', 'people'], ['不会自己修改', '没有确认，它不会发送请求、转账或修改交易。', 'shield'], ['始终说明原因', '你可以查看每个结论所依据的文件或事件。', 'documents']] as const,
    finalEyebrow: '最重要的一点', finalTitle: 'AI 帮你不错过重要问题', finalLead: '它提前发现问题，用简单的话解释，并建议下一步。人来检查并作出决定。', replay: '再看一次示例', login: '进入平台',
  },
} as const;

export function PublicAiInActionSimpleExperience({ locale }: { locale: string }) {
  const localeKey: Locale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const copy = COPY[localeKey];
  const [scenarioKey, setScenarioKey] = React.useState<ScenarioKey>('documents');
  const scenario = copy.scenarios[scenarioKey];

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.shell}>
          <span className={styles.eyebrow}>{copy.heroEyebrow}</span>
          <h1>{copy.heroTitle}</h1>
          <p className={styles.lead}>{copy.heroLead}</p>
          <div className={styles.signal}><PublicExperienceIcon name='risk' /><strong>{copy.heroSignal}</strong></div>
          <div className={styles.actions}>
            <a href='#scenario' className={styles.primary}>{copy.start}</a>
            <a href='#boundaries' className={styles.secondary}>{copy.safety}</a>
          </div>
        </div>
      </section>

      <section className={styles.how} aria-labelledby='pc-ai-simple-how'>
        <div className={styles.shell}>
          <span className={styles.eyebrow}>{copy.howEyebrow}</span>
          <h2 id='pc-ai-simple-how'>{copy.howTitle}</h2>
          <div className={styles.steps}>
            {copy.steps.map(([number, title, body]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}
          </div>
        </div>
      </section>

      <section id='scenario' className={styles.example} aria-labelledby='pc-ai-demo-title'>
        <div className={styles.shell}>
          <span className={styles.eyebrow}>{copy.exampleEyebrow}</span>
          <h2 id='pc-ai-demo-title'>{copy.exampleTitle}</h2>
          <p className={styles.sectionLead}>{copy.exampleLead}</p>
          <div className={styles.tabs} role='tablist'>
            {(Object.keys(copy.scenarios) as ScenarioKey[]).map((key) => <button key={key} type='button' role='tab' aria-selected={scenarioKey === key} onClick={() => setScenarioKey(key)}>{copy.scenarios[key].tab}</button>)}
          </div>
          <div className={styles.result} id='result'>
            <div className={styles.problem}><span>{copy.labels.problem}</span><h3>{scenario.problem}</h3></div>
            <div className={styles.grid}>
              <article><span>{copy.labels.why}</span><p>{scenario.why}</p></article>
              <article><span>{copy.labels.risk}</span><p>{scenario.risk}</p></article>
              <article><span>{copy.labels.time}</span><strong>{scenario.time}</strong></article>
              <article><span>{copy.labels.money}</span><strong>{scenario.money}</strong></article>
            </div>
            <div className={styles.next}><span>{copy.labels.action}</span><strong>{scenario.action}</strong></div>
            <details className={styles.proof}><summary>{copy.labels.proof}</summary><p>{scenario.proof}</p></details>
          </div>
        </div>
      </section>

      <section id='boundaries' className={styles.boundaries} aria-labelledby='pc-ai-simple-boundaries'>
        <div className={styles.shell}>
          <span className={styles.eyebrow}>{copy.boundariesEyebrow}</span>
          <h2 id='pc-ai-simple-boundaries'>{copy.boundariesTitle}</h2>
          <p className={styles.sectionLead}>{copy.boundariesLead}</p>
          <div className={styles.boundaryGrid}>{copy.boundaries.map(([title, body, icon]) => <article key={title}><PublicExperienceIcon name={icon} /><div><h3>{title}</h3><p>{body}</p></div></article>)}</div>
        </div>
      </section>

      <section className={styles.final}>
        <div className={styles.finalPanel}>
          <span className={styles.eyebrow}>{copy.finalEyebrow}</span>
          <h2>{copy.finalTitle}</h2>
          <p>{copy.finalLead}</p>
          <div className={styles.actions}><a href='#scenario' className={styles.primary}>{copy.replay}</a><a href='/platform-v7/login' className={styles.secondary}>{copy.login}</a></div>
        </div>
      </section>
    </div>
  );
}
