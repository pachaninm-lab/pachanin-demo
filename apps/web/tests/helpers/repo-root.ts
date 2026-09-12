import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * The repository root, resolved from this file rather than from the cwd.
 *
 * Guard tests read source files by repo-root-relative path — `apps/web/...` —
 * but vitest runs with cwd at `apps/web`, so `join(process.cwd(), 'apps/web/x')`
 * asks for `apps/web/apps/web/x`. That path exists for eight names, because
 * `apps/web/apps/web` holds committed symlinks back to `apps/web`, so most of
 * these tests passed by accident. For everything the mirror does not cover the
 * read threw ENOENT before a single assertion ran, and a guard test that never
 * reaches its assertions is a guard that is not guarding: it fails loudly enough
 * to look like a known-red suite and quietly enough that nobody notices the file
 * it was protecting is unprotected.
 *
 * Walking up to the `.git` directory resolves from where the paths are actually
 * written from, and depends on no symlink existing.
 */
export function repoRoot(): string {
  let dir = __dirname;
  while (!existsSync(join(dir, '.git')) && dirname(dir) !== dir) dir = dirname(dir);
  return dir;
}
