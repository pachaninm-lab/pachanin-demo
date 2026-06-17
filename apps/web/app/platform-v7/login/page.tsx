'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PLATFORM_V7_ACTIVE_ROLE_KEY, platformV7RoleHome } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const roles: Array<{ role: PlatformRole; title: string; text: string }> = [
  { role: 'seller', title: 'Продавец', text: 'Партия, документы, приёмка и основание к расчёту.' },
  { role: 'buyer', title: 'Покупатель', text: 'Поставка, качество, документы, риск и оплата.' },
  { role: 'logistics', title: 'Логистика', text: 'Рейсы, маршрут, водитель и отклонения.' },
  { role: 'driver', title: 'Водитель', text: 'Мой рейс, прибытие, фото и полевые события.' },
  { role: 'elevator', title: 'Элеватор', text: 'Очередь, вес, разгрузка и приёмочные документы.' },
  { role: 'lab', title: 'Лаборатория', text: 'Проба, протокол, качество и расхождения.' },
  { role: 'surveyor', title: 'Сюрвейер', text: 'Осмотр, фиксация фактов и доказательства.' },
  { role: 'bank', title: 'Банк', text: 'Основание, удержание, проверка и банковский шаг.' },
  { role: 'compliance', title: 'Комплаенс', text: 'Допуск, полномочия, стоп-факторы и проверки.' },
  { role: 'arbitrator', title: 'Арбитр', text: 'Разбор, спор, evidence pack и решение по фактам.' },
  { role: 'operator', title: 'Оператор', text: 'Центр управления, блокеры и следующий шаг.' },
  { role: 'executive', title: 'Руководитель', text: 'Деньги под риском, статус и управленческий срез.' },
];

export default function LoginPage() {
  const router = useRouter();
  const setRole = usePlatformV7RStore((state) => state.setRole);

  function enter(role: PlatformRole) {
    globalThis.sessionStorage?.setItem(PLATFORM_V7_ACTIVE_ROLE_KEY, role);
    setRole(role);
    router.replace(platformV7RoleHome(role));
  }

  return (
    <main className='pc-v7-login-single'>
      <style>{css}</style>
      <section className='login-head'>
        <span>Единый вход</span>
        <h1>Выберите один рабочий кабинет</h1>
        <p>Роль фиксируется на текущую сессию. Переход из одного личного кабинета в другой внутри платформы закрыт.</p>
      </section>
      <section className='login-grid' aria-label='Единый выбор роли'>
        {roles.map((item) => (
          <button key={item.role} type='button' className='login-card' onClick={() => enter(item.role)}>
            <strong>{item.title}</strong>
            <small>{item.text}</small>
            <em>Войти в этот кабинет</em>
          </button>
        ))}
      </section>
      <Link href='/platform-v7' className='login-back'>Вернуться на главную</Link>
    </main>
  );
}

const css = `
.pc-v7-login-single{min-height:100vh;padding:28px clamp(16px,4vw,58px) 48px;background:linear-gradient(180deg,#fbfcf9 0%,#f2f8f1 100%);color:#071611;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.login-head{display:grid;gap:12px;max-width:760px;margin:0 auto 22px;text-align:center}.login-head span{justify-self:center;width:fit-content;padding:8px 12px;border-radius:999px;background:rgba(0,122,47,.08);color:#007a2f;font-size:12px;font-weight:900;letter-spacing:.04em;text-transform:uppercase}.login-head h1{margin:0;font-size:clamp(34px,6vw,62px);line-height:.98;letter-spacing:-.06em;font-weight:950}.login-head p{margin:0 auto;max-width:660px;color:#586660;font-size:clamp(16px,2vw,20px);line-height:1.45;font-weight:650}.login-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;max-width:1180px;margin:0 auto}.login-card{min-height:148px;display:grid;align-content:start;gap:10px;padding:18px;border-radius:24px;border:1px solid rgba(7,22,17,.075);background:rgba(255,255,255,.82);box-shadow:0 14px 34px rgba(7,22,17,.06);text-align:left;cursor:pointer}.login-card strong{color:#071611;font-size:18px;font-weight:950;letter-spacing:-.035em}.login-card small{color:#5d6862;font-size:13px;line-height:1.38;font-weight:640}.login-card em{margin-top:auto;color:#007a2f;font-size:12.5px;font-style:normal;font-weight:900}.login-back{display:flex;justify-content:center;width:fit-content;margin:22px auto 0;color:#66736e;font-size:13px;font-weight:850;text-decoration:none}@media(max-width:980px){.login-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:420px){.pc-v7-login-single{padding:22px 16px 36px}.login-grid{grid-template-columns:1fr}.login-card{min-height:132px}}
`;
