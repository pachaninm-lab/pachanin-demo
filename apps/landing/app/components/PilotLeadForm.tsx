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
          source: 'landing_sber_ai_mcx',
          intent: 'Получить карту потерь сделки',
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result?.sent === true) {
        setState('success');
        setMessage('Заявка отправлена на pachaninm@gmail.com. Следующий шаг — карта потерь и сценарий pilot-разбора одной сделки.');
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
            <span className={styles.badge}>карта потерь сделки</span>
            <h3 className={styles.title}>Опишите одну сделку — покажем, где могут зависнуть деньги.</h3>
          </div>
          <div className={styles.note}>Фокус: рейс, вес, качество, Сбер-контур, документы, AI-риски, оплата, спор.</div>
        </div>

        <form onSubmit={onSubmit} className={styles.form}>
          <input type="text" name="website" hidden tabIndex={-1} autoComplete="off" />
          <div className={styles.grid}>
            <label className={styles.label}>Имя<input className={styles.field} name="name" required placeholder="Как к вам обращаться" /></label>
            <label className={styles.label}>Компания / хозяйство<input className={styles.field} name="company" required placeholder="КФХ, элеватор, покупатель" /></label>
          </div>
          <div className={styles.grid}>
            <label className={styles.label}>Роль в сделке<select className={styles.field} name="role" required defaultValue=""><option value="" disabled>Выберите роль</option><option>Продавец / КФХ</option><option>Покупатель зерна</option><option>Элеватор / приёмка</option><option>Логистика / перевозчик</option><option>Банк / финансирование</option><option>Регион / институт развития</option><option>Другое</option></select></label>
            <label className={styles.label}>Регион<input className={styles.field} name="region" placeholder="Например: Тамбовская область" /></label>
          </div>
          <div className={styles.grid}>
            <label className={styles.label}>Телефон<input className={styles.field} name="phone" required inputMode="tel" autoComplete="tel" placeholder="+7..." /></label>
            <label className={styles.label}>Email<input className={styles.field} name="email" type="email" autoComplete="email" placeholder="Для материалов по разбору" /></label>
          </div>
          <div className={styles.grid}>
            <label className={styles.label}>Культура и объём<input className={styles.field} name="cropVolume" placeholder="Пшеница, 240 т" /></label>
            <label className={styles.label}>Где риск<select className={styles.field} name="risk" defaultValue=""><option value="">Выберите ключевую боль</option><option>Рейс / водитель / маршрут</option><option>Вес / недовес</option><option>Качество / лаборатория</option><option>СДИЗ / ФГИС Зерно</option><option>ЭДО / ЭПД / МЧД</option><option>СберБизнес ID / банковый контур</option><option>Безопасные сделки / номинальный счёт</option><option>AI-анализ рисков</option><option>Оплата / удержание</option><option>Спор / доказательства</option></select></label>
          </div>
          <div className={styles.grid}>
            <label className={styles.label}>Какой контур нужен<select className={styles.field} name="scenario" defaultValue=""><option value="">Выберите сценарий</option><option>Карта потерь одной сделки</option><option>Controlled pilot</option><option>Банковый сценарий со Сбером</option><option>Документы / СберКорус</option><option>AI-анализ сделки</option><option>Региональный пилот / Минсельхоз</option></select></label>
            <label className={styles.label}>Срок запуска<select className={styles.field} name="timeline" defaultValue=""><option value="">Выберите срок</option><option>Срочно / сейчас есть риск</option><option>1–2 недели</option><option>1 месяц</option><option>Готовим пилот</option></select></label>
          </div>
          <label className={styles.label}>Что нужно разобрать<textarea className={`${styles.field} ${styles.textarea}`} name="deal" required rows={5} placeholder="Маршрут, точка приёмки, документы, спор по весу/качеству, оплата, удержание, Сбер-контур, AI-анализ или региональный пилот" /></label>
          <button type="submit" disabled={state === 'loading' || state === 'success'} className={styles.button}>{state === 'loading' ? 'Отправляем...' : state === 'success' ? 'Заявка отправлена' : 'Получить карту потерь сделки'}</button>
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
