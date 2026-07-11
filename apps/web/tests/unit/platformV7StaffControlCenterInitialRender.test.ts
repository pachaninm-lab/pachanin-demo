import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const control = source('components/platform-v7/staff/StaffControlCenter.tsx');
const workspaces = source('components/platform-v7/staff/StaffOperationalWorkspaces.tsx');
const css = source('components/platform-v7/staff/StaffControlCenter.module.css');

describe('Staff Control Center initial render stability', () => {
  it('renders the real hero before privileged data hydration completes', () => {
    expect(control).toContain('data-staff-loading');
    expect(control).toContain('<h1>{copy.pageTitle}</h1>');
    expect(control).toContain('<p className={styles.description}>{copy.description}</p>');
    expect(control).toContain("document.documentElement.dataset.staffControlReady = 'true'");
    expect(control).toContain("pc:staff-control-ready");
    expect(css).toContain('.loadingCard { margin-top: 18px; }');
  });

  it('does not insert operational workspaces before the control plane first render settles', () => {
    expect(workspaces).toContain('const [controlReady, setControlReady] = useState(false)');
    expect(workspaces).toContain("document.documentElement.dataset.staffControlReady === 'true'");
    expect(workspaces).toContain("window.addEventListener('pc:staff-control-ready', ready)");
    expect(workspaces).toContain('if (!controlReady) return null');
  });
});
