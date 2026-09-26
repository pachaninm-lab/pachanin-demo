import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type ContactResult = 'delivered' | 'failed';

export const CONTACT_RESULT_COOKIE = 'pc_contact_result_v1';
export const CONTACT_RESULT_TTL_SECONDS = 5 * 60;

const NONCE_PATTERN = /^[A-Za-z0-9_-]{24}$/u;
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/u;
const MAX_TOKEN_LENGTH = 256;
const MAX_CLOCK_SKEW_SECONDS = 30;

function rootSecret(environment: NodeJS.ProcessEnv = process.env): string | null {
  const configured = environment === process.env
    ? process.env.CONTACT_RESULT_HMAC_SECRET
    : environment.CONTACT_RESULT_HMAC_SECRET;
  const secret = String(configured || '').trim();
  return /^[A-Za-z0-9_-]{43,128}$/u.test(secret) ? secret : null;
}

function unsigned(result: ContactResult, issuedAt: number, expiresAt: number, nonce: string): string {
  return ['v1', result, String(issuedAt), String(expiresAt), nonce].join('.');
}

function signature(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value, 'utf8').digest('hex');
}

export function createContactResultReceipt(
  result: ContactResult,
  nowSeconds = Math.floor(Date.now() / 1000),
  environment: NodeJS.ProcessEnv = process.env,
  nonce = randomBytes(18).toString('base64url'),
): string | null {
  const secret = rootSecret(environment);
  if (!secret || !Number.isSafeInteger(nowSeconds) || nowSeconds < 0 || !NONCE_PATTERN.test(nonce)) return null;
  const expiresAt = nowSeconds + CONTACT_RESULT_TTL_SECONDS;
  const value = unsigned(result, nowSeconds, expiresAt, nonce);
  return `${value}.${signature(value, secret)}`;
}

export function verifyContactResultReceipt(
  token: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
  environment: NodeJS.ProcessEnv = process.env,
): ContactResult | null {
  const secret = rootSecret(environment);
  if (!secret || typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 0) return null;

  const parts = token.split('.');
  if (parts.length !== 6) return null;
  const [version, resultRaw, issuedRaw, expiresRaw, nonce, provided] = parts;
  if (version !== 'v1' || (resultRaw !== 'delivered' && resultRaw !== 'failed')) return null;
  if (!/^(?:0|[1-9][0-9]{0,12})$/u.test(issuedRaw) || !/^(?:0|[1-9][0-9]{0,12})$/u.test(expiresRaw)) return null;
  if (!NONCE_PATTERN.test(nonce) || !SIGNATURE_PATTERN.test(provided)) return null;

  const issuedAt = Number(issuedRaw);
  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt)) return null;
  if (expiresAt - issuedAt !== CONTACT_RESULT_TTL_SECONDS) return null;
  if (issuedAt > nowSeconds + MAX_CLOCK_SKEW_SECONDS || expiresAt <= nowSeconds) return null;

  const value = parts.slice(0, 5).join('.');
  const expected = signature(value, secret);
  const actualBuffer = Buffer.from(provided, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  return resultRaw;
}

export function contactResultFromRequest(
  query: Readonly<Record<string, unknown>>,
  cookieValue: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
  environment: NodeJS.ProcessEnv = process.env,
): ContactResult | null {
  // User-controlled sent/error values have no result authority. The marker only
  // asks the server to inspect a short-lived HttpOnly receipt from this browser.
  if (query.receipt !== '1') return null;
  return verifyContactResultReceipt(cookieValue, nowSeconds, environment);
}

export function contactResultCookieOptions(environment: NodeJS.ProcessEnv = process.env) {
  return {
    httpOnly: true,
    secure: environment.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/platform-v7/contact',
    maxAge: CONTACT_RESULT_TTL_SECONDS,
  };
}

export type NativeContactDraft = Readonly<{
  type: string;
  name: string;
  organization: string;
  contact: string;
  message: string;
  consent: string;
}>;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

/** Native POST fallback: render the draft in the response, without storing PII or redirecting. */
export function renderNativeContactResult(
  locale: 'ru' | 'en' | 'zh',
  outcome: 'delivered' | 'invalid' | 'unknown',
  draft?: NativeContactDraft | null,
): string {
  const copy = {
    ru: {
      delivered: 'Обращение отправлено', invalid: 'Проверьте данные обращения', unknown: 'Отправка не подтверждена',
      deliveredText: 'Для ответа используем указанный вами контакт.',
      invalidText: 'Данные сохранены в форме ниже. Исправьте их и отправьте обращение повторно.',
      unknownText: 'Данные сохранены в форме ниже. Перед повторной отправкой позвоните нам, чтобы избежать дубликата.',
      type: 'Тема обращения', name: 'Имя', organization: 'Организация', contact: 'Телефон или электронная почта',
      message: 'Содержание обращения', consent: 'Согласен на обработку указанных данных для рассмотрения обращения и ответа.',
      send: 'Отправить обращение', back: 'Вернуться к контактам',
      types: ['Общий вопрос по платформе', 'Помощь с подключением организации', 'Банк или партнёр', 'Региональное взаимодействие', 'Техническое подключение', 'Другое обращение'],
    },
    en: {
      delivered: 'Inquiry sent', invalid: 'Check the inquiry details', unknown: 'Submission not confirmed',
      deliveredText: 'We will use the contact details you provided to reply.',
      invalidText: 'Your entries remain in the form below. Correct them and submit again.',
      unknownText: 'Your entries remain in the form below. Please call before sending again to avoid a duplicate.',
      type: 'Inquiry type', name: 'Name', organization: 'Organisation', contact: 'Phone or email',
      message: 'Message', consent: 'I consent to processing these details to review my inquiry and reply.',
      send: 'Send inquiry', back: 'Back to contact page',
      types: ['General platform question', 'Organisation connection assistance', 'Bank or partner', 'Regional cooperation', 'Technical connection', 'Other inquiry'],
    },
    zh: {
      delivered: '咨询已发送', invalid: '请检查咨询信息', unknown: '尚未确认发送结果',
      deliveredText: '我们将通过您提供的联系方式回复。',
      invalidText: '所填内容保留在下方表单中。请修改后重新发送。',
      unknownText: '所填内容保留在下方表单中。再次发送前请先电话联系，以免重复提交。',
      type: '咨询主题', name: '姓名', organization: '机构', contact: '电话或电子邮箱',
      message: '咨询内容', consent: '我同意处理所填信息以审核咨询并回复。',
      send: '发送咨询', back: '返回联系页面',
      types: ['平台一般问题', '机构接入协助', '银行或合作伙伴', '区域协作', '技术接入', '其他咨询'],
    },
  }[locale];
  const message = outcome === 'delivered' ? copy.deliveredText : outcome === 'invalid' ? copy.invalidText : copy.unknownText;
  const names = ['platform', 'pilot', 'bank_partner', 'region', 'technical', 'other'];
  const optionMarkup = names.map((name, index) =>
    `<option value="${name}"${draft?.type === name ? ' selected' : ''}>${copy.types[index]}</option>`,
  ).join('');
  const fields = outcome === 'delivered' ? '' : `<form method="post" action="/api/platform-v7/inquiries">
    <input type="hidden" name="source" value="platform_v7_contact_page"><input type="hidden" name="locale" value="${locale}">
    <label>${copy.type}<select name="type" required>${optionMarkup}</select></label>
    <label>${copy.name} *<input name="name" autocomplete="name" minlength="2" maxlength="80" required value="${escapeHtml(draft?.name ?? '')}"></label>
    <label>${copy.organization}<input name="organization" autocomplete="organization" maxlength="120" value="${escapeHtml(draft?.organization ?? '')}"></label>
    <label>${copy.contact} *<input name="contact" autocomplete="email" minlength="5" maxlength="120" required value="${escapeHtml(draft?.contact ?? '')}"></label>
    <label>${copy.message} *<textarea name="message" maxlength="2000" required>${escapeHtml(draft?.message ?? '')}</textarea></label>
    <label class="consent"><input type="checkbox" name="consent" value="yes" required${draft?.consent === 'yes' ? ' checked' : ''}>${copy.consent} <a href="/platform-v7/privacy?lang=${locale}">${locale === 'ru' ? 'Политика конфиденциальности' : locale === 'en' ? 'Privacy policy' : '隐私政策'}</a></label>
    <input name="website" class="trap" tabindex="-1" autocomplete="off" aria-hidden="true"><button type="submit">${copy.send}</button>
  </form>`;
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${copy[outcome]}</title>
  <style>body{margin:0;background:#f3f9f4;color:#17372b;font:16px/1.5 system-ui,sans-serif}main{max-width:680px;margin:5vh auto;padding:24px;background:#fff;border:1px solid #d3e3d8;border-radius:16px}h1{font-size:clamp(28px,5vw,38px);line-height:1.15}form,label{display:grid;gap:8px}form{gap:18px;margin-top:24px}input,select,textarea,button{box-sizing:border-box;width:100%;min-height:48px;padding:10px 12px;font:inherit;border:1px solid #718e7e;border-radius:9px}textarea{min-height:120px}.consent{display:flex;align-items:flex-start}.consent input{width:24px;min-height:24px;flex:none}button{background:#0b6046;color:#fff;border:0;cursor:pointer}a{color:#0b6046}.trap{position:absolute;left:-9999px}@media(max-width:720px){main{margin:0;min-height:100vh;border:0;border-radius:0;padding:20px}}</style></head>
  <body><main><h1>${copy[outcome]}</h1><p>${message}</p><p><a href="tel:+79162778989">+7 916 277-89-89</a> · <a href="/platform-v7/contact?lang=${locale}">${copy.back}</a></p>${fields}</main></body></html>`;
}
