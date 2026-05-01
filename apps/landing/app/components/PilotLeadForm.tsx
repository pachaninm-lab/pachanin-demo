"use client";

import { FormEvent, useState } from 'react';
import styles from './PilotLeadForm.module.css';

type SubmitState = 'idle' | 'loading' | 'success' | 'fallback' | 'error';

export default function PilotLeadForm() {
  const [state, setState] = useState<SubmitState>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    setState('loading');
    setMessage('');

    try {
      const response = await fetch('/api/pilot-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          source: 'landing_10_quick_lead',
          intent: 'Получить карту потерь сделки за 48 часов',
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result?.sent === true) {
        setState('success');
        setMessage('Заявка отправлена. Следующий шаг — показать, где в сделке деньги, блокеры и риск.');
        form.reset();
        return;
      }
      setState('fallback');
      setMessage('Заявка собрана, но почтовый провайдер ещё не настроен в Vercel. Напишите напрямую на почту или позвоните по номеру ниже.');
    } catch {
      setState('fallback');
      setMessage('Связь с формой не прошла. Напишите напрямую на почту или позвоните по номеру ниже.');
    }
  }

  return (
    <div className={styles.shell} id="lead-form">
      <div className={styles.inner}>
        <div className={styles.head}>
          <div>
            <span className={styles.badge}>быстрая заявка</span>
            <h3 className={styles.title}>Заполните 4 поля. Остальное уточним сами.</h3>
          </div>
          <div className={styles.note}>Нужна одна реальная сделка: где груз, документы, оплата или спор.</div>
        </div>

        <form onSubmit={onSubmit} className={styles.form}>
          <input type="text" name="website" hidden tabIndex={-1} autoComplete="off" />
          <div className={styles.grid}>
            <label className={styles.label}>Имя<input className={styles.field} name="name" required placeholder="Как к вам обращаться" /></label>
            <label className={styles.label}>Телефон<input className={styles.field} name="phone" required inputMode="tel" autoComplete="tel" placeholder="+7..." /></label>
          </div>
          <div className={styles.grid}>
            <label className={styles.label}>Кто вы в сделке<select className={styles.field} name="role" required defaultValue=""><option value="" disabled>Выберите роль</option><option>Продавец / КФХ</option><option>Покупатель зерна</option><option>Элеватор / приёмка</option><option>Логистика / перевозчик</option><option>Банк / финансирование</option><option>Регион / институт развития</option><option>Другое</option></select></label>
            <label className={styles.label}>Что болит<select className={styles.field} name="risk" required defaultValue=""><option value="" disabled>Выберите проблему</option><option>Оплата / удержание</option><option>Качество / лаборатория</option><option>Вес / недовес</option><option>ЭДО / ЭПД / МЧД</option><option>СДИЗ / ФГИС Зерно</option><option>Рейс / водитель / маршрут</option><option>Сбер-контур / банк</option><option>Спор / доказательства</option></select></label>
          </div>
          <label className={styles.label}>Коротко о сделке<textarea className={`${styles.field} ${styles.textarea}`} name="deal" required rows={4} placeholder="Например: пшеница, 240 т, Тамбов — покупатель удержал оплату из-за качества и документов" /></label>
          <input type="hidden" name="company" value="Не указано на первом шаге" />
          <input type="hidden" name="email" value="" />
          <input type="hidden" name="scenario" value="Карта потерь за 48 часов" />
          <input type="hidden" name="timeline" value="быстрый разбор" />
          <button type="submit" disabled={state === 'loading' || state === 'success'} className={styles.button}>{state === 'loading' ? 'Отправляем...' : state === 'success' ? 'Заявка отправлена' : 'Показать, где зависают деньги'}</button>
          {message ? <p className={`${styles.message} ${state === 'success' ? styles.ok : styles.warn}`}>{message}</p> : null}
        </form>
        <div className={styles.contacts}>
          <a href="mailto:pachaninm@gmail.com">pachaninm@gmail.com</a>
          <a href="tel:+79162778989">+7 916 277-89-89</a>
        </div>
      </div>
    </div>
  );
}
