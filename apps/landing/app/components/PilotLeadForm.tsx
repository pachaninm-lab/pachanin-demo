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
        body: JSON.stringify({
          ...payload,
          source: 'landing_loss_map',
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
      setMessage('Заявка собрана, но почтовый провайдер ещё требует настройки в Vercel. Продублируйте запрос на почту или позвоните по номеру ниже.');
    } catch {
      setState('fallback');
      setMessage('Связь с формой не прошла. Напишите напрямую на почту или позвоните по номеру ниже.');
    }
  }

  return (
    <div className="lead-shell" id="lead-form">
      <div className="lead-head">
        <div>
          <span>карта потерь сделки</span>
          <strong>Опишите одну сделку — покажем, где могут зависнуть деньги.</strong>
        </div>
        <em>Фокус: рейс, вес, качество, документы, оплата, спор.</em>
      </div>

      <div className="lead-value-grid" aria-label="Что вы получите после заявки">
        <div><strong>1</strong><span>точки риска</span></div>
        <div><strong>2</strong><span>владельцы действий</span></div>
        <div><strong>3</strong><span>сценарий пилота</span></div>
      </div>

      <form onSubmit={onSubmit} className="lead-form">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hp-field" aria-hidden="true" />
        <div className="form-grid two">
          <label>Имя<input name="name" required placeholder="Как к вам обращаться" /></label>
          <label>Компания / хозяйство<input name="company" required placeholder="КФХ, элеватор, покупатель, логистика" /></label>
        </div>
        <div className="form-grid two">
          <label>Роль в сделке<select name="role" required defaultValue=""><option value="" disabled>Выберите роль</option><option>Продавец / КФХ</option><option>Покупатель зерна</option><option>Элеватор / приёмка</option><option>Логистика / перевозчик</option><option>Банк / финансирование</option><option>Регион / институт развития</option><option>Другое</option></select></label>
          <label>Регион<input name="region" placeholder="Например: Тамбовская область" /></label>
        </div>
        <div className="form-grid two">
          <label>Телефон<input name="phone" required inputMode="tel" autoComplete="tel" placeholder="+7..." /></label>
          <label>Email<input name="email" type="email" autoComplete="email" placeholder="Для материалов по разбору" /></label>
        </div>
        <div className="form-grid two">
          <label>Культура и объём<input name="cropVolume" placeholder="Пшеница, 240 т" /></label>
          <label>Где риск<select name="risk" defaultValue=""><option value="">Выберите ключевую боль</option><option>Цена и условия</option><option>Рейс / водитель / маршрут</option><option>Вес / недовес</option><option>Качество / лаборатория</option><option>СДИЗ / ФГИС Зерно</option><option>ЭДО / документы</option><option>Оплата / удержание</option><option>Спор / доказательства</option></select></label>
        </div>
        <label>Что нужно разобрать<textarea name="deal" required rows={5} placeholder="Опишите сделку: маршрут, точка приёмки, документы, спор по весу/качеству, оплата, удержание или задержка" /></label>
        <button type="submit" disabled={state === 'loading' || state === 'success'} className="primary-submit">{state === 'loading' ? 'Отправляем...' : state === 'success' ? 'Заявка отправлена' : 'Получить карту потерь сделки'}</button>
        {message ? <p className={`form-message ${state}`}>{message}</p> : null}
      </form>
      <div className="contact-strip">
        <a href="mailto:pachaninm@gmail.com">pachaninm@gmail.com</a>
        <a href="tel:+79162778989">+7 916 277-89-89</a>
      </div>
      <p className="lead-legal">Отправка формы не создаёт договор, банковскую гарантию или обещание live-интеграций. Это вход в предметный разбор сделки и pilot-сценария.</p>
    </div>
  );
}
