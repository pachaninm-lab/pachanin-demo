'use client';

import Link from 'next/link';
import { ArrowUpRight, FilePenLine, LifeBuoy, Plus, Search, Settings, ShieldCheck, Trash2 } from 'lucide-react';
import { GEKTA_PATHS, type GektaLocale } from '@/lib/gekta/content';
import type { GektaProject } from '@/lib/gekta/projects';
import type { GektaConversation } from './GektaChatTypes';
import { GektaConversationList } from './GektaConversationList';
import { GektaBrandMark } from './GektaBrandMark';
import { GektaInstallButton } from './GektaInstallButton';
import { GektaProjectList } from './GektaProjectList';
import type { GektaDraft } from './useGektaDrafts';
import styles from './GektaWorkspace.module.css';

const UI = {
  ru: { brand: 'Гекта', newChat: 'Новый диалог', search: 'Поиск по истории', history: 'Диалоги', empty: 'Пока нет диалогов.', rename: 'Переименовать', del: 'Удалить', deleteDraft: 'Удалить этот черновик?', cancel: 'Отмена', conversationMenu: 'Действия с диалогом', settings: 'Настройки', productHome: 'Главная Гекты', info: 'Данные и безопасность', back: 'Прозрачная Цена', support: 'Поддержка', moveTo: 'Проект', noProject: 'Без проекта', searching: 'Ищем в истории аккаунта…', searchFailed: 'Поиск не выполнен. Повтори запрос.', searchEmpty: 'Ничего не найдено.' },
  en: { brand: 'Gekta', newChat: 'New chat', search: 'Search history', history: 'Chats', empty: 'No chats yet.', rename: 'Rename', del: 'Delete', deleteDraft: 'Delete this draft?', cancel: 'Cancel', conversationMenu: 'Conversation actions', settings: 'Settings', productHome: 'Gekta home', info: 'Data and security', back: 'Prozrachnaya Tsena', support: 'Support', moveTo: 'Project', noProject: 'No project', searching: 'Searching the account history…', searchFailed: 'Search failed. Try again.', searchEmpty: 'Nothing found.' },
  zh: { brand: 'Gekta', newChat: '新对话', search: '搜索历史', history: '对话', empty: '暂无对话。', rename: '重命名', del: '删除', deleteDraft: '删除此草稿？', cancel: '取消', conversationMenu: '对话操作', settings: '设置', productHome: 'Gekta 主页', info: '数据与安全', back: '透明价格', support: '支持', moveTo: '项目', noProject: '不属于项目', searching: '正在搜索账户历史…', searchFailed: '搜索失败，请重试。', searchEmpty: '未找到任何内容。' },
} as const;

const NAV_ITEM = 'mt-1 flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left text-sm text-slate-700 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700';

function utilityRoute(locale: GektaLocale, page: 'security' | 'support'): string {
  const base = GEKTA_PATHS[locale];
  return `${base}/${page}`;
}

export function GektaSidebar({ locale, conversations, projects, hasHistory, hasProjects, drafts, onDraft, onDeleteDraft, activeId, activeProjectId, search, searchState, projectCounts, onSearch, onNew, onSelect, onRename, onDelete, onSettings, onInstall, onProjectCreate, onProjectRename, onProjectDelete, onProjectOpen, onConversationProject, drawerStatus }: {
  hasHistory: boolean;
  hasProjects: boolean;
  drafts: readonly GektaDraft[];
  onDraft: (id: string) => void;
  onDeleteDraft: (id: string) => void;
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
  onSettings: (opener: HTMLButtonElement) => void;
  onInstall?: () => void;
  onProjectCreate: (name: string, description: string) => void;
  onProjectRename: (id: string, name: string) => void;
  onProjectDelete: (id: string) => void;
  onProjectOpen: (id: string | null) => void;
  onConversationProject: (conversationId: string, projectId: string | null) => void;
  drawerStatus?: React.ReactNode;
}) {
  const ui = UI[locale];
  const draftLabel = { ru: 'Черновик', en: 'Draft', zh: '草稿' }[locale];
  const navigation = (
    <div className='mt-4 border-t border-slate-200 pt-3'>
      <button type='button' onClick={(event) => onSettings(event.currentTarget)} className={NAV_ITEM} data-gekta-open-settings='true'>
        <Settings className='h-4 w-4 text-slate-500' aria-hidden='true' />{ui.settings}
      </button>
      <Link href={utilityRoute(locale, 'security')} className={NAV_ITEM}>
        <ShieldCheck className='h-4 w-4 text-emerald-700' aria-hidden='true' />{ui.info}
      </Link>
      <Link href='/platform-v7' className={NAV_ITEM}>
        <ArrowUpRight className='h-4 w-4 text-slate-500' aria-hidden='true' />{ui.back}
      </Link>
      <Link href={utilityRoute(locale, 'support')} className={NAV_ITEM}>
        <LifeBuoy className='h-4 w-4 text-slate-500' aria-hidden='true' />{ui.support}
      </Link>
    </div>
  );

  return (
    <div className='flex h-full min-h-0 flex-col bg-[#f6f5ef] p-4'>
      <Link href={GEKTA_PATHS[locale]} aria-label={ui.productHome} className={`${styles.brand} min-h-11 rounded-xl text-slate-950`}>
        <GektaBrandMark />{ui.brand}
      </Link>

      <button type='button' onClick={onNew} className='mt-4 flex min-h-11 items-center gap-2 rounded-xl bg-emerald-800 px-3.5 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'>
        <Plus className='h-4 w-4' aria-hidden='true' />{ui.newChat}
      </button>

      {hasHistory || hasProjects || search ? <label className='relative mt-3 block'>
        <span className='sr-only'>{ui.search}</span>
        <Search className='pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400' aria-hidden='true' />
        <input type='search' value={search} onChange={(event) => onSearch(event.target.value)} placeholder={ui.search} className='min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100' />
      </label> : null}

      <p className='mt-1 px-2 text-sm text-slate-500' role='status' aria-live='polite' data-gekta-search-state={searchState ?? 'idle'}>
        {searchState === 'loading' ? ui.searching : null}
        {searchState === 'error' ? ui.searchFailed : null}
        {searchState === 'idle' && search.trim() && !conversations.length && !drafts.length && !projects.length ? ui.searchEmpty : null}
      </p>

      <div className='mt-1 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1'>
        {hasHistory ? <section className='mt-3' aria-label={ui.history}>
          <h2 className='px-2 text-sm font-semibold text-slate-700'>{ui.history}</h2>
          <div className='mt-2'>
            {drafts.map((draft) => <div key={draft.id} className='flex items-center gap-1'>
              <button type='button' onClick={() => onDraft(draft.id)} className='flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left text-sm hover:bg-white'>
                <FilePenLine size={16} aria-hidden='true' className='shrink-0 text-emerald-800' />
                <span className='min-w-0'><span className='block text-xs text-slate-600'>{draftLabel}</span><span className='block truncate'>{draft.text}</span></span>
              </button>
              <button type='button' onClick={() => { if (window.confirm(ui.deleteDraft)) onDeleteDraft(draft.id); }} className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-white' aria-label={ui.del + ' · ' + draftLabel + ' · ' + draft.text.slice(0, 40)}><Trash2 size={15} aria-hidden='true' /></button>
            </div>)}
            {(search.trim() || drafts.length) && !conversations.length ? null : <GektaConversationList
              conversations={conversations}
              projects={projects}
              activeId={activeId}
              emptyLabel={ui.empty}
              renameLabel={ui.rename}
              deleteLabel={ui.del}
              cancelLabel={ui.cancel}
              menuLabel={ui.conversationMenu}
              projectLabel={ui.moveTo}
              noProjectLabel={ui.noProject}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onProject={onConversationProject}
            />}
          </div>
        </section> : null}
        <GektaProjectList
          locale={locale}
          projects={projects}
          hasProjects={hasProjects}
          activeProjectId={activeProjectId}
          conversationCounts={projectCounts}
          onCreate={onProjectCreate}
          onRename={onProjectRename}
          onDelete={onProjectDelete}
          onOpen={onProjectOpen}
        />
        <div className='lg:hidden'>
          {navigation}
          {drawerStatus}
        </div>
      </div>

      <div className='hidden lg:block'>{navigation}</div>
      {onInstall ? (
        <div className='mt-2 shrink-0 border-t border-slate-200 pt-1'>
          <GektaInstallButton locale={locale} onInstall={onInstall} menuClassName={NAV_ITEM} />
        </div>
      ) : null}
    </div>
  );
}
