import Link from 'next/link';
import { PageFrame } from '../../components/page-frame';
import { PageAccessGuard } from '../../components/page-access-guard';
import { ALL_AUTHENTICATED_ROLES } from '../../lib/route-roles';
import { serverApiUrl, serverAuthHeaders } from '../../lib/server-api';

type AssistantCatalog = {
  title: string;
  mode: 'local-first' | 'hybrid';
  note: string;
  totalCoverageEstimate: number;
  platformTopicCount: number;
  generatedPromptCount: number;
  customPromptCount: number;
  topics: Array<{
    id: string;
    title: string;
    summary: string;
    nearby: string[];
    sampleQuestions: string[];
  }>;
  starterPrompts: string[];
};

async function getCatalog(): Promise<AssistantCatalog | null> {
  try {
    const response = await fetch(serverApiUrl('/ai-assistant/catalog'), {
      cache: 'no-store',
      headers: serverAuthHeaders()
    });
    if (!response.ok) return null;
    return response.json() as Promise<AssistantCatalog>;
  } catch {
    return null;
  }
}

export default async function AssistantPage() {
  const catalog = await getCatalog();
  const topics = catalog?.topics || [];
  return (
    <PageAccessGuard allowedRoles={[...ALL_AUTHENTICATED_ROLES]} title="Помощник доступен только после входа" subtitle="После входа помощник работает с ролью, контекстом страницы и встроенной локальной базой знаний.">
      <PageFrame title="Встроенный помощник" subtitle="Локальный помощник по платформе: объясняет логику, роли, документы, деньги, спор, логистику и ближайшие темы без обязательной зависимости от интернета.">
        <section className="detail-grid" style={{ marginBottom: 18 }}>
          <div className="section-card-tight">
            <div className="eyebrow">Режим</div>
            <div className="detail-title" style={{ marginTop: 8 }}>{catalog?.mode === 'hybrid' ? 'Гибридный режим помощника' : 'Локальный режим помощника'}</div>
            <div className="muted" style={{ marginTop: 10 }}>{catalog?.note || 'Основной контур ответа — локальная база знаний по платформе.'}</div>
          </div>
          <div className="section-card-tight">
            <div className="eyebrow">Покрытие</div>
            <div className="detail-title" style={{ marginTop: 8 }}>{catalog?.totalCoverageEstimate?.toLocaleString('ru-RU') || '—'}</div>
            <div className="muted" style={{ marginTop: 10 }}>Оценка объёма локального знания по платформе, сценариям ролей и ближайшим темам.</div>
          </div>
          <div className="section-card-tight">
            <div className="eyebrow">Темы</div>
            <div className="detail-title" style={{ marginTop: 8 }}>{catalog?.platformTopicCount || topics.length || '—'}</div>
            <div className="muted" style={{ marginTop: 10 }}>Ключевые product/operator темы, которые помощник знает без обязательного обращения наружу.</div>
          </div>
          <div className="section-card-tight">
            <div className="eyebrow">Матрица вопросов</div>
            <div className="detail-title" style={{ marginTop: 8 }}>{catalog?.generatedPromptCount?.toLocaleString('ru-RU') || '—'}</div>
            <div className="muted" style={{ marginTop: 10 }}>Генерируемые формулировки, включая плохой сленг, опечатки и короткие follow-up вопросы.</div>
          </div>
        </section>

        <section className="section-card" style={{ marginBottom: 18 }}>
          <div className="panel-title-row">
            <div>
              <div className="dashboard-section-title">Что помощник уже умеет</div>
              <div className="dashboard-section-subtitle">Не просто чат. Это внутренняя опора по платформе, экрану, роли и объекту сделки.</div>
            </div>
            <Link href="/deals" className="primary-link">Открыть сделку</Link>
          </div>
          <div className="detail-grid" style={{ marginTop: 16 }}>
            {[
              'Объясняет платформу простыми словами и без инженерного шума.',
              'Подсказывает следующий шаг по текущему экрану и роли.',
              'Разбирает документы, логику денег, спор, логистику, лабораторию и приёмку.',
              'Понимает плохие формулировки, жаргон, смешанный русский/английский и короткие follow-up вопросы.',
              'Может работать как внешний помощник роли и как внутренняя опора для оператора.'
            ].map((item) => (
              <div key={item} className="soft-box">{item}</div>
            ))}
          </div>
        </section>

        <section className="section-card" style={{ marginBottom: 18 }}>
          <div className="panel-title-row">
            <div>
              <div className="dashboard-section-title">Стартовые вопросы</div>
              <div className="dashboard-section-subtitle">То, что можно задать в любой формулировке прямо из виджета внизу справа.</div>
            </div>
          </div>
          <div className="detail-meta" style={{ marginTop: 16, flexWrap: 'wrap', gap: 10 }}>
            {(catalog?.starterPrompts || []).map((item) => <span key={item} className="mini-chip">{item}</span>)}
          </div>
        </section>

        <section className="section-card">
          <div className="panel-title-row">
            <div>
              <div className="dashboard-section-title">Карта знаний</div>
              <div className="dashboard-section-subtitle">Основные темы, которые помощник знает локально и использует как основу ответа.</div>
            </div>
          </div>
          <div className="detail-grid" style={{ marginTop: 16 }}>
            {topics.map((topic) => (
              <div key={topic.id} className="section-card-tight">
                <div className="dashboard-section-title" style={{ fontSize: 16 }}>{topic.title}</div>
                <div className="muted" style={{ marginTop: 8 }}>{topic.summary}</div>
                <div className="detail-meta" style={{ marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
                  {topic.nearby.slice(0, 3).map((item) => <span key={item} className="mini-chip">{item}</span>)}
                </div>
                <div className="soft-box" style={{ marginTop: 12 }}>
                  <b>Примеры:</b>
                  <div className="muted tiny" style={{ marginTop: 6 }}>{topic.sampleQuestions.join(' · ')}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </PageFrame>
    </PageAccessGuard>
  );
}
