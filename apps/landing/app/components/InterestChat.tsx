'use client';

import { FormEvent, useMemo, useState } from 'react';
import styles from './InterestChat.module.css';

type StepKey = 'role' | 'pain' | 'urgency' | 'readiness' | 'dealSize';
type SubmitState = 'idle' | 'loading' | 'success' | 'fallback';
type Answers = Record<StepKey, string>;

const steps: Array<{ key: StepKey; question: string; options: string[] }> = [
  { key: 'role', question: 'Кто вы в зерновой сделке?', options: ['Продавец / КФХ', 'Покупатель', 'Элеватор', 'Логистика', 'Банк', 'Регион / инвестор'] },
  { key: 'pain', question: 'Где чаще всего теряются деньги?', options: ['Оплата / удержание', 'Качество', 'Вес', 'Документы', 'Рейс', 'Спор'] },
  { key: 'urgency', question: 'Насколько проблема срочная?', options: ['Болит сейчас', 'Есть риск в сделках', 'Интересно на будущее'] },
  { key: 'readiness', question: 'Что готовы проверить?', options: ['Одну реальную сделку', 'Демо-разбор', 'Пилот с партнёром', 'Пока только посмотреть'] },
  { key: 'dealSize', question: 'Какой масштаб сделки ближе?', options: ['до 100 т', '100–500 т', '500–2 000 т', '2 000+ т', 'банк / региональный контур'] },
];

const emptyAnswers: Answers = { role: '', pain: '', urgency: '', readiness: '', dealSize: '' };

function getInterestLevel(answers: Answers) {
  let score = 0;
  if (answers.urgency === 'Болит сейчас') score += 3;
  if (answers.urgency === 'Есть риск в сделках') score += 2;
  if (answers.readiness === 'Одну реальную сделку') score += 3;
  if (answers.readiness === 'Пилот с партнёром') score += 3;
  if (answers.dealSize === '500–2 000 т' || answers.dealSize === '2 000+ т' || answers.dealSize === 'банк / региональный контур') score += 2;
  if (answers.pain === 'Оплата / удержание' || answers.pain === 'Документы' || answers.pain === 'Спор') score += 1;

  if (score >= 7) return { label: 'горячий интерес', summary: 'быстро разобрать одну сделку и искать пилотный сценарий' };
  if (score >= 4) return { label: 'тёплый интерес', summary: 'есть прикладная боль, нужен короткий разбор без тяжёлого внедрения' };
  return { label: 'исследовательский интерес', summary: 'нужен понятный пример и проверка пользы без обязательств' };
}

export default function InterestChat() {
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const [contact, setContact] = useState({ name: '', phone: '', note: '' });
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [message, setMessage] = useState('');

  const completed = steps.filter((step) => answers[step.key]).length;
  const progress = Math.round((completed / steps.length) * 100);
  const interest = useMemo(() => getInterestLevel(answers), [answers]);
  const isComplete = completed === steps.length;

  function selectAnswer(key: StepKey, value: string) {
    setAnswers((current) => ({ ...current, [key]: value }));
    setSubmitState('idle');
    setMessage('');
  }

  function buildSummary() {
    return [
      `Роль: ${answers.role || '—'}`,
      `Главная боль: ${answers.pain || '—'}`,
      `Срочность: ${answers.urgency || '—'}`,
      `Готовность: ${answers.readiness || '—'}`,
      `Масштаб: ${answers.dealSize || '—'}`,
      `Интерес: ${interest.label}`,
      contact.note ? `Комментарий: ${contact.note}` : '',
    ].filter(Boolean).join('\n');
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isComplete || !contact.phone.trim()) return;

    setSubmitState('loading');
    setMessage('');

    const payload = {
      name: contact.name || 'Не указано',
      phone: contact.phone,
      role: answers.role,
      risk: answers.pain,
      urgency: answers.urgency,
      readiness: answers.readiness,
      dealSize: answers.dealSize,
      deal: buildSummary(),
      source: 'landing_interest_chat',
      intent: 'Проверить интерес к использованию платформы',
      interestLevel: interest.label,
      interestSummary: interest.summary,
      company: 'Не указано',
      email: '',
      scenario: 'Чат проверки интереса',
      timeline: answers.urgency,
    };

    try {
      const response = await fetch('/api/pilot-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result?.accepted === true) {
        setSubmitState('success');
        setMessage('Сигнал интереса принят. Следующий шаг — короткий разбор одной сделки и проверка пользы.');
        return;
      }
      setSubmitState('fallback');
      setMessage('Сводка собрана. Отправьте её напрямую на почту или оставьте заявку ниже.');
    } catch {
      setSubmitState('fallback');
      setMessage('Сводка собрана. Отправьте её напрямую на почту или оставьте заявку ниже.');
    }
  }

  const mailtoHref = `mailto:pachaninm@gmail.com?subject=${encodeURIComponent('Интерес к Прозрачной Цене')}&body=${encodeURIComponent(buildSummary())}`;

  return (
    <section id="interest" className={styles.section}>
      <div className={styles.shell}>
        <div className={styles.copy}>
          <span className={styles.badge}>проверка интереса</span>
          <h2>Ответьте как в чате. Получим честный сигнал спроса.</h2>
          <p>Пять коротких вопросов показывают, кто готов смотреть платформу, где реальная боль и какой пилот имеет смысл.</p>
          <div className={styles.metrics}>
            <div><strong>{progress}%</strong><span>готовность анкеты</span></div>
            <div><strong>{interest.label}</strong><span>{interest.summary}</span></div>
          </div>
        </div>

        <div className={styles.chatCard}>
          <div className={styles.chatTop}>
            <div><span>мини-чат</span><strong>Интерес к платформе</strong></div>
            <em>{completed}/{steps.length}</em>
          </div>

          <div className={styles.thread}>
            {steps.map((step, index) => (
              <div key={step.key} className={styles.messageBlock}>
                <div className={styles.bot}><span>{index + 1}</span><p>{step.question}</p></div>
                <div className={styles.options}>
                  {step.options.map((option) => (
                    <button key={option} type="button" className={answers[step.key] === option ? styles.activeOption : styles.option} onClick={() => selectAnswer(step.key, option)}>{option}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={onSubmit} className={styles.form}>
            <div className={styles.formGrid}>
              <label>Имя<input value={contact.name} onChange={(event) => setContact((current) => ({ ...current, name: event.target.value }))} placeholder="Как обращаться" /></label>
              <label>Телефон<input value={contact.phone} onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))} placeholder="+7..." required inputMode="tel" /></label>
            </div>
            <label>Комментарий<textarea value={contact.note} onChange={(event) => setContact((current) => ({ ...current, note: event.target.value }))} placeholder="Например: есть спор по качеству, нужна карта сделки" rows={3} /></label>
            <button type="submit" disabled={!isComplete || !contact.phone.trim() || submitState === 'loading'}>{submitState === 'loading' ? 'Отправляем...' : 'Отправить сигнал интереса'}</button>
            {message ? <p className={submitState === 'success' ? styles.ok : styles.warn}>{message}</p> : null}
            <a className={styles.mailLink} href={mailtoHref}>Отправить сводку на почту</a>
          </form>
        </div>
      </div>
    </section>
  );
}
