'use client';

import * as React from 'react';
import { accountApi } from '@/lib/gekta/server-workspace';
import { phoneStateLabel } from '@/lib/gekta/console-model';

type Identity = { state: string | null; declaredAt: string | null; masked: string | null };

/**
 * Черновая проверка формата на клиенте: она только избавляет от заведомо
 * бессмысленного запроса. Канонизацией занимается сервер — там же живут
 * шифрование и индекс поиска.
 */
function looksLikePhone(raw: string): boolean {
  const digits = raw.replace(/\D/gu, '');
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Телефон аккаунта Гекты.
 *
 * Карточка появляется только у вошедшего пользователя: анонимному режиму
 * телефон не нужен и показывать ему это поле незачем. Номер уходит на сервер,
 * где хранится зашифрованным, а искать по нему можно через отдельный HMAC-индекс.
 *
 * Слово «подтверждён» здесь не используется, пока подтверждения на самом деле
 * не было: провайдера проверки номера у продукта пока нет.
 */
export function GektaPhoneCard() {
  const [identity, setIdentity] = React.useState<Identity | null>(null);
  const [available, setAvailable] = React.useState(false);
  const [value, setValue] = React.useState('');
  const [note, setNote] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await accountApi<Identity>('phone');
      if (cancelled || !result.ok) return;
      setIdentity(result.data);
      setAvailable(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!looksLikePhone(value)) {
      setNote('Введите номер в российском формате, например +7 916 000-00-00.');
      return;
    }
    setBusy(true);
    const saved = await accountApi<Identity>('phone', { method: 'POST', body: { phone: value } });
    setBusy(false);
    if (!saved.ok) {
      setNote(saved.status === 503 ? 'Хранилище телефонов не настроено — номер не сохранён.' : 'Номер не сохранён.');
      return;
    }
    setValue('');
    setNote('Номер сохранён.');
    const refreshed = await accountApi<Identity>('phone');
    if (refreshed.ok) setIdentity(refreshed.data);
  }, [value]);

  if (!available) return null;

  return (
    <section data-gekta-phone-card='true' className='mt-6'>
      <h3 className='text-sm font-semibold text-slate-800'>Телефон аккаунта</h3>
      <p className='mt-1 text-xs leading-5 text-slate-500'>
        {identity?.masked
          ? `Указан номер ${identity.masked} — ${phoneStateLabel(identity.state)}.`
          : 'Номер нужен, чтобы вернуть доступ к аккаунту и найти его в поддержке.'}
      </p>
      <form onSubmit={submit} className='mt-3 flex flex-wrap items-center gap-2'>
        <label htmlFor='gekta-phone-input' className='sr-only'>Номер телефона</label>
        <input
          id='gekta-phone-input'
          type='tel'
          inputMode='tel'
          autoComplete='tel'
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder='+7 916 000-00-00'
          className='min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900'
        />
        <button
          type='submit'
          disabled={busy}
          className='rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60'
        >
          {identity?.masked ? 'Изменить номер' : 'Сохранить номер'}
        </button>
      </form>
      {note ? <p className='mt-2 text-xs text-slate-600' data-gekta-phone-note>{note}</p> : null}
    </section>
  );
}
