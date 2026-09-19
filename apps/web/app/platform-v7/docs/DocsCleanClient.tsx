'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, BadgeCheck, FileCheck2, Landmark, Scale, ShieldCheck, Truck, Wheat } from 'lucide-react';

// Копия — в apps/web/messages/*.json (namespace `docs`); en/zh генерируются
// из ru по общему словарю (pnpm i18n:messages).
const items = [
  { key: 'sdiz', Icon: FileCheck2 },
  { key: 'transport', Icon: Truck },
  { key: 'acts', Icon: BadgeCheck },
  { key: 'quality', Icon: ShieldCheck },
  { key: 'basis', Icon: Landmark },
  { key: 'dispute', Icon: Scale },
] as const;

export function DocsCleanClient(){
  const t = useTranslations('docs');
  const lang = useLocale();
  return <main className='p7-docs-clean' data-lang={lang} data-p7-no-translate='true'><style>{css}</style><header><Link href='/platform-v7' className='brand'><span><Wheat size={24}/></span><strong>{t('brand')}</strong></Link><nav><Link href='/platform-v7/demo'>{t('demo')}</Link><Link href='/platform-v7/contact'>{t('contact')}</Link><Link href='/platform-v7/register'>{t('connect')}</Link></nav></header><section className='hero'><span>{t('kicker')}</span><h1>{t('title')}</h1><p>{t('lead')}</p><div><Link href='/platform-v7/demo'>{t('demo')}<ArrowRight size={18}/></Link><Link href='/platform-v7/contact'>{t('contact')}</Link></div></section><section className='grid'>{items.map(({key,Icon})=><article key={key}><Icon size={26}/><strong>{t(`items.${key}.title`)}</strong><p>{t(`items.${key}.text`)}</p></article>)}</section><section className='note'><h2>{t('boundary')}</h2><p>{t('boundaryText')}</p></section></main>
}
const css=`.p7-docs-clean{min-height:100svh;padding:12px clamp(14px,4vw,56px) 42px;color:#071611;background:linear-gradient(180deg,#fbfcf9,#f3f7f1 56%,#fff);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.p7-docs-clean *{box-sizing:border-box}.p7-docs-clean a{text-decoration:none;color:inherit}.p7-docs-clean header{position:sticky;top:10px;z-index:20;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;min-height:62px;padding:10px 12px 10px 14px;border:1px solid rgba(7,22,17,.08);border-radius:24px;background:rgba(255,255,255,.93);box-shadow:0 16px 42px rgba(7,22,17,.08)}.brand{display:inline-flex;align-items:center;gap:10px;font-weight:950}.brand span{display:grid;place-items:center;width:40px;height:40px;border-radius:14px;color:#087a3b;background:rgba(0,122,47,.08)}nav{display:flex;gap:8px}nav a,.hero a{min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 14px;border-radius:14px;border:1px solid rgba(7,22,17,.1);font-size:13px;font-weight:900}nav a:last-child,.hero a:first-child{color:#fff;background:#087a3b;border-color:#087a3b}.hero,.note{margin-top:24px;border:1px solid rgba(7,22,17,.075);border-radius:32px;background:rgba(255,255,255,.82);box-shadow:0 18px 48px rgba(7,22,17,.065)}.hero{padding:clamp(24px,4vw,48px)}.hero>span{display:inline-flex;margin-bottom:14px;padding:8px 12px;border-radius:999px;background:rgba(0,122,47,.08);color:#087a3b;font-size:11px;font-weight:950;text-transform:uppercase}.hero h1{margin:0;font-size:clamp(34px,5.3vw,72px);line-height:1;letter-spacing:-.058em}.hero p,article p,.note p{color:#4e5d56;font-size:16px;line-height:1.5;font-weight:640}.hero div{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:18px}article{min-height:190px;padding:19px;border:1px solid rgba(7,22,17,.075);border-radius:24px;background:#fff;box-shadow:0 14px 34px rgba(7,22,17,.055);display:grid;align-content:start;gap:10px}article svg{color:#087a3b}article strong{font-size:18px;font-weight:950}.note{padding:24px}.note h2{margin:0;font-size:clamp(26px,3vw,42px);line-height:1.04;letter-spacing:-.048em}.p7-docs-clean[data-lang='zh']{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Noto Sans SC','Microsoft YaHei','Segoe UI',sans-serif}.p7-docs-clean[data-lang='zh'] *{letter-spacing:0!important;word-break:keep-all;overflow-wrap:anywhere}.p7-docs-clean[data-lang='zh'] h1,.p7-docs-clean[data-lang='zh'] h2{line-height:1.12}.p7-docs-clean[data-lang='zh'] p{line-height:1.62}@media(max-width:980px){header{grid-template-columns:1fr}nav{display:grid;grid-template-columns:1fr 1fr 1fr}.grid{grid-template-columns:1fr 1fr}}@media(max-width:620px){.grid,nav{grid-template-columns:1fr}.hero,.note{border-radius:26px;padding:20px}.hero h1{font-size:34px}}`;
