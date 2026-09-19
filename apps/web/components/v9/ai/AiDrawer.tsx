'use client';
import * as React from 'react';
import { Bot, X, Lightbulb, AlertTriangle, TrendingUp, ExternalLink } from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';

interface DealAssistantSuggestion {
  id: string;
  title: string;
  reasoning: string;
  action: string;
  actionHref?: string;
  priority: 'high' | 'medium' | 'low';
}

function getSuggestions(pathname: string): DealAssistantSuggestion[] {
  if (pathname.includes('control-tower') || pathname === '/platform-v7') {
    return [
      {
        id: 's1', priority: 'high',
        title: 'DL-9102 требует внимания',
        reasoning: 'Причина: риск 92, удержание 624 000 ₽, срок реакции 6 дней, спор DK-2024-89 без эксперта.',
        action: 'Открыть спор DK-2024-89', actionHref: '/platform-v7/disputes/DK-2024-89',
      },
      {
        id: 's2', priority: 'high',
        title: 'CB-442 блокирует выпуск 5.76 млн ₽',
        reasoning: 'Ответ банка не закрыт 4 дня. Зависимые сделки: DL-9102. Требуется ручная проверка.',
        action: 'Перейти к банку', actionHref: '/platform-v7/bank',
      },
      {
        id: 's3', priority: 'medium',
        title: 'DL-9110 — второй активный спор',
        reasoning: 'Риск 78, удержание 512 000 ₽, срок реакции 13 дней. Расхождение влажности кукурузы 16.2% vs 14%.',
        action: 'Открыть DK-2024-91', actionHref: '/platform-v7/disputes/DK-2024-91',
      },
    ];
  }

  if (pathname.includes('disputes')) {
    return [
      {
        id: 'd1', priority: 'high',
        title: 'Нужно заключение эксперта — осталось 6 дней',
        reasoning: 'Пакет доказательств неполный (4/5). Без заключения независимого эксперта решение по спору нельзя подтверждать.',
        action: 'Открыть пакет доказательств',
      },
      {
        id: 'd2', priority: 'medium',
        title: 'Паспорт ФГИС и протокол ЛАБ-2847 расходятся на 0.8%',
        reasoning: 'Рабочий вариант: частичный выпуск денег 70% и удержание спорной части до решения.',
        action: 'Проверить частичный выпуск 70%',
      },
    ];
  }

  if (pathname.includes('bank')) {
    return [
      {
        id: 'b1', priority: 'high',
        title: 'CB-442 заблокирован 4+ дня',
        reasoning: 'Обычный срок обработки расхождения: 1.2 дня. Текущий срок: 4 дня. Нужна эскалация.',
        action: 'Эскалировать проверку',
      },
      {
        id: 'b2', priority: 'medium',
        title: 'Два документа блокируют выпуск 3.2 млн ₽',
        reasoning: 'Акт приёмки и форма ЗТТ. Ответственный: продавец. Уведомление не отправлялось 18 часов.',
        action: 'Отправить напоминание продавцу',
      },
    ];
  }

  if (pathname.includes('deals') && pathname.includes('DL-')) {
    return [
      {
        id: 'dl1', priority: 'high',
        title: 'Приёмка заблокирована спором',
        reasoning: 'Разблокировка: заключение эксперта и закрытие CB-442. Оценка срока: 3–5 рабочих дней.',
        action: 'Открыть спор', actionHref: '/platform-v7/disputes/DK-2024-89',
      },
      {
        id: 'dl2', priority: 'medium',
        title: 'Частичный выпуск 70% возможен к проверке',
        reasoning: 'Лабораторный результат подтверждён. Спорная часть 10% (624 000 ₽) остаётся под удержанием до решения.',
        action: 'Проверить выпуск 70%',
      },
    ];
  }

  return [
    {
      id: 'def1', priority: 'medium',
      title: 'Недостаточно контекста для подсказки',
      reasoning: 'Выберите конкретную сделку или раздел для контекстной рекомендации.',
      action: 'Открыть центр управления', actionHref: '/platform-v7/control-tower',
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
  const { demoMode } = useSessionStore();
  const suggestions = getSuggestions(pathname);

  return (
    <>
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(15,20,25,0.2)' }}
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        role="complementary"
        aria-label="Помощник сделки"
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid #E4E6EA' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(10,122,95,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={16} color="#0A7A5F" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>Помощник сделки</div>
            <div style={{ fontSize: 11, color: '#6B778C' }}>
              Контекст: {pathname.split('/').pop() ?? 'платформа'}
              {demoMode ? ' · тестовый контур' : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ color: '#6B778C', background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6 }} aria-label="Закрыть">
            <X size={16} />
          </button>
        </div>

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
                    title={demoMode ? 'Тестовый контур: действие отключено' : undefined}
                  >
                    {s.action} {demoMode && <span style={{ fontSize: 9, color: '#D97706' }}>(тестовый контур)</span>}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4E6EA', fontSize: 11, color: '#6B778C', textAlign: 'center' }}>
          Рекомендации основаны на данных платформы.
          {demoMode && ' В тестовом контуре используются проверочные данные.'}
        </div>
      </aside>
    </>
  );
}
