'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

const RECOVERY_TARGET = 'pachaninm@gmail.com';

function roleText(root: ParentNode) {
  return root.querySelector<HTMLElement>('.role-panel-head strong')?.textContent?.trim() || 'не выбрана';
}

function fieldValue(root: ParentNode, selector: string) {
  return root.querySelector<HTMLInputElement>(selector)?.value?.trim() || '';
}

function makeRecoveryHref(role: string, login: string, company: string, contact: string, comment: string) {
  const subject = encodeURIComponent('Запрос восстановления доступа — Прозрачная Цена');
  const body = encodeURIComponent([
    'Запрос восстановления доступа к платформе «Прозрачная Цена».',
    '',
    `Роль: ${role || 'не выбрана'}`,
    `Логин: ${login || 'не указан'}`,
    `Организация / ИНН: ${company || 'не указано'}`,
    `Контакт для ответа: ${contact || 'не указан'}`,
    `Комментарий: ${comment || 'без комментария'}`,
    `Время запроса: ${new Date().toLocaleString('ru-RU')}`,
    '',
    'Прошу проверить доступ и выдать новый пароль / код доступа.',
    'Пароль в письме не указывается.',
  ].join('\n'));
  return `mailto:${RECOVERY_TARGET}?subject=${subject}&body=${body}`;
}

function ensureBottomRegister(root: ParentNode) {
  const form = root.querySelector('form');
  if (!form || form.querySelector('.bottom-register-patch')) return;
  const link = document.createElement('a');
  link.className = 'bottom-register-patch';
  link.href = '/platform-v7/register';
  link.textContent = 'Зарегистрироваться';
  form.appendChild(link);
}

function ensureRecoveryForm(root: ParentNode, link: HTMLElement) {
  const fields = root.querySelector('.fields');
  if (!fields) return;
  const existing = root.querySelector<HTMLElement>('.forgot-access-panel');
  if (existing) {
    existing.hidden = !existing.hidden;
    return;
  }

  const panel = document.createElement('form');
  panel.className = 'forgot-access-panel';
  panel.innerHTML = `
    <div class='forgot-access-head'>
      <strong>Восстановление доступа</strong>
      <button type='button' data-forgot-close>Скрыть</button>
    </div>
    <label>
      <span>Контакт для ответа</span>
      <input name='recovery-contact' placeholder='Телефон или email для связи' autocomplete='off' />
    </label>
    <label>
      <span>Комментарий <em>необязательно</em></span>
      <textarea name='recovery-comment' placeholder='Что нужно восстановить или уточнить'></textarea>
    </label>
    <div class='forgot-access-status' hidden></div>
    <button type='submit' class='forgot-access-submit'>Отправить запрос</button>
  `;

  panel.addEventListener('submit', (event) => {
    event.preventDefault();
    const contact = (panel.querySelector<HTMLInputElement>('input[name="recovery-contact"]')?.value || '').trim();
    const comment = (panel.querySelector<HTMLTextAreaElement>('textarea[name="recovery-comment"]')?.value || '').trim();
    const href = makeRecoveryHref(
      roleText(root),
      fieldValue(root, '#pc-open-login'),
      fieldValue(root, '#pc-open-company'),
      contact,
      comment,
    );
    const status = panel.querySelector<HTMLElement>('.forgot-access-status');
    if (status) {
      status.hidden = false;
      status.textContent = 'Запрос подготовлен. Подтвердите отправку в почтовом окне.';
    }
    window.location.href = href;
  });

  panel.querySelector('[data-forgot-close]')?.addEventListener('click', () => {
    panel.hidden = true;
    link.focus();
  });

  fields.insertAdjacentElement('afterend', panel);
}

export function OpenLoginPolishPatch() {
  const pathname = usePathname();
  const enabled = pathname === '/platform-v7/open' || pathname === '/platform-v7/login';

  React.useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    function sync() {
      if (cancelled) return;
      const root = document.querySelector<HTMLElement>('.pc-clean-login');
      if (!root) return;

      root.dataset.polishedOpenLogin = 'true';
      root.querySelector('.recover-note')?.remove();
      root.querySelector('.header-register')?.remove();
      ensureBottomRegister(root);

      root.querySelectorAll<HTMLAnchorElement>('.forgot-link').forEach((link) => {
        if (link.dataset.recoveryBound === 'true') return;
        link.dataset.recoveryBound = 'true';
        link.removeAttribute('href');
        link.setAttribute('role', 'button');
        link.setAttribute('tabindex', '0');
        link.addEventListener('click', (event) => {
          event.preventDefault();
          ensureRecoveryForm(root, link);
        });
        link.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            ensureRecoveryForm(root, link);
          }
        });
      });
    }

    const raf = window.requestAnimationFrame(sync);
    const timers = [80, 240, 700].map((delay) => window.setTimeout(sync, delay));
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <style>{`
      .pc-clean-login[data-polished-open-login='true'] {
        padding-top: calc(64px + env(safe-area-inset-top)) !important;
      }
      .pc-clean-login[data-polished-open-login='true'] .clean-login-header {
        min-height: calc(56px + env(safe-area-inset-top)) !important;
        padding: calc(7px + env(safe-area-inset-top)) 12px 7px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 9px !important;
        box-shadow: 0 8px 22px rgba(7,22,17,.07) !important;
      }
      .pc-clean-login[data-polished-open-login='true'] .header-actions {
        order: -1 !important;
        display: flex !important;
        flex: 0 0 auto !important;
        gap: 0 !important;
      }
      .pc-clean-login[data-polished-open-login='true'] .header-back {
        width: 42px !important;
        min-width: 42px !important;
        height: 42px !important;
        min-height: 42px !important;
        padding: 0 !important;
        border-radius: 15px !important;
        font-size: 0 !important;
        background: #fff !important;
      }
      .pc-clean-login[data-polished-open-login='true'] .header-back svg {
        width: 19px !important;
        height: 19px !important;
        display: block !important;
      }
      .pc-clean-login[data-polished-open-login='true'] .header-brand {
        flex: 1 1 auto !important;
        min-width: 0 !important;
        gap: 9px !important;
      }
      .pc-clean-login[data-polished-open-login='true'] .header-brand small {
        display: none !important;
      }
      .pc-clean-login[data-polished-open-login='true'] .header-brand strong {
        font-size: 17px !important;
      }
      .pc-clean-login[data-polished-open-login='true'] .recover-note,
      .pc-clean-login[data-polished-open-login='true'] .header-register {
        display: none !important;
      }
      .pc-clean-login[data-polished-open-login='true'] .forgot-link {
        border: 0 !important;
        background: transparent !important;
        color: #087a32 !important;
        cursor: pointer !important;
        text-decoration: none !important;
      }
      .forgot-access-panel {
        display: grid;
        gap: 12px;
        padding: 14px;
        border-radius: 20px;
        border: 1px solid rgba(0,122,47,.14);
        background: rgba(0,122,47,.045);
      }
      .forgot-access-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .forgot-access-head strong {
        font-size: 15px;
        font-weight: 950;
        color: #071611;
      }
      .forgot-access-head button {
        border: 0;
        background: transparent;
        color: #087a32;
        font-size: 12px;
        font-weight: 950;
        cursor: pointer;
      }
      .forgot-access-panel textarea {
        width: 100%;
        min-height: 92px;
        padding: 13px 15px;
        resize: vertical;
        border-radius: 17px;
        border: 1px solid rgba(7,22,17,.16);
        font: 850 16px/1.35 Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .forgot-access-status {
        padding: 10px 12px;
        border-radius: 14px;
        background: #fff;
        color: #43534c;
        font-size: 13px;
        font-weight: 850;
      }
      .forgot-access-submit,
      .bottom-register-patch {
        min-height: 56px;
        border-radius: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        font-size: 16px;
        font-weight: 950;
      }
      .forgot-access-submit {
        border: 0;
        background: #06150f;
        color: #fff;
        cursor: pointer;
      }
      .bottom-register-patch {
        background: #fff;
        color: #087a32 !important;
        border: 1px solid rgba(0,122,47,.20);
      }
      @media (max-width: 720px) {
        .pc-clean-login[data-polished-open-login='true'] {
          padding-top: calc(60px + env(safe-area-inset-top)) !important;
        }
        .pc-clean-login[data-polished-open-login='true'] .clean-login-header {
          min-height: calc(56px + env(safe-area-inset-top)) !important;
        }
      }
    `}</style>
  );
}
