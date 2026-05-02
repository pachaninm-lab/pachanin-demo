import { describe, expect, it } from 'vitest';
import {
  createPlatformV7EvidenceMetadata,
  createPlatformV7MetadataSlot,
  hasMissingPlatformV7Metadata,
} from '@/lib/platform-v7/metadata-slots';

describe('platform-v7 metadata slots', () => {
  it('marks provided values as available', () => {
    expect(createPlatformV7MetadataSlot({ key: 'actor', label: 'Участник', value: 'Оператор' })).toEqual({
      key: 'actor',
      label: 'Участник',
      status: 'available',
      value: 'Оператор',
      source: 'текущие данные',
    });
  });

  it('uses fallback as partial data instead of pretending it is connected', () => {
    expect(createPlatformV7MetadataSlot({ key: 'timestamp', label: 'Время', fallback: 'по тестовому сценарию' })).toEqual({
      key: 'timestamp',
      label: 'Время',
      status: 'partial',
      value: 'по тестовому сценарию',
      source: 'тестовый сценарий',
    });
  });

  it('marks absent metadata as requiring connection', () => {
    expect(createPlatformV7MetadataSlot({ key: 'fileHash', label: 'Хэш файла', source: 'файловое хранилище' })).toEqual({
      key: 'fileHash',
      label: 'Хэш файла',
      status: 'requires_connection',
      value: 'требует подключения',
      source: 'файловое хранилище',
    });
  });

  it('creates evidence metadata without inventing missing geo or hash values', () => {
    const slots = createPlatformV7EvidenceMetadata({ actor: 'Водитель', timestamp: '2026-05-02T10:00:00.000Z' });

    expect(slots.find((slot) => slot.key === 'actor')?.status).toBe('available');
    expect(slots.find((slot) => slot.key === 'timestamp')?.status).toBe('available');
    expect(slots.find((slot) => slot.key === 'geo')?.status).toBe('requires_connection');
    expect(slots.find((slot) => slot.key === 'fileHash')?.status).toBe('requires_connection');
    expect(hasMissingPlatformV7Metadata(slots)).toBe(true);
  });
});
