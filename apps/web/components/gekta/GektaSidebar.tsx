'use client';

import Link from 'next/link';
import { ArrowUpRight, Home, LifeBuoy, Plus, Search, Settings, ShieldCheck, Trash2 } from 'lucide-react';
import { GEKTA_PATHS, type GektaLocale } from '@/lib/gekta/content';
import type { GektaProject } from '@/lib/gekta/projects';
import type { GektaConversation } from './GektaChatTypes';
import { GektaConversationList } from './GektaConversationList';
import { GektaProjectList } from './GektaProjectList';

const UI = {
  ru: { brand: 'ГЕКТА', descriptor: 'Аграрный интеллект', maker: 'Продукт экосистемы «Прозрачная Цена»', newChat: 'Новый диалог', search: 'Поиск по истории', history: 'История диалогов', empty: 'Здесь появятся сохранённые в этом браузере диалоги.', rename: 'Переименовать', del: 'Удалить', clear: 'Очистить историю', settings: 'Настройки', productHome: 'Главная Гекты', info: 'Данные и безопасность', back: 'Перейти в «Прозрачную Цену»', support: 'Поддержка', moveTo: 'Проект', noProject: 'Без проекта', privacy: 'История анонимного режима хранится только в этом браузере. Не отправляй секреты, пароли и токены.', searching: 'Ищем в истории аккаунта…', searchFailed: 'Поиск не выполнен. Повтори запрос.', searchEmpty: 'Ничего не найдено.' },
  en: { brand: 'GEKTA', descriptor: 'Agricultural intelligence', maker: 'A Prozrachnaya Tsena ecosystem product', newChat: 'New chat', search: 'Search history', history: 'Conversation history', empty: 'Conversations saved in this browser will appear here.', rename: 'Rename', del: 'Delete', clear: 'Clear history', settings: 'Settings', productHome: 'Gekta home', info: 'Data and security', back: 'Open Prozrachnaya Tsena', support: 'Support', moveTo: 'Project', noProject: 'No project', privacy: 'Anonymous history is stored only in this browser. Do not send secrets, passwords or tokens.', searching: 'Searching the account history…', searchFailed: 'Search failed. Try again.', searchEmpty: 'Nothing found.' },
  zh: { brand: 'GEKTA', descriptor: '农业智能', maker: '“透明价格”生态产品', newChat: '新对话', search: '搜索历史', history: '对话历史', empty: '保存在此浏览器中的对话会显示在这里。', rename: '重命名', del: '删除', clear: '清除历史', settings: '设置', productHome: 'Gekta 主页', info: '数据与安全', back: '前往“透明价格”', support: '支持', moveTo: '项目', noProject: '不属于项目', privacy: '匿名模式的历史记录仅保存在此浏览器。请勿发送秘密、密码或令牌。', searching: '正在搜索账户历史…', searchFailed: '搜索失败，请重试。', searchEmpty: '未找到任何内容。' },
} as const;

const NAV_ITEM = 'mt-1 flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left text-sm text-slate-700 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700';

function utilityRoute(locale: GektaLocale, page: 'security' | 'support'): string {
  const base = GEKTA_PATHS[locale];
  return `${base}/${page}`;
}

export function GektaSidebar({ locale, conversations, projects, activeId, activeProjectId, search, searchState, projectCounts, onSearch, onNew, onSelect, onRename, onDelete, onClear, onSettings, onProjectCreate, onProjectRename, onProjectDelete, onProjectOpen, onConversationProject }: {
  locale: GektaLocale;
  conversations: readonly GektaConversation[];
  projects: readonly GektaProject[];
  activeId: string | null;
  activeProjectId: string | null;
  search: string;
  searchState?: 'idle' | 'loading' | 'error';
  projectCounts: Readonly<Record<string, number>>;
  onSearch: (value: string) => void;
  onNew: () => void;
  onSelect: (conversation: GektaConversation) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onSettings: () => void;
  onProjectCreate: (name: string, description: string) => void;
  onProjectRename: (id: string, name: string) => void;
  onProjectDelete: (id: string) => void;
  onProjectOpen: (id: string | null) => void;
  onConversationProject: (conversationId: string, projectId: string | null) => void;
}) {
  const ui = UI[locale];
  const navigation = (
    <div className='mt-4 border-t border-slate-200 pt-3'>
      <button type='button' onClick={onSettings} className={NAV_ITEM} data-gekta-open-settings='true'>
        <Settings className='h-4 w-4 text-slate-500' aria-hidden='true' />{ui.settings}
      </button>
      <Link href={GEKTA_PATHS[locale]} className={NAV_ITEM}>
        <Home className='h-4 w-4 text-emerald-700' aria-hidden='true' />{ui.productHome}
      </Link>
      <Link href={utilityRoute(locale, 'security')} className={NAV_ITEM}>
        <ShieldCheck className='h-4 w-4 text-emerald-700' aria-hidden='true' />{ui.info}
      </Link>
      <Link href='/platform-v7' className={NAV_ITEM}>
        <ArrowUpRight className='h-4 w-4 text-slate-500' aria-hidden='true' />{ui.back}
      </Link>
      <Link href={utilityRoute(locale, 'support')} className={NAV_ITEM}>
        <LifeBuoy className='h-4 w-4 text-slate-500' aria-hidden='true' />{ui.support}
      </Link>
      {conversations.length ? (
        <button type='button' onClick={onClear} className='mt-2 flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left text-sm text-rose-700 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700'>
          <Trash2 className='h-4 w-4' aria-hidden='true' />{ui.clear}
        </button>
      ) : null}
      <p className='mt-2 px-2 pb-2 text-[10px] leading-4 text-slate-500'>{ui.privacy}</p>
    </div>
  );

  return (
    <div className='flex h-full min-h-0 flex-col bg-[#f6f5ef] p-3'>
      <Link href={GEKTA_PATHS[locale]} className='rounded-xl px-2 pt-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'>
        <span className='block text-lg font-black tracking-[0.14em] text-slate-950'>{ui.brand}</span>
        <span className='mt-1 block text-xs font-semibold text-emerald-800'>{ui.descriptor}</span>
        <span className='mt-1 block text-[11px] leading-4 text-slate-500'>{ui.maker}</span>
      </Link>

      <button type='button' onClick={onNew} className='mt-4 flex min-h-11 items-center gap-2 rounded-xl bg-emerald-800 px-3.5 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'>
        <Plus className='h-4 w-4' aria-hidden='true' />{ui.newChat}
      </button>

      <label className='relative mt-3 block'>
        <span className='sr-only'>{ui.search}</span>
        <Search className='pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400' aria-hidden='true' />
        <input type='search' value={search} onChange={(event) => onSearch(event.target.value)} placeholder={ui.search} className='min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100' />
      </label>

      <p className='mt-1 min-h-4 px-2 text-xs text-slate-500' role='status' aria-live='polite' data-gekta-search-state={searchState ?? 'idle'}>
        {searchState === 'loading' ? ui.searching : null}
        {searchState === 'error' ? ui.searchFailed : null}
        {searchState === 'idle' && search.trim() && conversations.length === 0 ? ui.searchEmpty : null}
      </p>

      <div className='mt-1 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1'>
        <GektaProjectList
          locale={locale}
          projects={projects}
          activeProjectId={activeProjectId}
          conversationCounts={projectCounts}
          onCreate={onProjectCreate}
          onRename={onProjectRename}
          onDelete={onProjectDelete}
          onOpen={onProjectOpen}
        />

        <section className='mt-5' aria-labelledby='gekta-history-heading'>
          <h2 id='gekta-history-heading' className='px-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500'>{ui.history}</h2>
          <div className='mt-2'>
            <GektaConversationList
              conversations={conversations}
              projects={projects}
              activeId={activeId}
              emptyLabel={ui.empty}
              renameLabel={ui.rename}
              deleteLabel={ui.del}
              projectLabel={ui.moveTo}
              noProjectLabel={ui.noProject}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onProject={onConversationProject}
            />
          </div>
        </section>
        <div className='md:hidden'>{navigation}</div>
      </div>

      <div className='hidden md:block'>{navigation}</div>
    </div>
  );
}
