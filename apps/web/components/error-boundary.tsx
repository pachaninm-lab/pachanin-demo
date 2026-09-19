'use client';

import { Component, ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  context?: string;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    const ctx = this.props.context || 'unknown';
    console.error(`[pc:error-boundary] context=${ctx}`, error.message, info.componentStack?.slice(0, 300));
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return <DefaultErrorFallback error={error} reset={this.reset} />;
  }
}

function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  const is401 = error.message?.includes('401') || error.message?.includes('auth');
  const is403 = error.message?.includes('403') || error.message?.includes('forbidden');
  const is404 = error.message?.includes('404') || error.message?.includes('not found');
  const isNetwork = error.message?.includes('fetch') || error.message?.includes('network');

  const title = is401
    ? 'Сессия истекла'
    : is403
    ? 'Нет доступа'
    : is404
    ? 'Данные не найдены'
    : isNetwork
    ? 'Нет соединения с сервером'
    : 'Что-то пошло не так';

  const detail = is401
    ? 'Войдите снова, чтобы продолжить работу.'
    : is403
    ? 'У вашей роли нет доступа к этому разделу. Обратитесь к оператору.'
    : is404
    ? 'Запрошенный объект не найден. Возможно, он был удалён или перемещён.'
    : isNetwork
    ? 'Платформа работает в offline-режиме. Данные из последнего снимка.'
    : error.message || 'Неизвестная ошибка. Попробуйте обновить страницу.';

  return (
    <div className="section-card" style={{ margin: '24px 0' }}>
      <div className="section-title" style={{ color: is401 || is403 ? '#d97706' : '#dc2626' }}>
        {title}
      </div>
      <div className="muted small" style={{ marginTop: 8 }}>{detail}</div>
      <div className="cta-stack" style={{ marginTop: 16 }}>
        {is401 ? (
          <a href="/login" className="primary-link">Войти снова</a>
        ) : (
          <button onClick={reset} className="primary-link">Попробовать снова</button>
        )}
        <a href="/" className="secondary-link">На главную</a>
      </div>
      {process.env.NODE_ENV !== 'production' && (
        <details style={{ marginTop: 16 }}>
          <summary className="muted tiny" style={{ cursor: 'pointer' }}>Техническая информация (dev)</summary>
          <pre style={{ fontSize: 11, marginTop: 8, color: '#6b7280', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {error.stack || error.message}
          </pre>
        </details>
      )}
    </div>
  );
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  context?: string
) {
  return function WrappedWithErrorBoundary(props: P) {
    return (
      <ErrorBoundary context={context}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
