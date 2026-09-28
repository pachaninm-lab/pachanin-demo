import {
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


  it('removes named crop-protection products with per-hectare doses from the live failure shape', () => {
    const flags: string[] = [];
    const answer = [
      'Для фитофтороза используйте препарат «Кумулин-М» в дозе 2,5 л/га.',
      'Для ржавчины — «Ридомил-Голд» в дозе 2,5–3 л/га.',
      'Сначала уточните регион, фазу развития культуры и характер пятен.',
    ].join(' ');

    const safe = stripUngroundedCropProtectionPrescriptions(answer, flags);

    expect(safe).not.toContain('Кумулин-М');
    expect(safe).not.toContain('Ридомил-Голд');
    expect(safe).not.toMatch(/2,5(?:–3)?\s*л\/га/u);
    expect(safe).toContain('уточните регион');
    expect(flags).toContain('UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_REMOVED');
  });

  it('does not confuse an agronomic seeding rate with a crop-protection dose', () => {
    const text = 'Норма высева в этом примере — 200 кг/га; фактическую норму уточняют по массе тысячи семян и всхожести.';
    expect(isUngroundedCropProtectionPrescription(text)).toBe(false);
    expect(stripUngroundedCropProtectionPrescriptions(text)).toBe(text);
  });

  it('does not remove a non-prescriptive registration boundary', () => {
    const text = 'Если химическая защита нужна, выбирайте только зарегистрированный для культуры и региона препарат и действуйте строго по этикетке.';
    expect(isUngroundedCropProtectionPrescription(text)).toBe(false);
    expect(stripUngroundedCropProtectionPrescriptions(text)).toBe(text);
  });
});
