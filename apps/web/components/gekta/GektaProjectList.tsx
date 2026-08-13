'use client';

import * as React from 'react';
import { FolderOpen, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import type { GektaLocale } from '@/lib/gekta/content';
import { GEKTA_PROJECT_LIMITS, type GektaProject } from '@/lib/gekta/projects';

const UI = {
  ru: {
    title: 'Проекты',
    create: 'Новый проект',
    namePlaceholder: 'Название проекта',
    descriptionPlaceholder: 'Краткое описание (необязательно)',
    addDescription: 'Добавить описание',
    save: 'Создать',
    cancel: 'Отмена',
    rename: 'Переименовать',
    del: 'Удалить',
    empty: 'Проектов пока нет. Соберите в проект диалоги по одной теме.',
    chats: (count: number) => `${count} ${count === 1 ? 'диалог' : count < 5 ? 'диалога' : 'диалогов'}`,
    renamePrompt: 'Новое название проекта',
    deleteConfirm: 'Удалить проект? Диалоги останутся в общей истории.',
    all: 'Все диалоги',
  },
  en: {
    title: 'Projects',
    create: 'New project',
    namePlaceholder: 'Project name',
    descriptionPlaceholder: 'Short description (optional)',
    addDescription: 'Add description',
    save: 'Create',
    cancel: 'Cancel',
    rename: 'Rename',
    del: 'Delete',
    empty: 'No projects yet. Group conversations on one topic into a project.',
    chats: (count: number) => `${count} ${count === 1 ? 'chat' : 'chats'}`,
    renamePrompt: 'New project name',
    deleteConfirm: 'Delete this project? Its conversations stay in the history.',
    all: 'All conversations',
  },
  zh: {
    title: '项目',
    create: '新建项目',
    namePlaceholder: '项目名称',
    descriptionPlaceholder: '简要说明（可选）',
    addDescription: '添加说明',
    save: '创建',
    cancel: '取消',
    rename: '重命名',
    del: '删除',
    empty: '还没有项目。可以把同一主题的对话归入一个项目。',
    chats: (count: number) => `${count} 个对话`,
    renamePrompt: '新的项目名称',
    deleteConfirm: '删除该项目？其中的对话仍保留在历史记录中。',
    all: '全部对话',
  },
} as const;

export function GektaProjectList({ locale, projects, activeProjectId, conversationCounts, onCreate, onRename, onDelete, onOpen }: {
  locale: GektaLocale;
  projects: readonly GektaProject[];
  activeProjectId: string | null;
  conversationCounts: Readonly<Record<string, number>>;
  onCreate: (name: string, description: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string | null) => void;
}) {
  const ui = UI[locale];
  const [creating, setCreating] = React.useState(false);
  const [descriptionOpen, setDescriptionOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const nameRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { if (creating) nameRef.current?.focus(); }, [creating]);

  const cancel = () => {
    setCreating(false);
    setDescriptionOpen(false);
    setName('');
    setDescription('');
  };

  const submit = () => {
    if (!name.trim()) return;
    onCreate(name, description);
    cancel();
  };

  return (
    <section className='mt-3' aria-labelledby='gekta-projects-heading' data-gekta-projects='true'>
      <div className='flex items-center justify-between px-2'>
        <h2 id='gekta-projects-heading' className='text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500'>{ui.title}</h2>
        <button
          type='button'
          onClick={() => { if (creating) cancel(); else setCreating(true); }}
          aria-expanded={creating}
          className='flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'
          aria-label={ui.create}
          title={ui.create}
          disabled={projects.length >= GEKTA_PROJECT_LIMITS.maxProjects}
        >
          <FolderPlus className='h-4 w-4' aria-hidden='true' />
        </button>
      </div>

      {creating ? (
        <div className='mt-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm'>
          <label className='sr-only' htmlFor='gekta-project-name'>{ui.namePlaceholder}</label>
          <input
            id='gekta-project-name'
            ref={nameRef}
            value={name}
            maxLength={GEKTA_PROJECT_LIMITS.maxNameChars}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit(); } if (event.key === 'Escape') cancel(); }}
            placeholder={ui.namePlaceholder}
            className='min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100'
          />
          {descriptionOpen ? (
            <>
              <label className='sr-only' htmlFor='gekta-project-description'>{ui.descriptionPlaceholder}</label>
              <input
                id='gekta-project-description'
                value={description}
                maxLength={GEKTA_PROJECT_LIMITS.maxDescriptionChars}
                onChange={(event) => setDescription(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit(); } if (event.key === 'Escape') cancel(); }}
                placeholder={ui.descriptionPlaceholder}
                className='mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100'
              />
            </>
          ) : (
            <button type='button' onClick={() => setDescriptionOpen(true)} className='mt-1 flex min-h-11 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'>
              <Plus className='h-4 w-4' aria-hidden='true' />{ui.addDescription}
            </button>
          )}
          <div className='mt-2 flex gap-2'>
            <button type='button' onClick={submit} disabled={!name.trim()} className='min-h-11 flex-1 rounded-xl bg-emerald-800 px-3 text-sm font-semibold text-white disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'>{ui.save}</button>
            <button type='button' onClick={cancel} className='min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'>{ui.cancel}</button>
          </div>
        </div>
      ) : null}

      {projects.length ? (
        <ul className='mt-2 space-y-1'>
          {activeProjectId ? (
            <li>
              <button type='button' onClick={() => onOpen(null)} className='flex min-h-11 w-full items-center rounded-lg px-2 text-left text-sm font-semibold text-emerald-800 hover:bg-white'>{ui.all}</button>
            </li>
          ) : null}
          {projects.map((project) => (
            <li key={project.id} className={`group rounded-xl ${activeProjectId === project.id ? 'bg-white' : ''}`}>
              <div className='flex items-center gap-1'>
                <button
                  type='button'
                  onClick={() => onOpen(activeProjectId === project.id ? null : project.id)}
                  aria-pressed={activeProjectId === project.id}
                  className='flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'
                >
                  <FolderOpen className='h-4 w-4 shrink-0 text-emerald-700' aria-hidden='true' />
                  <span className='min-w-0'>
                    <span className='block truncate text-sm font-medium text-slate-800'>{project.name}</span>
                    <span className='block truncate text-[11px] text-slate-500'>{ui.chats(conversationCounts[project.id] ?? 0)}{project.description ? ` · ${project.description}` : ''}</span>
                  </span>
                </button>
                <button
                  type='button'
                  onClick={() => {
                    const next = window.prompt(ui.renamePrompt, project.name);
                    if (next && next.trim()) onRename(project.id, next);
                  }}
                  className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 opacity-100 hover:bg-white hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 md:w-9 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100'
                  aria-label={`${ui.rename}: ${project.name}`}
                >
                  <Pencil className='h-3.5 w-3.5' aria-hidden='true' />
                </button>
                <button
                  type='button'
                  onClick={() => { if (window.confirm(ui.deleteConfirm)) onDelete(project.id); }}
                  className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 opacity-100 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 md:w-9 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100'
                  aria-label={`${ui.del}: ${project.name}`}
                >
                  <Trash2 className='h-3.5 w-3.5' aria-hidden='true' />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className='mt-2 px-2 text-[11px] leading-4 text-slate-500'>{ui.empty}</p>
      )}
    </section>
  );
}
