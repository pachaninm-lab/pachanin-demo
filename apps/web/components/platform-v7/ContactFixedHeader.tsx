import { CanonicalPublicHeader, canonicalPublicLocale } from './PublicCanonicalPrimitives';

const SKIP={ru:'Перейти к содержанию',en:'Skip to content',zh:'跳到主要内容'} as const;

export function ContactFixedHeader({ locale }: { locale: string }) {
  const lang=canonicalPublicLocale(locale);
  return (
    <>
      <a className='pc-skip-link' href='#main-content'>{SKIP[lang]}</a>
      <CanonicalPublicHeader locale={lang} />
    </>
  );
}
