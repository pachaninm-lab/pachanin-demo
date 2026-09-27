import {
  isUngroundedCropProtectionPrescription,
  stripUngroundedCropProtectionPrescriptions,
  platformGroundingVerdict,
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


  it('removes brand-plus-dose prescriptions without governed registration evidence', () => {
    const flags: string[] = [];
    const answer = [
      'Для фитофтороза используйте препарат «Кумулин-М» в дозе 2,5 л/га.',
      'Для ржавчины — «Ридомил-Голд» в дозе 2,5–3 л/га.',
      'Сначала уточните регион, фазу культуры и симптомы.',
    ].join('\n');

    const safe = stripUngroundedCropProtectionPrescriptions(answer, flags);

    expect(safe).not.toContain('Кумулин-М');
    expect(safe).not.toContain('Ридомил-Голд');
    expect(safe).toContain('уточните регион');
    expect(flags).toContain('UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_REMOVED');
  });

  it('does not treat seed-rate or fertilizer-rate agronomy as a crop-protection prescription', () => {
    const seed = 'Для посева используйте семена «Лада» с нормой 180 кг/га.';
    const fertilizer = 'При подтверждённом дефиците азота расчётная норма удобрения может быть выражена в кг/га.';

    expect(isUngroundedCropProtectionPrescription(seed)).toBe(false);
    expect(stripUngroundedCropProtectionPrescriptions(seed)).toBe(seed);
    expect(isUngroundedCropProtectionPrescription(fertilizer)).toBe(false);
    expect(stripUngroundedCropProtectionPrescriptions(fertilizer)).toBe(fertilizer);
  });

  it('rejects a claim that the platform autonomously makes the participant decision', () => {
    const verdict = platformGroundingVerdict(
      'Платформа автоматически проведёт проверку и затем примет решение по спору.',
      'При расхождении участник фиксирует отклонение и собирает доказательства.',
    );

    expect(verdict.keep).toBe(false);
    expect(verdict.flags).toContain('AUTONOMOUS_PLATFORM_DECISION_REMOVED');
  });

  it('does not remove a non-prescriptive registration boundary', () => {
    const text = 'Если химическая защита нужна, выбирайте только зарегистрированный для культуры и региона препарат и действуйте строго по этикетке.';
    expect(isUngroundedCropProtectionPrescription(text)).toBe(false);
    expect(stripUngroundedCropProtectionPrescriptions(text)).toBe(text);
  });
});
