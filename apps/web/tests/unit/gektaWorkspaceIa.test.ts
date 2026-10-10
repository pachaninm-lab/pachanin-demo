import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normaliseProjectDescription, normaliseProjectName, safeProjects, GEKTA_PROJECT_LIMITS } from '@/lib/gekta/projects';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const sidebar = read('components/gekta/GektaSidebar.tsx');
const projectList = read('components/gekta/GektaProjectList.tsx');
const conversationList = read('components/gekta/GektaConversationList.tsx');
const settings = read('components/gekta/GektaSettingsDialog.tsx');
const drawer = read('components/gekta/GektaMobileDrawer.tsx');
const focus = read('components/gekta/useDialogFocus.ts');
const workspace = read('components/gekta/GektaChatWorkspace.tsx');

describe('Gekta chat workspace information architecture', () => {
  it('offers the full sidebar destination set', () => {
    for (const label of ['newChat', 'search', 'history', 'settings', 'productHome', 'back', 'support']) {
      expect(sidebar).toContain(`${label}:`);
    }
    expect(sidebar).toContain('<GektaProjectList');
    expect(sidebar).toContain('<GektaConversationList');
    expect(sidebar).toContain("data-gekta-open-settings='true'");
    expect(sidebar).toContain("utilityRoute(locale, 'support')");
    expect(sidebar).toContain('href={GEKTA_PATHS[locale]}');
    expect(sidebar).toContain("href='/platform-v7'");
  });

  it('backs every project action with real state, not a decorative folder', () => {
    for (const handler of ['createProject', 'renameProject', 'deleteProject', 'assignConversationProject']) {
      expect(workspace).toContain(`const ${handler} = React.useCallback(`);
    }
    expect(workspace).toContain('GEKTA_PROJECTS_STORAGE');
    expect(workspace).toContain('window.localStorage.setItem(GEKTA_PROJECTS_STORAGE');
    expect(workspace).toContain('const searchedProjects = React.useMemo(');
    expect(workspace).toContain('.filter((conversation) => !activeProjectId || conversation.projectId === activeProjectId)');
    // New conversations opened inside a project stay in that project.
    expect(workspace).toContain('projectId: existing?.projectId ?? activeProjectId');
    expect(projectList).toContain('{ui.create}');
    expect(projectList).toContain('onRename(project.id, next)');
    expect(projectList).toContain('onDelete(project.id)');
    expect(projectList).toContain('descriptionPlaceholder');
    expect(conversationList).toContain('onProject(conversation.id, event.target.value || null)');
  });

  it('deleting a project keeps its conversations', () => {
    expect(workspace).toContain("conversation.projectId === projectId ? { ...conversation, projectId: null } : conversation");
  });

  it('only shows settings that work end to end', () => {
    expect(settings).toContain('{ui.interface}');
    expect(settings).toContain('{ui.answers}');
    expect(settings).toContain('{ui.history}');
    // Appearance, voice and subscription must not appear until they are real.
    expect(settings).not.toContain('Внешний вид');
    expect(settings).not.toContain('Подписка');
    expect(workspace).toContain("locale: answerLocale === 'auto' ? locale : answerLocale");
    expect(workspace).toContain('const changeAnswerLocale = React.useCallback(');
  });

  it('gives both modal surfaces the same keyboard contract', () => {
    expect(focus).toContain("event.key === 'Escape'");
    expect(focus).toContain("event.key !== 'Tab'");
    expect(focus).toContain('restore.focus()');
    expect(settings).toContain('useDialogFocus(true, onClose)');
    expect(settings).toContain("aria-modal='true'");
    expect(drawer).toContain('useDialogFocus(open, onClose)');
    expect(drawer).toContain("aria-modal='true'");
  });
});

describe('Gekta project storage', () => {
  it('drops malformed rows instead of trusting storage', () => {
    const parsed = safeProjects([
      { id: 'p1', locale: 'ru', name: 'Урожай 2026', description: 'поле 4', createdAt: 'x', updatedAt: 'y' },
      { id: 'p2', locale: 'klingon', name: 'nope' },
      { id: '', locale: 'ru', name: 'no id' },
      { id: 'p3', locale: 'ru', name: '   ' },
      'not-an-object',
      null,
    ]);
    expect(parsed.map((project) => project.id)).toEqual(['p1']);
    expect(parsed[0].name).toBe('Урожай 2026');
  });

  it('normalises names and descriptions to bounded single-line text', () => {
    expect(normaliseProjectName('  Поле\u0000 12   север  ')).toBe('Поле 12 север');
    expect(normaliseProjectName('x'.repeat(200)).length).toBe(GEKTA_PROJECT_LIMITS.maxNameChars);
    expect(normaliseProjectDescription('a\nb')).toBe('a b');
    expect(normaliseProjectDescription('y'.repeat(500)).length).toBe(GEKTA_PROJECT_LIMITS.maxDescriptionChars);
  });

  it('never returns more projects than the storage limit', () => {
    const rows = Array.from({ length: 100 }, (_, index) => ({ id: `p${index}`, locale: 'ru', name: `Проект ${index}` }));
    expect(safeProjects(rows).length).toBe(GEKTA_PROJECT_LIMITS.maxProjects);
  });
});
