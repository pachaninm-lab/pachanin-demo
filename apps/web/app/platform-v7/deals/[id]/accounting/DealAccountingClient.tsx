'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from '../../../accounting/accounting.module.css';

/**
 * The deal's accounting readiness.
 *
 * Shows which of the nine sources a document would draw on are present and
 * which are missing, because "нельзя выпустить" without the list is a dead end:
 * the person reading it is the one who has to go and get the missing passport.
 */

const SOURCE_LABEL: Readonly<Record<string, string>> = {
  DEAL_NOT_FOUND: 'Сделка не найдена',
  NO_ACCEPTED_WEIGHT: 'Нет принятого веса',
  NO_QUALITY_SAMPLE: 'Нет финализированного качества',
  NO_TAX_PROFILE: 'Не заявлен налоговый профиль',
  NO_CONTRACT_VERSION: 'Нет подписанной версии договора',
  NO_COUNTERPARTY: 'Не определён контрагент',
  NO_PRICE: 'Нет итоговой цены',
  NO_SHIPMENT: 'Нет отгрузки',
  NO_REGULATORY_RULE: 'Нет действующего правила',
};

type State =
  | { kind: 'LOADING' }
  | { kind: 'READY' }
  | { kind: 'INCOMPLETE'; missing: string[] }
  | { kind: 'UNAUTHENTICATED' }
  | { kind: 'FORBIDDEN' }
  | { kind: 'UNAVAILABLE' };

export function DealAccountingClient({ dealId }: { dealId: string }) {
  const [state, setState] = useState<State>({ kind: 'LOADING' });

  const load = useCallback(async () => {
    setState({ kind: 'LOADING' });
    try {
      const response = await fetch(
        `/api/platform-v7/accounting/deals/${encodeURIComponent(dealId)}/source-snapshot`,
        { cache: 'no-store' },
      );
      if (response.status === 401) return setState({ kind: 'UNAUTHENTICATED' });
      if (response.status === 403) return setState({ kind: 'FORBIDDEN' });
      if (!response.ok) return setState({ kind: 'UNAVAILABLE' });

      // The discriminant is compared explicitly rather than relied on inside an
      // expression: this tsconfig is not strict, and narrowing a union by
      // truthiness in a ternary arm does not reach the other arm's members.
      const payload = (await response.json()) as {
        assembled?: unknown;
        missing?: unknown;
      };
      if (payload.assembled === true) return setState({ kind: 'READY' });
      const missing = Array.isArray(payload.missing)
        ? payload.missing.filter(
            (code: unknown): code is string => typeof code === 'string',
          )
        : [];
      return setState({ kind: 'INCOMPLETE', missing });
    } catch {
      return setState({ kind: 'UNAVAILABLE' });
    }
  }, [dealId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === 'LOADING') {
    return (
      <section className={styles.board} aria-busy="true" aria-live="polite">
        <p className={styles.status}>Проверяем источники…</p>
      </section>
    );
  }

  if (state.kind === 'UNAUTHENTICATED') {
    return (
      <section className={styles.board} aria-live="polite">
        <p className={styles.status}>Сессия истекла. Войдите заново.</p>
      </section>
    );
  }

  if (state.kind === 'FORBIDDEN') {
    return (
      <section className={styles.board} aria-live="polite">
        <p className={styles.status}>У вас нет доступа к бухгалтерии этой сделки.</p>
      </section>
    );
  }

  if (state.kind === 'UNAVAILABLE') {
    return (
      <section className={styles.board} aria-live="assertive">
        <p className={styles.statusError} role="alert">
          Не удалось проверить источники. Ничего не показываем, чтобы не выдать
          устаревшее за текущее.
        </p>
        <button type="button" className={styles.retry} onClick={() => void load()}>
          Повторить
        </button>
      </section>
    );
  }

  if (state.kind === 'READY') {
    return (
      <section className={styles.board} aria-live="polite">
        <p className={styles.status}>
          Все источники на месте — документ можно готовить.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.board} aria-live="polite">
      <p className={styles.status}>Документ пока не собрать. Не хватает:</p>
      <ul className={styles.list} aria-label="Чего не хватает">
        {state.missing.map((code) => (
          <li key={code} className={styles.card}>
            {SOURCE_LABEL[code] ?? code}
          </li>
        ))}
      </ul>
    </section>
  );
}
