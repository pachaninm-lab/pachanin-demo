import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';

export type TemplateId =
  | 'contract_sale'         // Договор купли-продажи
  | 'acceptance_act'        // Акт приёмки-передачи
  | 'quality_certificate'   // Сертификат качества
  | 'transport_waybill'     // Транспортная накладная (ЭТрН)
  | 'invoice_upd'           // Счёт-фактура / УПД
  | 'arbitrator_ruling'     // Решение арбитра
  | 'reconciliation_act';   // Акт сверки

const CURRENT_TEMPLATE_VERSIONS: Record<TemplateId, string> = {
  contract_sale: '2.1.0',
  acceptance_act: '1.3.0',
  quality_certificate: '1.2.0',
  transport_waybill: '1.0.0',
  invoice_upd: '2.0.0',
  arbitrator_ruling: '1.1.0',
  reconciliation_act: '1.0.0',
};

const TEMPLATES: Record<TemplateId, string> = {
  contract_sale: `ДОГОВОР КУПЛИ-ПРОДАЖИ ЗЕРНА № {{contractNumber}}

г. {{city}}, {{date}}

Продавец: {{sellerName}}, ИНН {{sellerInn}}, именуемый далее «Продавец»
Покупатель: {{buyerName}}, ИНН {{buyerInn}}, именуемый далее «Покупатель»

1. ПРЕДМЕТ ДОГОВОРА
1.1. Продавец продаёт, а Покупатель покупает {{culture}} {{cropClass}} класса
     в количестве {{volumeTons}} тонн по цене {{pricePerTon}} ₽/тонна.
1.2. Общая стоимость: {{totalRub}} рублей ({{totalKopecks}} копеек).
1.3. ГОСТ: {{gost}}. Регион происхождения: {{region}}.

2. УСЛОВИЯ ПОСТАВКИ
2.1. Базис поставки: {{deliveryBasis}}.
2.2. Место отгрузки: {{shipmentPoint}}.
2.3. Срок поставки: до {{deliveryDeadline}}.

3. РАСЧЁТЫ
3.1. Оплата через защищённый счёт платформы GrainFlow (escrow).
3.2. Комиссия платформы: {{commission}} ₽ ({{commissionPct}}%).
3.3. Освобождение средств: после подписания акта приёмки и сертификата качества.

4. КАЧЕСТВО
4.1. Влажность: не более {{moisturePct}}%.
4.2. Сорная примесь: не более {{impurityPct}}%.
4.3. Клейковина (для пшеницы): не менее {{glutenPct}}%.

5. ПОРЯДОК ПОДПИСАНИЯ
Договор подписан с применением усиленной квалифицированной электронной подписи (УКЭП)
в соответствии с Федеральным законом №63-ФЗ «Об электронной подписи».

Сделка ID: {{dealId}}
Версия шаблона: {{templateVersion}}
Хеш документа: {{documentHash}}`,

  acceptance_act: `АКТ ПРИЁМКИ-ПЕРЕДАЧИ ЗЕРНА № {{actNumber}}

к Договору № {{contractNumber}} от {{contractDate}}

Дата составления: {{actDate}}
Место: {{acceptancePlace}}

ПРОДАВЕЦ: {{sellerName}} ({{sellerInn}})
ПОКУПАТЕЛЬ: {{buyerName}} ({{buyerInn}})
ЭЛЕВАТОР/СКЛАД: {{elevatorName}}

Фактически принято:
- Культура: {{culture}}, класс {{cropClass}}
- Масса брутто: {{grossTons}} тонн
- Масса тары: {{tareTons}} тонн
- Масса нетто: {{netTons}} тонн
- Влажность: {{moisturePct}}%
- Сорная примесь: {{impurityPct}}%
- Зерновая примесь: {{grainImpurityPct}}%

Соответствие стандарту: {{qualityConclusion}}
Лабораторный протокол: {{labProtocolNumber}}

Претензий к качеству и количеству нет / Имеются претензии: {{disputeNote}}

Сделка ID: {{dealId}}
Версия шаблона: {{templateVersion}}
Хеш документа: {{documentHash}}`,

  quality_certificate: `СЕРТИФИКАТ КАЧЕСТВА ЗЕРНА № {{certNumber}}

Культура: {{culture}}, класс {{cropClass}}
Партия: {{lotNumber}}
Объём: {{volumeTons}} тонн
Регион производства: {{region}}

Результаты лабораторного анализа (дата: {{analysisDate}}):
- Влажность: {{moisturePct}}%
- Сорная примесь: {{impurityPct}}%
- Зерновая примесь: {{grainImpurityPct}}%
- Клейковина: {{glutenPct}}%
- Натура: {{natureg}} г/л
- Белок: {{proteinPct}}%

ГОСТ: {{gost}}
Лаборатория: {{labName}} ({{labLicenseNumber}})
Лаборант: {{labAnalystName}}
Дата: {{analysisDate}}

Подписан УКЭП в соответствии с 63-ФЗ.
Версия шаблона: {{templateVersion}}
Хеш документа: {{documentHash}}`,

  transport_waybill: `ТРАНСПОРТНАЯ НАКЛАДНАЯ (ЭТрН) № {{waybillNumber}}

Дата: {{date}}
Перевозчик: {{carrierName}} ({{carrierInn}})
Водитель: {{driverName}}, ВУ {{driverLicense}}
ТС: {{vehicleNumber}}, грузоподъёмность {{cargoCapacityTons}} т

ГРУЗООТПРАВИТЕЛЬ: {{shipperName}} ({{shipperInn}})
ГРУЗОПОЛУЧАТЕЛЬ: {{consigneeName}} ({{consigneeInn}})

Пункт отправления: {{shipmentPoint}}
Пункт назначения: {{destinationPoint}}
Расстояние: {{distanceKm}} км

Груз: {{culture}}, {{volumeTons}} тонн
Масса: {{grossTons}} тонн (нетто {{netTons}} тонн)

Дата отправки: {{departedAt}}
Ожидаемая дата прибытия: {{etaAt}}

Сделка ID: {{dealId}}
Версия шаблона: {{templateVersion}}
Хеш документа: {{documentHash}}`,

  invoice_upd: `СЧЁТ-ФАКТУРА / УПД № {{invoiceNumber}} от {{invoiceDate}}

Продавец: {{sellerName}}, ИНН/КПП {{sellerInn}}/{{sellerKpp}}
Адрес: {{sellerAddress}}

Покупатель: {{buyerName}}, ИНН/КПП {{buyerInn}}/{{buyerKpp}}
Адрес: {{buyerAddress}}

Наименование: {{culture}} {{cropClass}} класс, ГОСТ {{gost}}
Единица измерения: тонна
Количество: {{volumeTons}}
Цена (без НДС): {{pricePerTonExclVat}} ₽/тонна
НДС %: {{vatRate}}%
Сумма без НДС: {{subtotalRub}} ₽
НДС: {{vatRub}} ₽
Итого с НДС: {{totalRub}} ₽

Основание: Договор № {{contractNumber}} от {{contractDate}}
Акт приёмки: № {{actNumber}} от {{actDate}}

Версия шаблона: {{templateVersion}}
Хеш документа: {{documentHash}}`,

  arbitrator_ruling: `РЕШЕНИЕ АРБИТРА № {{rulingNumber}}

Дело о споре по сделке ID: {{dealId}}
Дата решения: {{rulingDate}}
Арбитр: {{arbitratorName}}

Стороны спора:
- Истец: {{claimantName}} ({{claimantOrgId}})
- Ответчик: {{respondentName}} ({{respondentOrgId}})

Предмет спора: {{disputeSubject}}

Решение: {{outcomeText}}

Финансовые последствия:
- Сумма к возврату покупателю: {{refundKopecks}} коп.
- Сумма к выплате продавцу: {{releaseKopecks}} коп.
- Штраф платформе: {{penaltyKopecks}} коп.

Основание: {{reasonText}}
Срок исполнения: {{executionDeadline}}

Решение окончательное и обязательно к исполнению.
Версия шаблона: {{templateVersion}}
Хеш документа: {{documentHash}}`,

  reconciliation_act: `АКТ СВЕРКИ ВЗАИМОРАСЧЁТОВ

Период: с {{fromDate}} по {{toDate}}
Организация 1: {{org1Name}} ({{org1Inn}})
Организация 2: {{org2Name}} ({{org2Inn}})

Сделки за период:
{{#each deals}}
{{@index+1}}. Договор №{{contractNumber}} от {{date}} — {{totalRub}} ₽ ({{status}})
{{/each}}

Итого сделок: {{dealsCount}}
Общая сумма: {{totalGmvRub}} ₽
Задолженность Организации 1 перед Организацией 2: {{debt12Rub}} ₽
Задолженность Организации 2 перед Организацией 1: {{debt21Rub}} ₽

Версия шаблона: {{templateVersion}}
Хеш документа: {{documentHash}}`,
};

@Injectable()
export class DocumentTemplateService {
  listTemplates(): Array<{ id: TemplateId; name: string; version: string; requiredFields: string[] }> {
    return Object.keys(TEMPLATES).map(id => ({
      id: id as TemplateId,
      name: this.getTemplateName(id as TemplateId),
      version: CURRENT_TEMPLATE_VERSIONS[id as TemplateId],
      requiredFields: this.extractFields(id as TemplateId),
    }));
  }

  generateDocument(templateId: TemplateId, variables: Record<string, string | number>): {
    templateId: TemplateId;
    templateVersion: string;
    content: string;
    hash: string;
    generatedAt: string;
  } {
    const template = TEMPLATES[templateId];
    if (!template) throw new NotFoundException(`Template ${templateId} not found`);

    const version = CURRENT_TEMPLATE_VERSIONS[templateId];
    const enriched = {
      ...variables,
      templateVersion: version,
      documentHash: 'PLACEHOLDER',
    };

    let content = template;
    for (const [key, value] of Object.entries(enriched)) {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value ?? ''));
    }

    // Replace missing variables with empty string
    content = content.replace(/\{\{[^}]+\}\}/g, '');

    const hash = createHash('sha256').update(content).digest('hex');
    // Replace placeholder with actual hash
    content = content.replace('PLACEHOLDER', hash);

    return {
      templateId,
      templateVersion: version,
      content,
      hash,
      generatedAt: new Date().toISOString(),
    };
  }

  private getTemplateName(id: TemplateId): string {
    const names: Record<TemplateId, string> = {
      contract_sale: 'Договор купли-продажи зерна',
      acceptance_act: 'Акт приёмки-передачи зерна',
      quality_certificate: 'Сертификат качества зерна',
      transport_waybill: 'Транспортная накладная (ЭТрН)',
      invoice_upd: 'Счёт-фактура / УПД',
      arbitrator_ruling: 'Решение арбитра',
      reconciliation_act: 'Акт сверки взаиморасчётов',
    };
    return names[id];
  }

  private extractFields(id: TemplateId): string[] {
    const template = TEMPLATES[id] ?? '';
    const matches = template.match(/\{\{([^}#/@]+)\}\}/g) ?? [];
    const fields = new Set(matches.map(m => m.replace(/^\{\{|\}\}$/g, '').trim()));
    fields.delete('templateVersion');
    fields.delete('documentHash');
    return Array.from(fields);
  }
}
