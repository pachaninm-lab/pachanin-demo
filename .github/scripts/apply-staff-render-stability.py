from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'missing expected block in {path}: {old[:120]!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')

control = 'apps/web/components/platform-v7/staff/StaffControlCenter.tsx'
replace(control,
"""    } finally {
      setLoading(false);
    }
  }, [apiAvailable, loadPrivileged, translateError]);

  useEffect(() => { void reload(); }, [reload]);
""",
"""    } finally {
      setLoading(false);
      document.documentElement.dataset.staffControlReady = 'true';
      window.dispatchEvent(new Event('pc:staff-control-ready'));
    }
  }, [apiAvailable, loadPrivileged, translateError]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => () => {
    delete document.documentElement.dataset.staffControlReady;
  }, []);
""")
replace(control,
"""  if (loading) {
    return <main className={styles.page}><section className={styles.stateCard} aria-live="polite"><span className={styles.spinner} />{copy.loading}</section></main>;
  }
""",
"""  if (loading) {
    return (
      <main className={styles.page} data-staff-loading data-locale={locale}>
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1>{copy.pageTitle}</h1>
            <p className={styles.description}>{copy.description}</p>
          </div>
          <button type="button" className={styles.secondaryButton} disabled>{copy.refresh}</button>
        </header>
        <div className={styles.maturity} role="note">{copy.maturity}</div>
        <section className={`${styles.stateCard} ${styles.loadingCard}`} aria-live="polite">
          <span className={styles.spinner} />{copy.loading}
        </section>
      </main>
    );
  }
""")

operational = 'apps/web/components/platform-v7/staff/StaffOperationalWorkspaces.tsx'
replace(operational,
"""  const [context, setContext] = useState<SessionContext>({ active: false, session: null });
  const [tab, setTab] = useState<WorkspaceTab>('support');
""",
"""  const [context, setContext] = useState<SessionContext>({ active: false, session: null });
  const [controlReady, setControlReady] = useState(false);
  const [tab, setTab] = useState<WorkspaceTab>('support');
""")
replace(operational,
"""  useEffect(() => { void loadContext(); }, [loadContext]);
  useEffect(() => {
    const refresh = () => { void loadContext(); };
""",
"""  useEffect(() => { void loadContext(); }, [loadContext]);
  useEffect(() => {
    const ready = () => setControlReady(true);
    if (document.documentElement.dataset.staffControlReady === 'true') ready();
    window.addEventListener('pc:staff-control-ready', ready);
    return () => window.removeEventListener('pc:staff-control-ready', ready);
  }, []);
  useEffect(() => {
    const refresh = () => { void loadContext(); };
""")
replace(operational,
"""  if (loading && !context.session && !data) {
    return <section className={styles.section}><div className={styles.locked}><span className={styles.spinner} /> {copy.loading}</div></section>;
  }
""",
"""  if (!controlReady) return null;

  if (loading && !context.session && !data) {
    return <section className={styles.section}><div className={styles.locked}><span className={styles.spinner} /> {copy.loading}</div></section>;
  }
""")

css = 'apps/web/components/platform-v7/staff/StaffControlCenter.module.css'
replace(css,
""".stateCard strong { font-size: clamp(22px, 4vw, 34px); }
.stateCard p { margin: 0; color: #5e7169; line-height: 1.6; }
""",
""".stateCard strong { font-size: clamp(22px, 4vw, 34px); }
.stateCard p { margin: 0; color: #5e7169; line-height: 1.6; }
.loadingCard { margin-top: 18px; }
""")

test = 'apps/web/tests/unit/platformV7StaffControlCenter.test.ts'
replace(test,
"""    expect(component).toContain('data-staff-control-center');
""",
"""    expect(component).toContain('data-staff-control-center');
    expect(component).toContain("document.documentElement.dataset.staffControlReady = 'true'");
    expect(component).toContain("pc:staff-control-ready");
""")
replace(test,
"""    const operational = read('components/platform-v7/staff/StaffOperationalWorkspaces.tsx');
""",
"""    const operational = read('components/platform-v7/staff/StaffOperationalWorkspaces.tsx');
    expect(operational).toContain('if (!controlReady) return null');
    expect(operational).toContain("document.documentElement.dataset.staffControlReady === 'true'");
""")

Path('.github/workflows/apply-staff-render-stability.yml').unlink(missing_ok=True)
Path('.github/scripts/apply-staff-render-stability.py').unlink(missing_ok=True)
