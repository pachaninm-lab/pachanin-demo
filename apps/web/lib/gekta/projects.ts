export type GektaProject = Readonly<{
  id: string;
  locale: 'ru' | 'en' | 'zh';
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}>;

export const GEKTA_PROJECTS_STORAGE = 'gekta-projects-v1';

export const GEKTA_PROJECT_LIMITS = {
  maxProjects: 40,
  maxNameChars: 60,
  maxDescriptionChars: 240,
} as const;

function clean(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/gu, ' ').replace(/\s+/gu, ' ').trim();
}

export function normaliseProjectName(value: string): string {
  return clean(value).slice(0, GEKTA_PROJECT_LIMITS.maxNameChars);
}

export function normaliseProjectDescription(value: string): string {
  return clean(value).slice(0, GEKTA_PROJECT_LIMITS.maxDescriptionChars);
}

/** Storage is untrusted input: anything that is not a well-formed project is dropped. */
export function safeProjects(value: unknown): GektaProject[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, GEKTA_PROJECT_LIMITS.maxProjects).flatMap((row): GektaProject[] => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return [];
    const item = row as Record<string, unknown>;
    const locale = item.locale === 'en' || item.locale === 'zh' || item.locale === 'ru' ? item.locale : null;
    const id = typeof item.id === 'string' ? item.id : '';
    const name = typeof item.name === 'string' ? normaliseProjectName(item.name) : '';
    if (!locale || !id || !name) return [];
    const now = new Date().toISOString();
    return [{
      id,
      locale,
      name,
      description: typeof item.description === 'string' ? normaliseProjectDescription(item.description) : '',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : now,
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : now,
    }];
  });
}

export type ProjectMatchInput = Readonly<{
  project: GektaProject;
  conversationTitles: readonly string[];
}>;

/**
 * A project matches when its own name or description matches, or when any
 * conversation inside it does — searching for a chat should surface its project.
 */
export function projectMatchesSearch({ project, conversationTitles }: ProjectMatchInput, search: string): boolean {
  const needle = search.trim().toLocaleLowerCase();
  if (!needle) return true;
  const haystack = [project.name, project.description, ...conversationTitles].join('\n').toLocaleLowerCase();
  return haystack.includes(needle);
}
