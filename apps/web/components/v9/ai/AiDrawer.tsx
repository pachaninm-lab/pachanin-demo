'use client';
import * as React from 'react';
import { Bot, X, Lightbulb, AlertTriangle, TrendingUp, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/v9/utils';
import { Button } from '../ui/button';
import { useSessionStore } from '@/stores/useSessionStore';

interface AiSuggestion {
  id: string;
  title: string;
  reasoning: string;
  action: string;
  actionHref?: string;
  priority: 'high' | 'medium' | 'low';
}

// Context-aware suggestions based on current page path
function getSuggestions(pathname: string, role: string): AiSuggestion[] {
  if (pathname.includes('control-tower') || pathname === '/platform-v9') {
    return [
      {
        id: 's1', priority: 'high',
        title: 'DL-9102 требует немедленного внимания',
        reasoning: 'На основе: Risk score 92, hold 624 000 ₽, SLA осталось 6 дней, спор DK-2024-89 без эксперта.',
        action: 'Открыть war-room DK-2024-89', actionHref: '/platform-v9/disputes/DK-2024-89',
      },
      {
        id: 's2', priority: 'high',
        title: 'CB-442 Mismatch блокирует release 5.76 млн ₽',
        reasoning: 'На основе: Callback не закрыт 4 дня. Зависимые сделки: DL-9102. Требуется ручная верификация.',
        action: 'Перейти к банку', actionHref: '/platform-v9/bank',
      },
      {
        id: 's3', priority: 'medium',
        title: 'DL-9110 — второй активный спор',
        reasoning: 'Risk score 78, hold 512 000 ₽, SLA 13 дней. Расхождение влажности кукурузы 16.2% vs 14%.',
        action: 'Открыть DK-2024-91', actionHref: '/platform-v9/disputes/DK-2024-91',
      },
    ];
  }

  if (pathname.includes('disputes')) {
    return [
      {
        id: 'd1', priority: 'high',
        title: 'Загрузите заключение эксперта — осталось 6 дней',
        reasoning: 'Evidence pack неполный (4/5). Без заключения независимого эксперта арбитраж невозможен.',
        action: 'Перейти к evidence pack',
      },
      {
        id: 'd2', priority: 'medium',
        title: 'Паспорт ФГИС и протокол ЛАБ-2847 расходятся на 0.8%',
        reasoning: 'Типичная разрешаемость: 6 из 10 споров по качеству решаются частичным release (70%) + доп. гарантией.',
        action: 'Предложить частичный release 70%',
      },
    ];
  }

  if (pathname.includes('bank')) {
    return [
      {
        id: 'b1', priority: 'high',
        title: 'CB-442 заблокирован 4+ дня — нестандартная ситуация',
        reasoning: 'Среднее время обработки mismatch: 1.2 дня. Текущий: 4 дня. Рекомендую эскалацию.',
        action: 'Эскалировать в Сбер',
      },
      {
        id: 'b2', priority: 'medium',
        title: 'Два документа блокируют release 3.2 млн ₽',
        reasoning: 'Акт приёмки (форма А) + форма ЗТТ. Ответственный: Продавец. Уведомление не отправлялось 18ч.',
        action: 'Отправить напоминание продавцу',
      },
    ];
  }

  if (pathname.includes('deals') && pathname.includes('DL-')) {
    return [
      {
        id: 'dl1', priority: 'high',
        title: 'Фаза «Приёмка» заблокирована спором',
        reasoning: 'Разблокировка через: загрузка заключения эксперта + закрытие CB-442. ETA: 3-5 рабочих дней.',
        action: 'War-room спора', actionHref: '/platform-v9/disputes/DK-2024-89',
      },
      {
        id: 'dl2', priority: 'medium',
        title: 'Partial release 70% возможен сейчас',
        reasoning: 'Лаб-результат подтверждён. Спорная часть 10% (624 000 ₽) останется под hold до решения.',
        action: 'Оформить release 70%',
      },
    ];
  }

  // Default
  return [
    {
      id: 'def1', priority: 'medium',
      title: 'Недостаточно контекста для подсказки',
      reasoning: 'Выберите конкретную сделку или раздел для получения контекстных рекомендаций.',
      action: 'Открыть Control Tower', actionHref: '/platform-v9/control-tower',
    },
  ];
}

const priorityColors = {
  high: { bg: 'rgba(220,38,38,0.06)', border: 'rgba(220,38,38,0.2)', icon: '#DC2626', badge: 'Высокий' },
  medium: { bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.2)', icon: '#D97706', badge: 'Средний' },
  low: { bg: 'rgba(10,122,95,0.06)', border: 'rgba(10,122,95,0.2)', icon: '#0A7A5F', badge: 'Низкий' },
};

interface AiDrawerProps {
  open: boolean;
  onClose: () => void;
  pathname: string;
}

export function AiDrawer({ open, onClose, pathname }: AiDrawerProps) {
  const { role, demoMode } = useSessionStore();
  const suggestions = getSuggestions(pathname, role);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(15,20,25,0.2)' }}
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Drawer */}
      <aside
        role="complementary"
        aria-label="AI-помощник"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
          width: 360, background: '#fff',
          borderLeft: '1px solid #E4E6EA',
          boxShadow: '-4px 0 24px rgba(9,30,66,0.12)',
          display: 'flex', flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid #E4E6EA' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(10,122,95,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={16} color="#0A7A5F" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>AI-помощник</div>
            <div style={{ fontSize: 11, color: '#6B778C' }}>
              Контекст: {pathname.split('/').pop() ?? 'платформа'}
              {demoMode ? ' · SANDBOX' : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ color: '#6B778C', background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6 }} aria-label="Закрыть">
            <X size={16} />
          </button>
        </div>

        {/* Suggestions */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B778C', marginBottom: 4 }}>
            {suggestions.length} рекомендации
          </div>

          {suggestions.map(s => {
            const colors = priorityColors[s.priority];
            const Icon = s.priority === 'high' ? AlertTriangle : s.priority === 'medium' ? Lightbulb : TrendingUp;

            return (
              <div
                key={s.id}
                style={{
                  background: colors.bg, border: `1px solid ${colors.border}`,
                  borderRadius: 8, padding: '12px 14px',
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                  <Icon size={14} color={colors.icon} style={{ marginTop: 1, flexShrink: 0 }} aria-hidden />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419', lineHeight: 1.4 }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: 11, color: '#6B778C', marginTop: 4, lineHeight: 1.5 }}>
                      {s.reasoning}
                    </div>
                  </div>
                </div>
                {s.actionHref ? (
                  <a
                    href={s.actionHref}
                    onClick={onClose}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 700, color: colors.icon,
                      textDecoration: 'none',
                    }}
                  >
                    {s.action} <ExternalLink size={10} />
                  </a>
                ) : (
                  <button
                    disabled={demoMode}
                    style={{
                      background: 'none', border: 'none', padding: 0, cursor: demoMode ? 'not-allowed' : 'pointer',
                      fontSize: 11, fontWeight: 700, color: demoMode ? '#6B778C' : colors.icon,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                    title={demoMode ? 'SANDBOX: действие отключено' : undefined}
                  >
                    {s.action} {demoMode && <span style={{ fontSize: 9, color: '#D97706' }}>(sandbox)</span>}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4E6EA', fontSize: 11, color: '#6B778C', textAlign: 'center' }}>
          AI-рекомендации основаны на данных платформы.
          {demoMode && ' В SANDBOX-режиме — демо-данные.'}
        </div>
      </aside>
    </>
  );
}
