import styles from './PublicDealRoleScenario.module.css';

export function PublicDealRoleScenario({ locale }: { locale: string }) {
  const text = locale === 'en'
    ? 'Static role scenario hydration probe'
    : locale === 'zh'
      ? '静态角色场景水合测试'
      : 'Статический ролевой сценарий для замера гидратации';

  return (
    <div className={styles.root}>
      <div className={styles.heading}><strong>{text}</strong></div>
      <section className={styles.workspace} aria-label={text}>
        <div className={styles.workspaceHeader}>
          <div><small>{text}</small><strong>Deal scenario</strong></div>
          <span>Quality deviation</span>
        </div>
        <div className={styles.rolePanel}><p>{text}</p></div>
      </section>
    </div>
  );
}
