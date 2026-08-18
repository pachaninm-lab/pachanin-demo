'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CONNECTION_CENTER_REQUIRED_BUT_NOT_MODELED,
  isConnectionAttestationDto,
  isConnectionStateDto,
  presentConnection,
  type ConnectionAttestationDto,
  type ConnectionStateDto,
} from './connection-center.presentation';
import styles from './connections.module.css';

type LoadState =
  | { readonly kind: 'LOADING' }
  | {
      readonly kind: 'READY';
      readonly connections: readonly ConnectionStateDto[];
      readonly attestations: readonly ConnectionAttestationDto[];
      readonly checkedAt: Date;
    }
  | { readonly kind: 'UNAUTHENTICATED' }
  | { readonly kind: 'FORBIDDEN' }
  | { readonly kind: 'UNAVAILABLE' };

export function ConnectionCenterClient() {
  const [state, setState] = useState<LoadState>({ kind: 'LOADING' });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setState({ kind: 'LOADING' });

    try {
      const [connectionsResponse, attestationsResponse] = await Promise.all([
        fetch('/api/platform-v7/accounting/connections', { cache: 'no-store' }),
        fetch('/api/platform-v7/accounting/connections/attestations', {
          cache: 'no-store',
        }),
      ]);

      if (connectionsResponse.status === 401 || attestationsResponse.status === 401) {
        setState({ kind: 'UNAUTHENTICATED' });
        return;
      }
      if (connectionsResponse.status === 403 || attestationsResponse.status === 403) {
        setState({ kind: 'FORBIDDEN' });
        return;
      }
      if (!connectionsResponse.ok || !attestationsResponse.ok) {
        setState({ kind: 'UNAVAILABLE' });
        return;
      }

      const [connectionsPayload, attestationsPayload] = await Promise.all([
        connectionsResponse.json() as Promise<unknown>,
        attestationsResponse.json() as Promise<unknown>,
      ]);
      if (
        !Array.isArray(connectionsPayload)
        || !connectionsPayload.every(isConnectionStateDto)
        || !Array.isArray(attestationsPayload)
        || !attestationsPayload.every(isConnectionAttestationDto)
      ) {
        setState({ kind: 'UNAVAILABLE' });
        return;
      }

      setState({
        kind: 'READY',
        connections: connectionsPayload,
        attestations: attestationsPayload,
        checkedAt: new Date(),
      });
    } catch {
      setState({ kind: 'UNAVAILABLE' });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const cards = useMemo(
    () =>
      state.kind === 'READY'
        ? state.connections.map((connection) => ({
            key: connection.kind,
            view: presentConnection(connection, state.attestations),
          }))
        : [],
    [state],
  );

  if (state.kind === 'LOADING') {
    return (
      <section className={styles.statePanel} aria-busy="true" aria-live="polite">
        <p>Получаем подтверждённые статусы подключений…</p>
      </section>
    );
  }

  if (state.kind === 'UNAUTHENTICATED') {
    return (
      <section className={styles.statePanel} aria-live="polite">
        <p>Сессия истекла. Войдите заново.</p>
      </section>
    );
  }

  if (state.kind === 'FORBIDDEN') {
    return (
      <section className={styles.statePanel} aria-live="polite">
        <p>У вас нет права читать подключения этой организации.</p>
      </section>
    );
  }

  if (state.kind === 'UNAVAILABLE') {
    return (
      <section className={styles.statePanel} aria-live="assertive">
        <h2>Статусы сейчас недоступны</h2>
        <p>
          Ничего не подставляем из кэша и не показываем старые данные как текущие.
        </p>
        <button className={styles.secondaryButton} type="button" onClick={() => void load(true)}>
          Проверить снова
        </button>
      </section>
    );
  }

  return (
    <div className={styles.content}>
      <section className={styles.summary} aria-labelledby="connections-summary-heading">
        <div>
          <p className={styles.kicker}>Подключения организации</p>
          <h2 id="connections-summary-heading">Что реально подтверждено сейчас</h2>
          <p className={styles.summaryText}>
            Зелёный статус появляется только после доказанного ответа внешней системы.
            Тест, установленный адаптер или успешный запрос сами по себе не считаются
            рабочим подключением.
          </p>
        </div>
        <div className={styles.refreshBox}>
          <span className={styles.checkedAt}>
            Проверено: {formatCheckedAt(state.checkedAt)}
          </span>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={refreshing}
            onClick={() => void load(true)}
          >
            {refreshing ? 'Проверяем…' : 'Проверить статус'}
          </button>
          <span className={styles.controlHint}>
            Это обновляет серверный статус. К внешней системе команда не отправляется.
          </span>
        </div>
      </section>

      {cards.length === 0 ? (
        <section className={styles.statePanel} aria-live="polite">
          <h2>Подключений пока нет в серверной модели</h2>
          <p>Экран не будет придумывать состояние вместо данных сервера.</p>
        </section>
      ) : (
        <section className={styles.grid} aria-label="Подтверждённые сервером подключения">
          {cards.map(({ key, view }) => (
            <article className={styles.card} key={key}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.eyebrow}>{view.eyebrow}</p>
                  <h3>{view.title}</h3>
                </div>
                <span
                  className={`${styles.statusBadge} ${styles[`tone_${view.statusTone}`]}`}
                >
                  {view.status}
                </span>
              </div>

              <p className={styles.detail}>{view.detail}</p>
              <p className={styles.attestation}>{view.attestation}</p>

              {view.missing.length > 0 ? (
                <div className={styles.missingBlock}>
                  <h4>Что ещё требуется</h4>
                  <ul>
                    {view.missing.map((item, index) => (
                      <li key={`${key}-missing-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className={styles.confirmedText}>
                  {view.realTrafficConfirmed
                    ? 'Реальный обмен подтверждён внешней системой.'
                    : 'Нет перечисленных сервером недостающих условий, но реальный обмен ещё не подтверждён.'}
                </p>
              )}

              {view.actionLabel ? (
                <div className={styles.disabledAction}>
                  <button type="button" disabled className={styles.primaryButton}>
                    {view.actionLabel}
                  </button>
                  <p>{view.actionDisabledReason}</p>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      )}

      <section className={styles.later} aria-labelledby="connections-later-heading">
        <div>
          <p className={styles.kicker}>Следующие контуры</p>
          <h2 id="connections-later-heading">Не подменяем отсутствие серверного статуса</h2>
        </div>
        <div className={styles.laterGrid}>
          {CONNECTION_CENTER_REQUIRED_BUT_NOT_MODELED.map((item) => (
            <article className={styles.laterCard} key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.help} aria-labelledby="connections-help-heading">
        <div>
          <p className={styles.kicker}>Самостоятельное подключение</p>
          <h2 id="connections-help-heading">Если ты не знаешь, где работает 1С</h2>
          <p>
            Подключение не требует передавать нам пароль бухгалтера. Будущий мастер
            настройки должен уметь передать понятную инструкцию бухгалтеру или
            администратору 1С. Серверная отправка такой инструкции в этом релизном
            срезе ещё не открыта.
          </p>
        </div>
        <div className={styles.disabledActionRow}>
          <div>
            <button type="button" disabled className={styles.primaryButton}>
              Отправить бухгалтеру
            </button>
            <p>Недоступно: нет серверной команды отправки инструкции.</p>
          </div>
          <div>
            <button type="button" disabled className={styles.primaryButton}>
              Отправить администратору 1С
            </button>
            <p>Недоступно: нет серверной команды отправки инструкции.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function formatCheckedAt(value: Date): string {
  return value.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
