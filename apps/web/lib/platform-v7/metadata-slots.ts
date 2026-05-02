export type PlatformV7MetadataStatus = 'available' | 'partial' | 'requires_connection';

export type PlatformV7MetadataSlot = {
  readonly key: string;
  readonly label: string;
  readonly status: PlatformV7MetadataStatus;
  readonly value: string;
  readonly source: string;
};

export type PlatformV7MetadataInput = {
  readonly key: string;
  readonly label: string;
  readonly value?: string | null;
  readonly source?: string;
  readonly fallback?: string;
};

export function createPlatformV7MetadataSlot(input: PlatformV7MetadataInput): PlatformV7MetadataSlot {
  if (input.value && input.value.trim().length > 0) {
    return {
      key: input.key,
      label: input.label,
      status: 'available',
      value: input.value,
      source: input.source ?? 'текущие данные',
    };
  }

  if (input.fallback && input.fallback.trim().length > 0) {
    return {
      key: input.key,
      label: input.label,
      status: 'partial',
      value: input.fallback,
      source: input.source ?? 'тестовый сценарий',
    };
  }

  return {
    key: input.key,
    label: input.label,
    status: 'requires_connection',
    value: 'требует подключения',
    source: input.source ?? 'внешняя система',
  };
}

export function createPlatformV7EvidenceMetadata(input: {
  readonly actor?: string | null;
  readonly timestamp?: string | null;
  readonly geo?: string | null;
  readonly fileHash?: string | null;
  readonly version?: string | null;
}): readonly PlatformV7MetadataSlot[] {
  return [
    createPlatformV7MetadataSlot({ key: 'actor', label: 'Участник', value: input.actor }),
    createPlatformV7MetadataSlot({ key: 'timestamp', label: 'Время', value: input.timestamp }),
    createPlatformV7MetadataSlot({ key: 'geo', label: 'Гео', value: input.geo, source: 'GPS / телематика' }),
    createPlatformV7MetadataSlot({ key: 'fileHash', label: 'Хэш файла', value: input.fileHash, source: 'файловое хранилище' }),
    createPlatformV7MetadataSlot({ key: 'version', label: 'Версия', value: input.version, source: 'журнал версий' }),
  ];
}

export function hasMissingPlatformV7Metadata(slots: readonly PlatformV7MetadataSlot[]): boolean {
  return slots.some((slot) => slot.status === 'requires_connection');
}
