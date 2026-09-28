import {
  currentEvidenceVerdict,
  isUngroundedCropProtectionPrescription,
  normalizeForComparison,
  platformGroundingVerdict,
  stripUngroundedCropProtectionPrescriptions,
} from './restricted-public-qwen.safety';

describe('restricted public crop-protection prescription boundary', () => {
  it('removes screenshot-shaped active-ingredient prescriptions but keeps stable prevention advice', () => {
    const flags: string[] = [];
    const answer = [
      'Применяйте препараты на основе манкозеба или металаксила.',
      'Проводите санитарную уборку поражённых листьев и следите за длительностью увлажнения кроны.',
    ].join(' ');

    const safe = stripUngroundedCropProtectionPrescriptions(answer, flags);

    expect(safe).not.toContain('манкозеба');
    expect(safe).not.toContain('металаксила');
    expect(safe).toContain('санитарную уборку');
    expect(flags).toContain('UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_REMOVED');
  });


  it('removes named crop-protection products with exact per-hectare doses', () => {
    const flags: string[] = [];
    const answer = [
      'Для фитофтороза используйте препарат «Кумулин-М» в дозе 2,5 л/га.',
      'Для ржавчины — «Ридомил-Голд» в дозе 2,5–3 л/га.',
      'Сначала уточните регион, фазу культуры и диагноз.',
    ].join('\n');

    const safe = stripUngroundedCropProtectionPrescriptions(answer, flags);

    expect(safe).not.toContain('Кумулин-М');
    expect(safe).not.toContain('Ридомил-Голд');
    expect(safe).not.toMatch(/л\/га/u);
    expect(safe).toContain('уточните регион');
    expect(flags).toContain('UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_REMOVED');
  });

  it('removes exact crop-protection repeat intervals and keeps non-chemical monitoring advice', () => {
    const flags: string[] = [];
    const answer = [
      'Фунгицид X: повтор обработки через 10 дней.',
      'Повторно осмотрите пятна и динамику поражения через несколько дней.',
    ].join('\n');

    const safe = stripUngroundedCropProtectionPrescriptions(answer, flags);

    expect(safe).not.toContain('10 дней');
    expect(safe).toContain('Повторно осмотрите');
    expect(flags).toContain('UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_REMOVED');
  });

  it('rejects unsupported current sell/buy advice and directional market claims', () => {
    expect(currentEvidenceVerdict('Не продавайте сегодня.')).toBe(false);
    expect(currentEvidenceVerdict('Сейчас лучше покупать.')).toBe(false);
    expect(currentEvidenceVerdict('Цена может быть ниже рыночной.')).toBe(false);
    expect(currentEvidenceVerdict('Market price may be lower next week.')).toBe(false);
    expect(currentEvidenceVerdict('Сравните текущую оферту с подтверждённой котировкой.')).toBe(true);
  });

  it('rejects ungrounded platform automation while preserving an explicit non-automation boundary', () => {
    const authority = normalizeForComparison(
      'Расхождение фиксируется доказательствами. Важное решение принимает уполномоченный участник.',
    );

    const automated = platformGroundingVerdict('Система автоматически зафиксирует расхождение.', authority);
    expect(automated.keep).toBe(false);
    expect(automated.flags).toContain('UNSUPPORTED_PLATFORM_AUTONOMY_REMOVED');

    const boundary = platformGroundingVerdict('Система не будет автоматически решать спор.', authority);
    expect(boundary.keep).toBe(true);
    expect(boundary.flags).not.toContain('UNSUPPORTED_PLATFORM_AUTONOMY_REMOVED');
  });

  it('does not remove a non-prescriptive registration boundary', () => {
    const text = 'Если химическая защита нужна, выбирайте только зарегистрированный для культуры и региона препарат и действуйте строго по этикетке.';
    expect(isUngroundedCropProtectionPrescription(text)).toBe(false);
    expect(stripUngroundedCropProtectionPrescriptions(text)).toBe(text);
  });
});
