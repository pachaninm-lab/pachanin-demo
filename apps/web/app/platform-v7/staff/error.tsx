'use client';

export default function StaffError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className='pc-staff-state' role='alert'>
      <span aria-hidden='true'>!</span>
      <h1>Контур сотрудников временно недоступен</h1>
      <p>Доступ закрыт. Повторная попытка не изменит права и не создаст обходную сессию.</p>
      <button type='button' onClick={reset}>Повторить</button>
    </section>
  );
}
