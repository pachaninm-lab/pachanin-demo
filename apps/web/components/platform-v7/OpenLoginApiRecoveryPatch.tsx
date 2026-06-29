'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

function text(root: ParentNode, selector: string) {
  return root.querySelector<HTMLElement>(selector)?.textContent?.trim() || '';
}

function input(root: ParentNode, selector: string) {
  return root.querySelector<HTMLInputElement>(selector)?.value?.trim() || '';
}

function ensurePanel(root: HTMLElement, trigger: HTMLElement) {
  const fields = root.querySelector('.fields');
  if (!fields) return;
  const current = root.querySelector<HTMLElement>('.forgot-access-api-panel');
  if (current) {
    current.hidden = !current.hidden;
    return;
  }

  const panel = document.createElement('div');
  panel.className = 'forgot-access-api-panel';
  panel.innerHTML = `
    <div class="forgot-access-api-head">
      <strong>Восстановление доступа</strong>
      <button type="button" data-close-recovery>Скрыть</button>
    </div>
    <label>
      <span>Контакт для ответа</span>
      <input name="recovery-contact" placeholder="Телефон или email для связи" autocomplete="off" />
    </label>
    <label>
      <span>Комментарий <em>необязательно</em></span>
      <textarea name="recovery-comment" placeholder="Что нужно восстановить или уточнить"></textarea>
    </label>
    <div class="forgot-access-api-status" hidden></div>
    <button type="button" class="forgot-access-api-submit">Отправить запрос</button>
  `;

  panel.querySelector('[data-close-recovery]')?.addEventListener('click', () => {
    panel.hidden = true;
    trigger.focus();
  });

  panel.querySelector<HTMLButtonElement>('.forgot-access-api-submit')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const status = panel.querySelector<HTMLElement>('.forgot-access-api-status');
    const contact = panel.querySelector<HTMLInputElement>('input[name="recovery-contact"]')?.value?.trim() || '';
    const comment = panel.querySelector<HTMLTextAreaElement>('textarea[name="recovery-comment"]')?.value?.trim() || '';
    if (status) {
      status.hidden = false;
      status.textContent = 'Отправляем запрос…';
    }
    button.disabled = true;
    try {
      const response = await fetch('/api/auth/platform-v7-password-recovery', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Pragma: 'no-cache' },
        body: JSON.stringify({
          role: text(root, '.role-panel-head strong') || 'не выбрана',
          login: input(root, '#pc-open-login'),
          company: input(root, '#pc-open-company'),
          contact,
          comment,
        }),
      });
      if (!response.ok) throw new Error('request_failed');
      if (status) status.textContent = 'Запрос отправлен. Мы проверим доступ и свяжемся по указанному контакту.';
    } catch {
      if (status) status.textContent = 'Не удалось отправить запрос. Проверьте подключение почтового API и повторите.';
    } finally {
      button.disabled = false;
    }
  });

  fields.insertAdjacentElement('afterend', panel);
}

export function OpenLoginApiRecoveryPatch() {
  const pathname = usePathname();
  const enabled = pathname === '/platform-v7/open' || pathname === '/platform-v7/login';

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    function sync() {
      if (cancelled) return;
      const root = document.querySelector<HTMLElement>('.pc-clean-login');
      if (!root) return;

      root.querySelectorAll<HTMLElement>('.forgot-access-panel').forEach((item) => item.remove());
      root.querySelectorAll<HTMLElement>('.recover-note').forEach((item) => item.remove());

      root.querySelectorAll<HTMLElement>('.forgot-link').forEach((oldLink) => {
        if (oldLink.dataset.apiRecoveryBound === 'true') return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = oldLink.className;
        button.innerHTML = oldLink.innerHTML || 'Забыли пароль?';
        button.dataset.apiRecoveryBound = 'true';
        button.addEventListener('click', () => ensurePanel(root, button));
        oldLink.replaceWith(button);
      });
    }

    const raf = window.requestAnimationFrame(sync);
    const timers = [120, 360, 900].map((delay) => window.setTimeout(sync, delay));
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <style>{`
      .forgot-access-api-panel {
        display: grid;
        gap: 12px;
        padding: 14px;
        border-radius: 20px;
        border: 1px solid rgba(0,122,47,.14);
        background: rgba(0,122,47,.045);
      }
      .forgot-access-api-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .forgot-access-api-head strong { font-size: 15px; font-weight: 950; color: #071611; }
      .forgot-access-api-head button,
      .forgot-link {
        border: 0;
        background: transparent;
        color: #087a32;
        font-size: 12px;
        font-weight: 950;
        cursor: pointer;
      }
      .forgot-access-api-panel textarea {
        width: 100%;
        min-height: 92px;
        padding: 13px 15px;
        resize: vertical;
        border-radius: 17px;
        border: 1px solid rgba(7,22,17,.16);
        font: 850 16px/1.35 Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .forgot-access-api-status {
        padding: 10px 12px;
        border-radius: 14px;
        background: #fff;
        color: #43534c;
        font-size: 13px;
        font-weight: 850;
      }
      .forgot-access-api-submit {
        min-height: 56px;
        border: 0;
        border-radius: 18px;
        background: #06150f;
        color: #fff;
        font-size: 16px;
        font-weight: 950;
        cursor: pointer;
      }
      .forgot-access-api-submit:disabled { opacity: .6; cursor: not-allowed; }
    `}</style>
  );
}
