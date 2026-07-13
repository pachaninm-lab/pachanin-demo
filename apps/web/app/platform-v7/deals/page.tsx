import { CanonicalDealsList } from '@/components/platform-v7/CanonicalDealsList';
import styles from './deals.module.css';

export default function PlatformV7DealsPage() {
  return (
    <div className={styles.page} data-testid='platform-v7-deals-page'>
      <header className={styles.pageHeader}>
        <span className={styles.eyebrow}>Реестр исполнения</span>
        <h1>Сделки</h1>
        <p>
          Здесь показываются только сделки, к которым сервер подтвердил ваше участие.
          Статические сценарии, демонстрационные суммы и внутренние симуляторы из рабочего реестра удалены.
        </p>
      </header>
      <CanonicalDealsList />
    </div>
  );
}
