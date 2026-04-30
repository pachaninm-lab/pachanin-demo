"use client";

import { FormEvent, useState } from 'react';

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
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result?.sent === true) {
        setState('success');
        setMessage('Заявка отправлена. Мы свяжемся для разбора сделки и пилотного сценария.');
        form.reset();
        return;
      }
      setState('fallback');
      setMessage('Заявка собрана. Для гарантированной доставки используйте прямой контакт ниже.');
    } catch {
      setState('fallback');
      setMessage('Связь с формой не прошла. Используйте прямой контакт ниже.');
    }
  }

  return (
    <div className="lead-shell" id="lead-form">
      <div className="lead-head">
        <span>заявка на пилот</span>
        <strong>Разберём одну реальную сделку и покажем, где теряются деньги.</strong>
      </div>

      <form onSubmit={onSubmit} className="lead-form">
        <div className="form-grid two">
          <label>Имя<input name="name" required placeholder="Как к вам обращаться" /></label>
          <label>Компания / хозяйство<input name="company" required placeholder="КФХ, элеватор, покупатель, логистика" /></label>
        </div>
        <div className="form-grid two">
          <label>Роль в сделке<select name="role" required defaultValue=""><option value="" disabled>Выберите роль</option><option>Продавец / КФХ</option><option>Покупатель зерна</option><option>Элеватор / приёмка</option><option>Логистика / перевозчик</option><option>Банк / финансирование</option><option>Регион / институт развития</option><option>Другое</option></select></label>
          <label>Регион<input name="region" placeholder="Например: Тамбовская область" /></label>
        </div>
        <div className="form-grid two">
          <label>Телефон<input name="phone" required inputMode="tel" placeholder="+7..." /></label>
          <label>Email<input name="email" type="email" placeholder="Для материалов по пилоту" /></label>
        </div>
        <label>Что нужно разобрать<textarea name="deal" required rows={5} placeholder="Культура, объём, маршрут, приёмка, документы, спор по весу/качеству, оплата или удержание" /></label>
        <button type="submit" disabled={state === 'loading' || state === 'success'} className="primary-submit">{state === 'loading' ? 'Отправляем заявку...' : state === 'success' ? 'Заявка отправлена' : 'Оставить заявку на пилот'}</button>
        {message ? <p className={`form-message ${state}`}>{message}</p> : null}
      </form>
      <div className="contact-strip">
        <a href="mailto:pachaninm@gmail.com">pachaninm@gmail.com</a>
        <a href="tel:+79162778989">+7 916 277-89-89</a>
      </div>
    </div>
  );
}
