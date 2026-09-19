import { describe, expect, it } from 'vitest';
import { GEKTA_PATHS, GEKTA_TOPICS, getGektaCopy } from '../../lib/gekta/content';
import { getGektaApplicationSchema, getGektaMetadata, getGektaTopicMetadata } from '../../lib/gekta/seo';

describe('Gekta SEO microsite contracts', () => {
  it('has independent RU EN ZH metadata and canonical language URLs', () => {
    expect(GEKTA_PATHS).toEqual({ ru: '/gekta', en: '/gekta/en', zh: '/gekta/zh' });
    const ru = getGektaMetadata('ru');
    const en = getGektaMetadata('en');
    const zh = getGektaMetadata('zh');
    expect(ru.title).toEqual({ absolute: 'Гекта — аграрный ИИ для сельского хозяйства и агробизнеса' });
    expect(en.title).not.toEqual(ru.title);
    expect(zh.title).not.toEqual(ru.title);
    expect(ru.description).not.toEqual(en.description);
    expect(en.description).not.toEqual(zh.description);
    expect(ru.alternates?.languages).toMatchObject({ 'ru-RU': '/gekta', en: '/gekta/en', 'zh-CN': '/gekta/zh', 'x-default': '/gekta' });
  });

  it('keeps the initial topic cluster finite, useful and unique', () => {
    expect(GEKTA_TOPICS).toHaveLength(7);
    expect(new Set(GEKTA_TOPICS.map((topic) => topic.slug)).size).toBe(7);
    expect(new Set(GEKTA_TOPICS.map((topic) => topic.h1)).size).toBe(7);
    expect(new Set(GEKTA_TOPICS.map((topic) => topic.description)).size).toBe(7);
    for (const topic of GEKTA_TOPICS) {
      expect(topic.tasks.length).toBeGreaterThanOrEqual(4);
      expect(topic.checklist.length).toBeGreaterThanOrEqual(5);
      expect(topic.prompt.length).toBeGreaterThan(40);
      expect(topic.related.length).toBeGreaterThanOrEqual(2);
      expect(getGektaTopicMetadata(topic).alternates?.canonical).toBe(`/gekta/${topic.slug}`);
    }
  });

  it('publishes truthful application schema without invented commercial or rating fields', () => {
    for (const locale of ['ru', 'en', 'zh'] as const) {
      const schema = getGektaApplicationSchema(locale) as unknown as Record<string, unknown>;
      expect(schema.applicationCategory).toBe('BusinessApplication');
      expect(schema.operatingSystem).toBe('Web');
      expect(schema.creator).toEqual(expect.objectContaining({ name: 'Прозрачная Цена' }));
      expect(schema.publisher).toEqual(expect.objectContaining({ name: 'Прозрачная Цена' }));
      expect(schema).not.toHaveProperty('aggregateRating');
      expect(schema).not.toHaveProperty('offers');
      expect(schema).not.toHaveProperty('review');
    }
  });

  it('keeps each locale body in its own language authority', () => {
    expect(getGektaCopy('ru').h1).toContain('аграрный ИИ');
    expect(getGektaCopy('en').h1).toContain('agricultural AI');
    expect(getGektaCopy('zh').h1).toContain('农业 AI');
    expect(getGektaCopy('en').h1).not.toContain('сельского');
    expect(getGektaCopy('zh').h1).not.toContain('agricultural AI');
  });
});
