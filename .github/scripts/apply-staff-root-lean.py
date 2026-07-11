from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'missing expected block in {path}: {old[:160]!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


replace(
    'apps/web/app/layout.tsx',
    "  const leanPublicEntry = LEAN_PUBLIC_ENTRY_PATHS.has(pathname);",
    "  const leanPublicEntry = LEAN_PUBLIC_ENTRY_PATHS.has(pathname)\n    || pathname === '/platform-v7/staff'\n    || pathname.startsWith('/platform-v7/staff/');",
)

replace(
    'scripts/p7-autopilot-guard.sh',
    "STAFF_CONTROL_CENTER_TEMPLATE_SCOPE='apps/web/app/platform-v7/layout.tsx\napps/web/app/platform-v7/template.tsx'",
    "STAFF_CONTROL_CENTER_TEMPLATE_SCOPE='apps/web/app/layout.tsx\napps/web/app/platform-v7/layout.tsx\napps/web/app/platform-v7/template.tsx'",
)

path = Path('apps/web/tests/unit/platformV7StaffControlCenterInitialRender.test.ts')
text = path.read_text(encoding='utf-8')
text = text.replace(
    "const page = source('app/platform-v7/staff/page.tsx');",
    "const rootLayout = source('app/layout.tsx');\nconst page = source('app/platform-v7/staff/page.tsx');",
    1,
)
text = text.replace(
    "    expect(page).toContain('<StaffOperationalWorkspacesDeferred');",
    "    expect(rootLayout).toContain(\"pathname === '/platform-v7/staff'\");\n    expect(rootLayout).toContain(\"pathname.startsWith('/platform-v7/staff/')\");\n    expect(page).toContain('<StaffOperationalWorkspacesDeferred');",
    1,
)
path.write_text(text, encoding='utf-8')

Path('.github/workflows/apply-staff-root-lean.yml').unlink(missing_ok=True)
Path('.github/scripts/apply-staff-root-lean.py').unlink(missing_ok=True)
