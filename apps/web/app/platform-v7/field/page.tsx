'use client';
import * as React from 'react';
import Link from 'next/link';
import { useOfflineQueueStore, type FieldEventType } from '@/stores/useOfflineQueueStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { Badge } from '@/components/v9/ui/badge';
import { Button } from '@/components/v9/ui/button';
import type { Role } from '@/lib/v9/roles';
import { toast } from 'sonner';

function genUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

type FieldRole = 'driver' | 'surveyor' | 'elevator' | 'lab';

const FIELD_ROLES: { value: FieldRole; label: string }[] = [
  { value: 'driver', label: 'Водитель' },
  { value: 'surveyor', label: 'Сюрвейер' },
  { value: 'elevator', label: 'Элеватор' },
  { value: 'lab', label: 'Лаборант' },
];

const roleConfig: Record<FieldRole, {
  accentColor: string;
  badgeLabel: string;
  heroTitle: string;
  heroSub: string;
  actionLabel: string;
  actionDesc: string;
  eventType: FieldEventType;
  eventPayload: Record<string, string>;
  tripRows: [string, string][];
  emergencyDesc: string;
}> = {
  driver: {
    accentColor: '#D97706',
    badgeLabel: 'ВОДИТЕЛЬ · РЕЙС ДОС-2847',
    heroTitle: 'Один экран — один шаг',
    heroSub: 'Полевая логика. Текущее действие, GPS и офлайн-очередь.',
    actionLabel: '✓ Подтвердить прибытие',
    actionDesc: 'Элеватор Черноземный · ETA 14:30',
    eventType: 'arrival',
    eventPayload: { location: 'Элеватор Черноземный', eta: '14:30' },
    tripRows: [
      ['Номер рейса', 'ДОС-2847'],
      ['Маршрут', 'Тамбов → Черноземный'],
      ['ETA', '14:30 (~45 мин)'],
      ['Водитель', 'Ковалёв А.С.'],
      ['ТС', 'В 445 АА 68'],
      ['Груз', 'Кукуруза · 20 т'],
      ['Сделка', 'DL-9102'],
    ],
    emergencyDesc: 'Проблема с грузом, ДТП, отказ в приёмке? Зафиксируй — создаст кейс в контроле.',
  },
  surveyor: {
    accentColor: '#7C3AED',
    badgeLabel: 'СЮРВЕЙЕР · ПРОВЕРКА ПАРТИИ DL-9102',
    heroTitle: 'Контроль качества на месте',
    heroSub: 'Взвешивание, отбор проб, протокол лаборатории.',
    actionLabel: '✓ Подтвердить взвешивание',
    actionDesc: 'Элеватор Черноземный · 200.3 т (отклонение 0.15%)',
    eventType: 'weighing',
    eventPayload: { location: 'Элеватор Черноземный', weight: '200.3', deviation: '0.15%' },
    tripRows: [
      ['Партия', 'BATCH-DL-9102-001'],
      ['Объект', 'Элеватор Черноземный'],
      ['Культура', 'Кукуруза · 20 т'],
      ['Назначение', 'Проверка качества'],
      ['Сделка', 'DL-9102'],
      ['Статус', 'Взвешивание выполнено'],
      ['Протокол', 'Передать лаборанту'],
    ],
    emergencyDesc: 'Расхождение по качеству или подозрение на фальсификацию? Немедленно создай спор.',
  },
  elevator: {
    accentColor: '#0891B2',
    badgeLabel: 'ЭЛЕВАТОР · ПРИЁМКА ГРУЗА',
    heroTitle: 'Приёмка на элеваторе',
    heroSub: 'Взвешивание, хранение, выдача накладной.',
    actionLabel: '✓ Подтвердить разгрузку',
    actionDesc: 'DL-9102 · Кукуруза 20 т · Ячейка E-14',
    eventType: 'unloading',
    eventPayload: { dealId: 'DL-9102', cell: 'E-14', weight: '20', crop: 'Кукуруза' },
    tripRows: [
      ['Сделка', 'DL-9102'],
      ['Груз', 'Кукуруза · 20 т'],
      ['Ячейка хранения', 'E-14'],
      ['Статус хранения', 'Принято'],
      ['Температура', '+12°C (норма)'],
      ['Влажность', '14.2% (норма ≤14%)'],
      ['Накладная', 'Сформирована'],
    ],
    emergencyDesc: 'Нарушение условий хранения или несоответствие веса? Сообщи немедленно.',
  },
  lab: {
    accentColor: '#BE185D',
    badgeLabel: 'ЛАБОРАНТ · АНАЛИЗ QC-DL-9102',
    heroTitle: 'Протокол лабораторного анализа',
    heroSub: 'Влажность, протеин, примеси — ввод и публикация результатов.',
    actionLabel: '✓ Опубликовать протокол',
    actionDesc: 'QC-DL-9102 · Кукуруза · Параметры зафиксированы',
    eventType: 'lab_result',
    eventPayload: { analysisId: 'QC-DL-9102', moisture: '16.2%', protein: '8.3%', impurities: '1.1%' },
    tripRows: [
      ['Анализ', 'QC-DL-9102'],
      ['Культура', 'Кукуруза · 20 т'],
      ['Влажность', '16.2% ⚠ (норма ≤14%)'],
      ['Протеин', '8.3% (норма ≥8%)'],
      ['Примесь сорная', '1.1% (норма ≤2%)'],
      ['ГМО', 'Отрицательно'],
      ['Статус', 'Расхождение — эскалируется'],
    ],
    emergencyDesc: 'Критическое расхождение или подозрение на фальсификацию образца? Немедленно создай спор.',
  },
};

function toFieldRole(role: Role): FieldRole {
  if (role === 'surveyor' || role === 'elevator' || role === 'lab' || role === 'driver') return role;
  return 'driver';
}

function RouteProgress({ color }: { color: string }) {
  const steps = [
    ['Выезд', '08:42 · хозяйство'],
    ['В пути', 'GPS активен'],
    ['Прибытие', 'ETA 14:30'],
    ['Приёмка', 'ожидает подтверждения'],
  ];
  return (
    <section className="v9-card">
      <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Маршрут</h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {steps.map(([title, note], index) => (
          <div key={title} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 10, alignItems: 'start' }}>
            <div style={{ width: 28, height: 28, borderRadius: 999, display: 'grid', placeItems: 'center', background: index < 2 ? color : `${color}18`, color: index < 2 ? '#fff' : color, fontSize: 12, fontWeight: 800 }}>
              {index < 2 ? '✓' : index + 1}
            </div>
            <div style={{ paddingBottom: 8, borderBottom: index === steps.length - 1 ? 'none' : '1px solid #E4E6EA' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0F1419' }}>{title}</div>
              <div style={{ fontSize: 12, color: '#6B778C', marginTop: 2 }}>{note}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function FieldPage() {
  const { events, isOnline, enqueue, pendingCount } = useOfflineQueueStore();
  const { role } = useSessionStore();
  const [previewRole, setPreviewRole] = React.useState<FieldRole>(() => toFieldRole(role as Role));
  const canPreview = role === 'operator' || role === 'admin';
  const activeRole = canPreview ? previewRole : toFieldRole(role as Role);
  const pending = pendingCount();
  const cfg = roleConfig[activeRole];

  const handleAction = () => {
    enqueue({
      id: genUUID(),
      dealId: 'DL-9102',
      type: cfg.eventType,
      timestamp: new Date().toISOString(),
      payload: cfg.eventPayload,
    });
    toast.success(`[SANDBOX] Событие "${cfg.eventType}" зафиксировано`);
  };

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {canPreview && (
        <section className="v9-card" style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B778C', letterSpacing: '0.06em' }}>Предпросмотр роли</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FIELD_ROLES.map((item) => (
              <button key={item.value} onClick={() => setPreviewRole(item.value)} style={{ padding: '8px 12px', borderRadius: 999, border: `1px solid ${previewRole === item.value ? cfg.accentColor : '#E4E6EA'}`, background: previewRole === item.value ? `${cfg.accentColor}12` : '#fff', color: previewRole === item.value ? cfg.accentColor : '#495057', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                {item.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {!isOnline && (
        <div role="status" aria-live="assertive" style={{ padding: '10px 16px', background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706' }}>OFFLINE</span>
          <span style={{ fontSize: 12, color: '#D97706' }}>В очереди: {pending} событий — отправятся при подключении</span>
        </div>
      )}

      <div style={{ borderLeft: `4px solid ${cfg.accentColor}`, paddingLeft: 16 }}>
        <div>
          <Badge style={{ background: `${cfg.accentColor}18`, color: cfg.accentColor, borderColor: `${cfg.accentColor}40` }}>
            {cfg.badgeLabel}
          </Badge>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F1419', margin: '8px 0 4px' }}>{cfg.heroTitle}</h1>
        <p style={{ fontSize: 13, color: '#6B778C', margin: 0 }}>{cfg.heroSub}</p>
      </div>

      <div style={{ padding: 20, background: `${cfg.accentColor}10`, borderRadius: 12, border: `1px solid ${cfg.accentColor}25` }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: cfg.accentColor, letterSpacing: '0.06em' }}>Следующий шаг</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8, lineHeight: 1.2, color: '#0F1419' }}>
          {cfg.actionLabel.replace('✓ ', '')}
        </div>
        <div style={{ fontSize: 13, color: '#6B778C', marginTop: 6 }}>{cfg.actionDesc}</div>
        <button
          onClick={handleAction}
          style={{
            marginTop: 16, width: '100%', minHeight: 64,
            background: cfg.accentColor, color: '#fff', border: 'none',
            borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {cfg.actionLabel}
        </button>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <Badge variant="success">GPS активен</Badge>
          {pending > 0 && <Badge variant="warning">{pending} событий offline</Badge>}
          <Badge variant="neutral">DL-9102 · Активна</Badge>
        </div>
      </div>

      {activeRole === 'driver' && <RouteProgress color={cfg.accentColor} />}

      <section className="v9-card">
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
          {activeRole === 'driver' ? 'Рейс' : activeRole === 'surveyor' ? 'Проверка' : activeRole === 'elevator' ? 'Приёмка' : 'Анализ'}
        </h2>
        {cfg.tripRows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid #E4E6EA', fontSize: 13 }}>
            <div style={{ width: 130, flexShrink: 0, color: '#6B778C', fontSize: 12 }}>{k}</div>
            <div style={{ fontWeight: 500, color: v.includes('⚠') ? '#D97706' : '#0F1419' }}>{v}</div>
          </div>
        ))}
      </section>

      <section className="v9-card">
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Офлайн-очередь</h2>
        {events.length === 0 ? (
          <div style={{ padding: '10px 0', fontSize: 12, color: '#6B778C' }}>Очередь пуста. Новые события будут сохранены здесь при слабой связи.</div>
        ) : events.map(e => (
          <div key={e.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid #E4E6EA' }}>
            <div style={{ fontSize: 11, color: '#6B778C', minWidth: 50 }}>
              {new Date(e.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{e.type}</div>
              <Badge variant={e.synced ? 'success' : 'warning'}>{e.synced ? 'Отправлено' : 'Ожидает связи'}</Badge>
            </div>
          </div>
        ))}
      </section>

      <section className="v9-card" style={{ background: 'rgba(220,38,38,0.03)', border: '1px solid rgba(220,38,38,0.18)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#DC2626', letterSpacing: '0.06em', marginBottom: 8 }}>Аварийный блок</div>
        <p style={{ fontSize: 13, color: '#495057', margin: '0 0 12px' }}>{cfg.emergencyDesc}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="danger" asChild>
            <Link href="/platform-v7/disputes">⚠ Сообщить о проблеме</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/platform-v7/deals/DL-9102">Открыть сделку</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
