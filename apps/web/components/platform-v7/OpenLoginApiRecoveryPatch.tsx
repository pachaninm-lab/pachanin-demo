'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

function text(root: ParentNode, selector: string) {
  return root.querySelector<HTMLElement>(selector)?.textContent?.trim() || '';
}

function input(root: ParentNode, selector: string) {
  return root.querySelector<HTMLInputElement>(selector)?.value?.trim() || '';
}

function normalizeRecoveryPanels(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.forgot-access-panel').forEach((item) => item.remove());
  const panels = Array.from(root.querySelectorAll<HTMLElement>('.forgot-access-api-panel'));
  panels.slice(1).forEach((item) => item.remove());
}

function normalizeOpenLoginShell(root: HTMLElement) {
  root.dataset.openLoginApiFixed = 'true';
  root.querySelectorAll<HTMLElement>('.recover-note').forEach((item) => item.remove());
  normalizeRecoveryPanels(root);
}

function ensurePanel(root: HTMLElement, trigger: HTMLElement) {
  normalizeOpenLoginShell(root);
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
    event.preventDefault();
    event.stopPropagation();
    const button = event.currentTarget as HTMLButtonElement;
    const status = panel.querySelector<HTMLElement>('.forgot-access-api-status');
    const contact = panel.querySelector<HTMLInputElement>('input[name="recovery-contact"]')?.value?.trim() || '';
    const comment = panel.querySelector<HTMLTextAreaElement>('textarea[name="recovery-comment"]')?.value?.trim() || '';
    if (!contact) {
      if (status) {
        status.hidden = false;
        status.textContent = 'Укажите контакт для ответа.';
      }
      return;
    }
    if (status) {
      status.hidden = false;
      status.textContent = 'Отправляем запрос…';
    }
    button.disabled = true;
    try {
      await fetch('/api/auth/platform-v7-password-recovery', {
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
      if (status) status.textContent = 'Запрос принят. Если доступ зарегистрирован, мы обработаем восстановление и свяжемся по указанному контакту.';
    } catch {
      if (status) status.textContent = 'Запрос принят. Если доступ зарегистрирован, мы обработаем восстановление и свяжемся по указанному контакту.';
    } finally {
      button.disabled = false;
    }
  });

  fields.insertAdjacentElement('afterend', panel);
  normalizeRecoveryPanels(root);
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

      normalizeOpenLoginShell(root);

      root.querySelectorAll<HTMLElement>('.forgot-link').forEach((oldLink) => {
        const alreadyOwned = oldLink.dataset.apiRecoveryBound === 'true';
        if (alreadyOwned) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `${oldLink.className.replace(/\bforgot-link\b/g, '').trim()} forgot-link-api`.trim();
        button.innerHTML = oldLink.innerHTML || 'Забыли пароль?';
        button.dataset.apiRecoveryBound = 'true';
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          ensurePanel(root, button);
        });
        oldLink.replaceWith(button);
      });
    }

    const raf = window.requestAnimationFrame(sync);
    const timers = [60, 140, 320, 700, 1400].map((delay) => window.setTimeout(sync, delay));
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <style>{`
      .pc-clean-login[data-open-login-api-fixed='true'] {
        min-height: 100dvh !important;
        padding: calc(72px + env(safe-area-inset-top)) 14px max(18px, env(safe-area-inset-bottom)) !important;
        background: linear-gradient(180deg, #fbfcf9 0%, #f3f7f1 58%, #fff 100%) !important;
        overflow-x: hidden !important;
      }
      .pc-clean-login[data-open-login-api-fixed='true'] .clean-login-header {
        position: fixed !important;
        inset: 0 0 auto 0 !important;
        z-index: 2600 !important;
        min-height: calc(64px + env(safe-area-inset-top)) !important;
        height: calc(64px + env(safe-area-inset-top)) !important;
        padding: calc(8px + env(safe-area-inset-top)) 14px 8px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 10px !important;
        background: rgba(255, 255, 255, .98) !important;
        border-bottom: 1px solid rgba(7,22,17,.08) !important;
        box-shadow: 0 10px 28px rgba(7,22,17,.08) !important;
        -webkit-backdrop-filter: blur(16px) !important;
        backdrop-filter: blur(16px) !important;
      }
      .pc-clean-login[data-open-login-api-fixed='true'] .header-brand {
        display: inline-flex !important;
        align-items: center !important;
        gap: 10px !important;
        flex: 1 1 auto !important;
        min-width: 0 !important;
        max-width: calc(100vw - 86px) !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
      .pc-clean-login[data-open-login-api-fixed='true'] .header-brand svg,
      .pc-clean-login[data-open-login-api-fixed='true'] .header-brand img {
        display: block !important;
        flex: 0 0 auto !important;
      }
      .pc-clean-login[data-open-login-api-fixed='true'] .header-brand span {
        display: grid !important;
        gap: 1px !important;
        min-width: 0 !important;
      }
      .pc-clean-login[data-open-login-api-fixed='true'] .header-brand strong {
        display: block !important;
        color: #06150f !important;
        font-size: 17px !important;
        line-height: 1.08 !important;
        font-weight: 950 !important;
        letter-spacing: -.04em !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }
      .pc-clean-login[data-open-login-api-fixed='true'] .header-brand small {
        display: block !important;
        color: #68756f !important;
        font-size: 10px !important;
        line-height: 1.1 !important;
        font-weight: 850 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }
      .pc-clean-login[data-open-login-api-fixed='true'] .header-actions {
        order: 2 !important;
        margin-left: auto !important;
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
        flex: 0 0 auto !important;
      }
      .pc-clean-login[data-open-login-api-fixed='true'] .header-back {
        width: 44px !important;
        min-width: 44px !important;
        height: 44px !important;
        min-height: 44px !important;
        padding: 0 !important;
        border-radius: 16px !important;
        border: 1px solid rgba(7,22,17,.10) !important;
        background: #fff !important;
        box-shadow: 0 8px 20px rgba(7,22,17,.06) !important;
        color: #06150f !important;
        font-size: 0 !important;
        line-height: 0 !important;
      }
      .pc-clean-login[data-open-login-api-fixed='true'] .header-back svg {
        width: 20px !important;
        height: 20px !important;
        display: block !important;
      }
      .pc-clean-login[data-open-login-api-fixed='true'] .header-register {
        display: none !important;
      }
      .pc-clean-login[data-open-login-api-fixed='true'] .card {
        width: min(100%, 900px) !important;
        margin: 0 auto !important;
        padding: 14px !important;
        border-radius: 24px !important;
        background: rgba(255,255,255,.96) !important;
      }
      .pc-clean-login[data-open-login-api-fixed='true'] .hero-copy {
        display: none !important;
      }
      .pc-clean-login[data-open-login-api-fixed='true'] .role-panel {
        gap: 10px !important;
      }
      .pc-clean-login[data-open-login-api-fixed='true'] .roles {
        gap: 10px !important;
      }
      .pc-clean-login[data-open-login-api-fixed='true'] .roles button {
        min-height: 72px !important;
        padding: 12px 10px !important;
        border-radius: 22px !important;
      }
      .pc-clean-login[data-open-login-api-fixed='true'] .roles button b {
        font-size: 18px !important;
        line-height: 1.08 !important;
      }
      .pc-clean-login[data-open-login-api-fixed='true'] .roles button small {
        font-size: 13px !important;
        line-height: 1.1 !important;
      }
      .pc-clean-login[data-open-login-api-fixed='true'] .fields {
        margin-top: 4px !important;
      }
      .pc-clean-login[data-open-login-api-fixed='true'] .recover-note,
      .forgot-access-panel { display: none !important; }
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
      .forgot-link-api {
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
      @media (max-width: 720px) {
        .pc-clean-login[data-open-login-api-fixed='true'] {
          padding-top: calc(68px + env(safe-area-inset-top)) !important;
        }
        .pc-clean-login[data-open-login-api-fixed='true'] .clean-login-header {
          min-height: calc(60px + env(safe-area-inset-top)) !important;
          height: calc(60px + env(safe-area-inset-top)) !important;
          padding: calc(7px + env(safe-area-inset-top)) 12px 7px !important;
        }
        .pc-clean-login[data-open-login-api-fixed='true'] .header-brand strong {
          font-size: 16px !important;
        }
        .pc-clean-login[data-open-login-api-fixed='true'] .header-brand small {
          font-size: 9.5px !important;
        }
        .pc-clean-login[data-open-login-api-fixed='true'] .roles {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
      }
    `}</style>
  );
}
