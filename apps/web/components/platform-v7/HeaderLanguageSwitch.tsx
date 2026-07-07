'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Languages } from 'lucide-react';
import {
  LANGUAGES,
  applyTranslationToDom,
  clearLegacyDictionaryCache,
  getLanguageMeta,
  readStoredLanguage,
  startTranslationObserver,
  subscribeToLanguageChanges,
  writeStoredLanguage,
  type LanguageCode,
} from '@/lib/platform-v7/i18n/translation-runtime';

const TARGETS = [
  '.pc-site-actions',
  '.pc-v4-actions',
  '.p7-flow-actions',
  '.p7-request-actions',
  '.p7-contact-nav',
  '.p7-register-actions',
  '.login-header',
];

const SUPPORTED_LANGUAGE_CODES: readonly LanguageCode[] = ['ru', 'en', 'zh'];
const SUPPORTED_LANGUAGES = LANGUAGES.filter((item) => SUPPORTED_LANGUAGE_CODES.includes(item.code));

const REGISTER_EN = {
  'Навигация регистрации участника': 'Participant registration navigation',
  'На главную Прозрачная Цена': 'To Transparent Price home',
  'Действия регистрации': 'Registration actions',
  'Прозрачная Цена': 'Transparent Price',
  'Войти': 'Sign in',
  'Выход': 'Exit',
  'Регистрация участника': 'Participant registration',
  'Подключение компании к': 'Connect a company to the',
  'контуру сделки': 'deal circuit',
  'Профиль, реквизиты, ответственный и согласия. После отправки заявка проходит проверку. Доступ в кабинет открывается после статуса «Допущен».': 'Profile, details, responsible person, and confirmations. After submission, the request is reviewed. Workspace access opens after the Approved status.',
  'Заявка → проверка → допуск': 'Request → review → approval',
  'Роль участника': 'Participant role',
  'Заявляемая роль': 'Requested role',
  'Роль указывается в заявке. Выбор роли здесь не обходит role-lock — доступ в рабочий кабинет открывается только после проверки и допуска участника.': 'The role is stated in the request. Selecting a role here does not bypass the role lock — workspace access opens only after participant review and approval.',
  'Продавец': 'Seller',
  'Покупатель': 'Buyer',
  'Логистика': 'Logistics',
  'Элеватор': 'Elevator',
  'Лаборатория': 'Laboratory',
  'Сюрвейер': 'Surveyor',
  'Банк': 'Bank',
  'Арбитр': 'Arbitrator',
  'Оператор': 'Operator',
  'Участник': 'Participant',
  'Тип участника': 'Participant type',
  'Юр. лицо / ИП / КФХ': 'Legal entity / sole proprietor / farm',
  'Название организации': 'Organisation name',
  'ООО «АгроГрейн»': 'AgroGrain LLC',
  'Регион': 'Region',
  'Тамбовская область': 'Tambov region',
  'Реквизиты и ответственный': 'Details and responsible person',
  'ИНН': 'TIN',
  '10 или 12 цифр': '10 or 12 digits',
  'КПП': 'Tax registration reason code',
  '9 цифр (для юр. лица)': '9 digits for a legal entity',
  'ОГРН / ОГРНИП': 'OGRN / OGRNIP',
  '13 или 15 цифр': '13 or 15 digits',
  'ФИО ответственного': 'Responsible person full name',
  'Иванов Иван Иванович': 'Ivan Ivanov',
  'Должность': 'Position',
  'Директор / Уполномоченный': 'Director / authorised person',
  'Телефон': 'Phone',
  'Email': 'Email',
  'Пароль': 'Password',
  'Согласия': 'Confirmations',
  'Согласен с правилами платформы': 'I accept the platform rules',
  'Согласен на обработку персональных данных': 'I consent to personal data processing',
  'Статусы проверки заявки': 'Request review statuses',
  'Заявка создана': 'Request created',
  'Ожидает проверки': 'Awaiting review',
  'Требуется уточнение': 'Clarification required',
  'Допущен': 'Approved',
  'Отклонён': 'Declined',
  'Заблокирован': 'Blocked',
  'Текущий статус заявки и причина уточнения видны участнику после отправки. Проверка участника — часть контролируемого запуска контура; внешние подтверждения ожидают подключения.': 'The current request status and clarification reason are visible after submission. Participant review is part of admission to the work circuit; external confirmations are connected separately.',
  'Отправить заявку на проверку': 'Submit request for review',
  'Уже есть доступ — войти': 'Already have access — sign in',
};

const REGISTER_ZH = {
  'Навигация регистрации участника': '参与方注册导航',
  'На главную Прозрачная Цена': '返回透明价格首页',
  'Действия регистрации': '注册操作',
  'Прозрачная Цена': '透明价格',
  'Войти': '登录',
  'Выход': '退出',
  'Регистрация участника': '参与方注册',
  'Подключение компании к': '将公司接入',
  'контуру сделки': '交易闭环',
  'Профиль, реквизиты, ответственный и согласия. После отправки заявка проходит проверку. Доступ в кабинет открывается после статуса «Допущен».': '资料、信息、负责人和确认。提交后申请进入审核。状态为“已准入”后开放工作区访问。',
  'Заявка → проверка → допуск': '申请 → 审核 → 准入',
  'Роль участника': '参与方角色',
  'Заявляемая роль': '申请角色',
  'Роль указывается в заявке. Выбор роли здесь не обходит role-lock — доступ в рабочий кабинет открывается только после проверки и допуска участника.': '角色在申请中声明。此处选择角色不会绕过角色锁定；只有参与方审核和准入后才开放工作区访问。',
  'Продавец': '卖方',
  'Покупатель': '买方',
  'Логистика': '物流',
  'Элеватор': '粮库',
  'Лаборатория': '实验室',
  'Сюрвейер': '检验员',
  'Банк': '银行',
  'Арбитр': '仲裁员',
  'Оператор': '运营方',
  'Участник': '参与方',
  'Тип участника': '参与方类型',
  'Юр. лицо / ИП / КФХ': '法人 / 个体工商户 / 农场',
  'Название организации': '组织名称',
  'ООО «АгроГрейн»': 'AgroGrain LLC',
  'Регион': '地区',
  'Тамбовская область': '坦波夫州',
  'Реквизиты и ответственный': '信息和负责人',
  'ИНН': '税号',
  '10 или 12 цифр': '10或12位数字',
  'КПП': '税务登记原因代码',
  '9 цифр (для юр. лица)': '法人为9位数字',
  'ОГРН / ОГРНИП': 'OGRN / OGRNIP',
  '13 или 15 цифр': '13或15位数字',
  'ФИО ответственного': '负责人姓名',
  'Иванов Иван Иванович': 'Ivan Ivanov',
  'Должность': '职位',
  'Директор / Уполномоченный': '董事 / 授权人',
  'Телефон': '电话',
  'Email': '邮箱',
  'Пароль': '密码',
  'Согласия': '确认',
  'Согласен с правилами платформы': '我接受平台规则',
  'Согласен на обработку персональных данных': '我同意处理个人数据',
  'Статусы проверки заявки': '申请审核状态',
  'Заявка создана': '申请已创建',
  'Ожидает проверки': '等待审核',
  'Требуется уточнение': '需要补充说明',
  'Допущен': '已准入',
  'Отклонён': '已拒绝',
  'Заблокирован': '已锁定',
  'Текущий статус заявки и причина уточнения видны участнику после отправки. Проверка участника — часть контролируемого запуска контура; внешние подтверждения ожидают подключения.': '提交后，参与方可看到当前申请状态和补充说明原因。参与方审核是进入工作闭环准入的一部分；外部确认将单独接入。',
  'Отправить заявку на проверку': '提交审核申请',
  'Уже есть доступ — войти': '已有访问权限 — 登录',
};

function findTarget() {
  if (typeof document === 'undefined') return null;
  for (const selector of TARGETS) {
    const target = document.querySelector<Element>(selector);
    if (target) return target;
  }
  return null;
}

function normalizeLanguage(code: LanguageCode): LanguageCode {
  return SUPPORTED_LANGUAGE_CODES.includes(code) ? code : 'ru';
}

function nextLanguage(current: LanguageCode): LanguageCode {
  const safeCurrent = normalizeLanguage(current);
  const index = SUPPORTED_LANGUAGE_CODES.indexOf(safeCurrent);
  return SUPPORTED_LANGUAGE_CODES[(index + 1) % SUPPORTED_LANGUAGE_CODES.length] ?? 'ru';
}

export function HeaderLanguageSwitch() {
  const [mounted, setMounted] = useState(false);
  const [target, setTarget] = useState<Element | null>(null);
  const [language, setLanguage] = useState<LanguageCode>('ru');
  const dictionaries = useMemo(() => ({ en: REGISTER_EN, zh: REGISTER_ZH }), []);

  useEffect(() => {
    setMounted(true);
    clearLegacyDictionaryCache();
    setLanguage(normalizeLanguage(readStoredLanguage()));
  }, []);

  useEffect(() => {
    return subscribeToLanguageChanges((next) => setLanguage(normalizeLanguage(next)));
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const sync = () => setTarget(findTarget());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', sync);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    applyTranslationToDom(language, dictionaries);
    return startTranslationObserver(() => language, () => dictionaries);
  }, [language, dictionaries, mounted]);

  const chooseNextLanguage = useCallback(() => {
    const nextCode = nextLanguage(language);
    writeStoredLanguage(nextCode);
    setLanguage(nextCode);
    applyTranslationToDom(nextCode, dictionaries);
  }, [dictionaries, language]);

  if (!mounted || typeof document === 'undefined') return null;

  const meta = getLanguageMeta(language);
  const next = getLanguageMeta(nextLanguage(language));
  const languagesCount = SUPPORTED_LANGUAGES.length;

  const node = (
    <span className='p7-header-lang' data-p7-no-translate='true'>
      <style>{css}</style>
      <button
        type='button'
        className='p7-header-lang-button'
        aria-label={`Язык ${meta.short}. Нажмите для переключения на ${next.short}. Всего языков: ${languagesCount}`}
        title={`Язык: ${meta.short}. Следующий: ${next.short}`}
        onClick={chooseNextLanguage}
        data-language={meta.short}
      >
        <Languages size={16} strokeWidth={2.45} aria-hidden='true' />
        <b>{meta.short}</b>
      </button>
    </span>
  );

  const portalTarget = target ?? document.body;
  return createPortal(target ? node : <span className='p7-header-lang p7-header-lang-fallback' data-p7-no-translate='true'><style>{css}</style>{node}</span>, portalTarget);
}

const css = `
.p7-register-actions .p7-register-action-exit{display:none!important}
.p7-header-lang{position:relative;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;z-index:3800}.p7-header-lang-button{inline-size:54px!important;min-inline-size:54px!important;max-inline-size:54px!important;block-size:42px!important;min-block-size:42px!important;max-block-size:42px!important;border-radius:14px!important;border:1px solid rgba(8,122,59,.22)!important;background:rgba(8,122,59,.08)!important;color:#087a3b!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:4px!important;padding:0!important;box-shadow:0 8px 20px rgba(7,22,17,.045)!important;cursor:pointer!important;appearance:none!important;-webkit-tap-highlight-color:transparent!important;white-space:nowrap!important}.p7-header-lang-button:hover{border-color:rgba(8,122,59,.34)!important;background:rgba(8,122,59,.12)}.p7-header-lang-button:focus-visible{outline:3px solid rgba(8,122,59,.30)!important;outline-offset:3px!important}.p7-header-lang-button b{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:19px!important;font-size:10.5px!important;font-weight:950!important;line-height:1!important;color:#075f32!important;letter-spacing:.02em!important}.p7-header-lang-fallback{position:fixed!important;right:12px!important;top:calc(env(safe-area-inset-top) + 12px)!important}.pc-site-actions .p7-header-lang,.pc-v4-actions .p7-header-lang,.p7-flow-actions .p7-header-lang,.p7-request-actions .p7-header-lang,.p7-contact-nav .p7-header-lang,.p7-register-actions .p7-header-lang{order:-5!important}.pc-v4-actions .p7-header-lang-button{background:var(--pc-bg-card)!important;border-color:var(--pc-border)!important;color:var(--pc-text-secondary)!important;box-shadow:var(--pc-shadow-sm)!important}.pc-v4-actions .p7-header-lang-button b{color:var(--pc-text-primary)!important}.login-header>.login-brand{order:1!important}.login-header>.p7-header-lang{order:2!important;margin-left:auto!important}.login-header>.login-back{order:3!important}.login-header>.p7-header-lang .p7-header-lang-button{inline-size:56px!important;min-inline-size:56px!important;max-inline-size:56px!important;block-size:56px!important;min-block-size:56px!important;max-block-size:56px!important;border-radius:18px!important;background:#fff!important;color:#087a3b!important;border-color:rgba(7,22,17,.1)!important;box-shadow:0 10px 26px rgba(7,22,17,.06)!important}.login-header>.p7-header-lang .p7-header-lang-button b{font-size:11px!important;color:#087a3b!important}@media(max-width:767px){.pc-site-actions{gap:6px!important}.pc-site-actions .entry-login{min-width:76px!important;height:40px!important;min-height:40px!important;padding:0 12px!important;font-size:14px!important}.pc-site-actions .entry-login svg{display:none!important}.pc-site-actions .entry-header-register{display:none!important}.p7-header-lang-button{inline-size:50px!important;min-inline-size:50px!important;max-inline-size:50px!important;block-size:40px!important;min-block-size:40px!important;max-block-size:40px!important;border-radius:13px!important}.p7-header-lang-button svg{width:15px!important;height:15px!important}.p7-header-lang-button b{display:inline-flex!important;font-size:10px!important;min-width:18px!important}.pc-v4-actions .p7-header-lang-button{inline-size:46px!important;min-inline-size:46px!important;max-inline-size:46px!important;block-size:38px!important;min-block-size:38px!important;max-block-size:38px!important}.login-header>.p7-header-lang .p7-header-lang-button{inline-size:52px!important;min-inline-size:52px!important;max-inline-size:52px!important;block-size:52px!important;min-block-size:52px!important;max-block-size:52px!important;border-radius:17px!important}.login-header>.p7-header-lang .p7-header-lang-button b{font-size:10px!important}}@media(max-width:374px){.p7-header-lang-button{inline-size:46px!important;min-inline-size:46px!important;max-inline-size:46px!important}.p7-header-lang-button svg{width:14px!important;height:14px!important}.p7-header-lang-button b{font-size:9.5px!important}.login-header>.p7-header-lang .p7-header-lang-button{inline-size:48px!important;min-inline-size:48px!important;max-inline-size:48px!important;block-size:48px!important;min-block-size:48px!important;max-block-size:48px!important}}
`;
