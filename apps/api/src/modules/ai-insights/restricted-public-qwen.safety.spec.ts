import {
  enforcePlatformGrounding,
  isUngroundedCropProtectionPrescription,
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

  it('does not remove a non-prescriptive registration boundary', () => {
    const text = 'Если химическая защита нужна, выбирайте только зарегистрированный для культуры и региона препарат и действуйте строго по этикетке.';
    expect(isUngroundedCropProtectionPrescription(text)).toBe(false);
    expect(stripUngroundedCropProtectionPrescriptions(text)).toBe(text);
  });

  it('removes a concrete brand plus per-hectare dose even without active-ingredient wording', () => {
    const flags: string[] = [];
    const answer = [
      'Для фитофтороза используйте препарат «Кумулин-М» в дозе 2,5 л/га.',
      'Для ржавчины — «Ридомил-Голд» в дозе 2,5–3 л/га.',
      'Сначала уточните регион, фазу культуры и признаки на листьях.',
    ].join('\n');

    const safe = stripUngroundedCropProtectionPrescriptions(answer, flags);

    expect(safe).not.toContain('Кумулин-М');
    expect(safe).not.toContain('Ридомил-Голд');
    expect(safe).not.toContain('л/га');
    expect(safe).toContain('уточните регион');
    expect(flags).toContain('UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_REMOVED');
  });
});

describe('verified platform decision authority boundary', () => {
  const grounding = {
    knowledgeVersion: 'test.v1',
    topic: 'acceptance-quality',
    title: 'Приёмка и качество',
    answer: 'При расхождении фиксируются факты и доказательства. Важное решение принимает уполномоченный участник.',
    facts: ['Спор является веткой исключения.'],
    maturity: 'Проверенный публичный процесс.',
    confidence: 'high' as const,
    sources: [],
  };

  it('removes an autonomous platform decision claim and preserves grounded next-step text', () => {
    const flags: string[] = [];
    const safe = enforcePlatformGrounding(
      [
        'Платформа автоматически примет решение по спору после дополнительной проверки.',
        'Расхождение фиксируется доказательствами.',
        'Важное решение принимает уполномоченный участник.',
      ].join('\n'),
      grounding,
      flags,
    );

    expect(safe).not.toContain('автоматически примет решение');
    expect(safe).toContain('Расхождение фиксируется доказательствами');
    expect(safe).toContain('Важное решение принимает уполномоченный участник');
    expect(flags).toContain('AUTONOMOUS_PLATFORM_DECISION_REMOVED');
  });

  it('removes a platform money-autonomy claim even when the rest of the answer is grounded', () => {
    const flags: string[] = [];
    const safe = enforcePlatformGrounding(
      'Система автоматически спишет деньги после фиксации расхождения. Расхождение фиксируется доказательствами.',
      grounding,
      flags,
    );

    expect(safe).not.toContain('спишет деньги');
    expect(safe).toContain('Расхождение фиксируется доказательствами');
    expect(flags).toContain('AUTONOMOUS_PLATFORM_DECISION_REMOVED');
  });

