import { Languages } from 'lucide-react';

const LOCALES = [
  { code: 'ru', label: 'RU', language: 'Русский' },
  { code: 'en', label: 'EN', language: 'English' },
  { code: 'zh', label: 'ZH', language: '中文' },
] as const;

export function PublicLocaleSwitch() {
  return (
    <nav className='pc-site-locale-switch' aria-label='Язык / Language / 语言'>
      <Languages size={16} strokeWidth={2.35} aria-hidden='true' />
      <span className='pc-site-locale-options'>
        {LOCALES.map(({ code, label, language }) => (
          <a
            key={code}
            href={`?lang=${code}`}
            hrefLang={code === 'zh' ? 'zh-CN' : code}
            lang={code === 'zh' ? 'zh-CN' : code}
            aria-label={language}
            data-locale={code}
          >
            {label}
          </a>
        ))}
      </span>
    </nav>
  );
}
