'use client';

import * as React from 'react';

type Lang = 'ru' | 'en' | 'zh';
type Dict = Record<string, string>;
type SourceOption = HTMLOptionElement & { __pcLockOption?: string };

const LANGUAGE_KEY = 'pc-v7-language';
const DICTIONARY_URL = '/platform-v7/i18n/dictionaries.json';

const BASE: Record<'en' | 'zh', Dict> = {
  en: {
    'Войти': 'Sign in',
    'Назад': 'Back',
    'Справка': 'Help',
    'Выход': 'Exit',
    'Открыть': 'Open',
    'Закрыть': 'Close',
    'Открыть меню': 'Open menu',
    'Закрыть меню': 'Close menu',
    'Открыть поиск': 'Open search',
    'Открыть уведомления': 'Open notifications',
    'Закрыть уведомления': 'Close notifications',
    'Введите пароль': 'Enter password',
    'Компания / ИНН': 'Company / TIN',
    'Телефон или email': 'Phone or email',
    'Участник': 'Participant',
    'Покупатель': 'Buyer',
    'Продавец': 'Seller',
    'Логистика': 'Logistics',
    'Водитель': 'Driver',
    'Элеватор': 'Elevator',
    'Лаборатория': 'Laboratory',
    'Банк': 'Bank',
    'Комплаенс': 'Compliance',
    'Арбитр': 'Arbitrator',
    'Руководитель': 'Executive',
    'Оператор': 'Operator',
    'Юр. лицо / ИП / КФХ': 'Legal entity / sole proprietor / farm',
    'Требуется уточнение': 'Clarification required',
    'Ожидает проверки': 'Awaiting review',
    'Допущен': 'Approved',
    'Отклонён': 'Declined',
    'Заблокирован': 'Blocked',
  },
  zh: {
    'Войти': '登录',
    'Назад': '返回',
    'Справка': '帮助',
    'Выход': '退出',
    'Открыть': '打开',
    'Закрыть': '关闭',
    'Открыть меню': '打开菜单',
    'Закрыть меню': '关闭菜单',
    'Открыть поиск': '打开搜索',
    'Открыть уведомления': '打开通知',
    'Закрыть уведомления': '关闭通知',
    'Введите пароль': '输入密码',
    'Компания / ИНН': '公司 / 税号',
    'Телефон или email': '电话或邮箱',
    'Участник': '参与方',
    'Покупатель': '买方',
    'Продавец': '卖方',
    'Логистика': '物流',
    'Водитель': '司机',
    'Элеватор': '粮仓',
    'Лаборатория': '实验室',
    'Банк': '银行',
    'Комплаенс': '合规',
    'Арбитр': '仲裁员',
    'Руководитель': '管理层',
    'Оператор': '运营方',
    'Юр. лицо / ИП / КФХ': '法人 / 个体工商户 / 农场',
    'Требуется уточнение': '需要补充说明',
    'Ожидает проверки': '等待审核',
    'Допущен': '已准入',
    'Отклонён': '已拒绝',
    'Заблокирован': '已封锁',
  },
};

function lang(): Lang {
  const stored = window.localStorage.getItem(LANGUAGE_KEY);
  return stored === 'en' || stored === 'zh' ? stored : 'ru';
}

function norm(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clean(value: unknown): Dict {
  if (!isRecord(value)) return {};
  const out: Dict = {};
  Object.entries(value).forEach(([key, raw]) => {
    const source = norm(key);
    if (!source || typeof raw !== 'string') return;
    const translated = raw.trim();
    if (translated) out[source] = translated;
  });
  return out;
}

function translate(source: string, selected: Lang, dictionary: Record<'en' | 'zh', Dict>) {
  if (selected === 'ru') return source;
  const key = norm(source);
  if (!key) return source;
  const dict = dictionary[selected];
  const exact = dict[key];
  if (exact) return exact;
  let next = source;
  for (const [from, to] of Object.entries(dict).sort((a, b) => b[0].length - a[0].length)) {
    if (from.length < 4 || !next.includes(from)) continue;
    next = next.split(from).join(to);
  }
  return next;
}

function keyFor(attribute: 'aria-label' | 'title' | 'placeholder') {
  if (attribute === 'aria-label') return 'pcLockAria';
  if (attribute === 'placeholder') return 'pcLockPlaceholder';
  return 'pcLockTitle';
}

function applyAttributeCopy(dictionary: Record<'en' | 'zh', Dict>) {
  const selected = lang();
  document.querySelectorAll<HTMLElement>('[aria-label],[title],[placeholder]').forEach((element) => {
    if (element.closest('script,style,noscript,svg,canvas,.p7-translator-root,[data-p7-no-translate]')) return;
    (['aria-label', 'title', 'placeholder'] as const).forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return;
      const key = keyFor(attribute);
      const source = element.dataset[key] || element.getAttribute(attribute) || '';
      if (!source) return;
      element.dataset[key] = source;
      const next = translate(source, selected, dictionary);
      if (element.getAttribute(attribute) !== next) element.setAttribute(attribute, next);
    });
  });
}

function applyOptionCopy(dictionary: Record<'en' | 'zh', Dict>) {
  const selected = lang();
  document.querySelectorAll<SourceOption>('select option').forEach((option) => {
    const source = option.__pcLockOption || option.textContent || '';
    if (!norm(source)) return;
    option.__pcLockOption = source;
    const next = translate(source, selected, dictionary);
    if (option.textContent !== next) option.textContent = next;
  });
}

export function PublicHeaderFinalLock() {
  React.useEffect(() => {
    let dictionary = BASE;
    let frame = 0;
    const applyAll = () => {
      applyAttributeCopy(dictionary);
      applyOptionCopy(dictionary);
    };
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(applyAll);
    };
    const load = async () => {
      try {
        const response = await fetch(DICTIONARY_URL, { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' } });
        if (!response.ok) return;
        const payload = await response.json();
        if (!isRecord(payload) || !isRecord(payload.dictionaries)) return;
        dictionary = { en: { ...BASE.en, ...clean(payload.dictionaries.en) }, zh: { ...BASE.zh, ...clean(payload.dictionaries.zh) } };
        schedule();
      } catch {
        schedule();
      }
    };
    schedule();
    void load();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder'] });
    const interval = window.setInterval(schedule, 1000);
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <style>{`
      .entry-header-actions,
      .login-top,
      .p7-register-actions,
      .p7-contact-fixed-actions,
      .pc-v4-actions {
        display: flex !important;
        align-items: center !important;
      }

      .entry-header-actions .p7-translator-slot,
      .login-top .p7-translator-slot,
      .p7-register-actions .p7-translator-slot,
      .p7-contact-fixed-actions .p7-translator-slot,
      .pc-v4-actions .p7-translator-slot {
        display: inline-flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        flex: 0 0 auto !important;
        pointer-events: auto !important;
      }

      .entry-header-actions .p7-translator-button,
      .login-top .p7-translator-button,
      .p7-register-actions .p7-translator-button,
      .p7-contact-fixed-actions .p7-translator-button {
        width: 42px !important;
        min-width: 42px !important;
        height: 42px !important;
        padding: 0 !important;
      }

      .entry-header-actions .p7-translator-button span,
      .entry-header-actions .p7-translator-button b,
      .login-top .p7-translator-button span,
      .login-top .p7-translator-button b,
      .p7-register-actions .p7-translator-button span,
      .p7-register-actions .p7-translator-button b,
      .p7-contact-fixed-actions .p7-translator-button span,
      .p7-contact-fixed-actions .p7-translator-button b {
        display: none !important;
      }

      @media (max-width: 720px) {
        .entry-header {
          grid-template-columns: minmax(0, 1fr) auto !important;
        }

        .entry-header-actions {
          gap: 8px !important;
          min-width: max-content !important;
        }

        .entry-login {
          min-width: 84px !important;
          flex: 0 0 auto !important;
        }

        .entry-brand {
          max-width: calc(100dvw - 188px) !important;
          overflow: hidden !important;
        }
      }
    `}</style>
  );
}
