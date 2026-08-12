'use client';

import Link from 'next/link';
import { Info, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import type { GektaLocale } from '@/lib/gekta/content';
import type { GektaConversation } from './GektaChatTypes';
import { GektaConversationList } from './GektaConversationList';

const UI = {
  ru: { brand: 'ГЕКТА', descriptor: 'Аграрный интеллект', maker: 'Продукт экосистемы «Прозрачная Цена»', newChat: 'Новый диалог', search: 'Поиск по истории', empty: 'Здесь появятся сохранённые в этом браузере диалоги.', rename: 'Переименовать', del: 'Удалить', clear: 'Очистить историю', language: 'Язык', info: 'Данные и безопасность', back: '«Прозрачная Цена»', privacy: 'История анонимного режима хранится только в этом браузере. Не отправляй секреты, пароли и токены.' },
  en: { brand: 'GEKTA', descriptor: 'Agricultural intelligence', maker: 'A Prozrachnaya Tsena ecosystem product', newChat: 'New chat', search: 'Search history', empty: 'Conversations saved in this browser will appear here.', rename: 'Rename', del: 'Delete', clear: 'Clear history', language: 'Language', info: 'Data and security', back: 'Prozrachnaya Tsena', privacy: 'Anonymous history is stored only in this browser. Do not send secrets, passwords or tokens.' },
  zh: { brand: 'GEKTA', descriptor: '农业智能', maker: '“透明价格”生态产品', newChat: '新对话', search: '搜索历史', empty: '保存在此浏览器中的对话会显示在这里。', rename: '重命名', del: '删除', clear: '清除历史', language: '语言', info: '数据与安全', back: '“透明价格”', privacy: '匿名模式的历史记录仅保存在此浏览器。请勿发送秘密、密码或令牌。' },
} as const;

export function GektaSidebar({ locale, conversations, activeId, search, onSearch, onNew, onSelect, onRename, onDelete, onClear, onLocale }: {
  locale: GektaLocale;
  conversations: readonly GektaConversation[];
  activeId: string | null;
  search: string;
  onSearch: (value: string) => void;
  onNew: () => void;
  onSelect: (conversation: GektaConversation) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onLocale: (locale: GektaLocale) => void;
}) {
  const ui = UI[locale];
  return (
    <div className='flex h-full min-h-0 flex-col bg-[#f6f5ef] p-3'>
      <div className='px-2 pt-2'><div className='text-lg font-black tracking-[0.14em] text-slate-950'>{ui.brand}</div><div className='mt-1 text-xs font-semibold text-emerald-800'>{ui.descriptor}</div><div className='mt-1 text-[11px] leading-4 text-slate-500'>{ui.maker}</div></div>
      <button type='button' onClick={onNew} className='mt-5 flex min-h-11 items-center gap-2 rounded-xl bg-emerald-800 px-3.5 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'><Plus className='h-4 w-4' aria-hidden='true' />{ui.newChat}</button>
      <label className='relative mt-3 block'><span className='sr-only'>{ui.search}</span><Search className='pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400' aria-hidden='true' /><input type='search' value={search} onChange={(event) => onSearch(event.target.value)} placeholder={ui.search} className='min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500' /></label>
      <div className='mt-3 min-h-0 flex-1 overflow-y-auto pr-1'><GektaConversationList conversations={conversations} activeId={activeId} emptyLabel={ui.empty} renameLabel={ui.rename} deleteLabel={ui.del} onSelect={onSelect} onRename={onRename} onDelete={onDelete} /></div>
      <div className='mt-3 border-t border-slate-200 pt-3'>
        <label className='flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-slate-700'><span className='text-xs font-semibold text-slate-500'>{ui.language}</span><select value={locale} onChange={(event) => onLocale(event.target.value as GektaLocale)} className='ml-auto min-h-11 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm'><option value='ru'>RU</option><option value='en'>EN</option><option value='zh'>中文</option></select></label>
        <Link href='/platform-v7/trust' className='mt-1 flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-slate-700 hover:bg-white'><ShieldCheck className='h-4 w-4 text-emerald-700' aria-hidden='true' />{ui.info}</Link>
        <Link href='/platform-v7' className='mt-1 flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-slate-700 hover:bg-white'><Info className='h-4 w-4 text-slate-500' aria-hidden='true' />{ui.back}</Link>
        {conversations.length ? <button type='button' onClick={onClear} className='mt-1 flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-rose-700 hover:bg-rose-50'><Trash2 className='h-4 w-4' aria-hidden='true' />{ui.clear}</button> : null}
        <p className='mt-2 px-2 text-[10px] leading-4 text-slate-500'>{ui.privacy}</p>
      </div>
    </div>
  );
}
