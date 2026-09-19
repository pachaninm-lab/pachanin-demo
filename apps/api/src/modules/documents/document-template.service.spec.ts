import { createHash } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { DocumentTemplateService } from './document-template.service';

/**
 * ASVS V1.2.9 и V1.3.12. Отправитель задавал и имена свойств тела, и значения;
 * имена шли телом регулярного выражения без экранирования, значения — строкой
 * замены, в которой `$&` и `` $` `` особые. Здесь проверяется, что ни то, ни
 * другое больше не влияет ни на что, кроме собственного поля.
 */
describe('DocumentTemplateService — поле подставляется, а не исполняется', () => {
  const service = new DocumentTemplateService();

  function generate(variables: Record<string, string | number>) {
    return service.generateDocument('contract_sale', variables);
  }

  it('подставляет обычные значения', () => {
    const { content } = generate({ sellerName: 'ООО «Агро»' });
    expect(content).toContain('ООО «Агро»');
    expect(content).not.toContain('{{sellerName}}');
  });

  it('не даёт ключу с метасимволами тронуть чужие поля', () => {
    // `.*` строил выражение \{\{.*\}\} и переписывал разом всё.
    const captured = generate({ '.*': 'ЗАХВАЧЕНО' });
    const honest = generate({});
    expect(captured.content).not.toContain('ЗАХВАЧЕНО');
    // Документ тот же, что и без этого ключа: ключ просто не совпал ни с чем.
    expect(captured.content).toBe(honest.content);
  });

  it('не даёт ключу задать катастрофический возврат', () => {
    // Ключ "(.*)*x" на обычном договоре не завершался за две минуты и занимал
    // event loop целиком. Регулярное выражение теперь постоянное, поэтому
    // время не зависит от ключа вовсе.
    const started = Date.now();
    const { content } = generate({ '(.*)*x': 'y', '(a+)+b': 'y', '(\\s|\\w)+$': 'y' });
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(content).not.toContain('y');
  });

  it('не даёт значению вклеить в поле содержимое документа', () => {
    // `$\`` вставляет всё, что стояло до совпадения. Сравнение идёт с обычным
    // значением, а не с числом из головы: «ДОГОВОР» встречается в шаблоне
    // дважды само по себе, и склейка была бы видна как рост этого числа.
    const baseline = generate({ sellerName: 'ООО «Агро»' });
    const injected = generate({ sellerName: '$`' });
    expect(injected.content).toContain('$`');
    expect(injected.content.match(/ДОГОВОР/gu) ?? []).toHaveLength(
      (baseline.content.match(/ДОГОВОР/gu) ?? []).length,
    );
  });

  it('оставляет остальные последовательности замены буквальными', () => {
    const { content } = generate({ sellerName: "$& $' $1 $$" });
    expect(content).toContain("$& $' $1 $$");
  });

  it('не даёт значению ввести новый плейсхолдер', () => {
    // Подстановка шла итеративно, и значение раннего ключа сканировалось
    // следующими: {"a": "{{b}}", "b": "X"} давало X.
    //
    // Имя берётся то, которого в шаблоне нет: иначе значение подставилось бы в
    // собственное поле шаблона и тест прошёл бы, ничего не проверив.
    const { content } = generate({
      sellerName: '{{notATemplateField}}',
      notATemplateField: 'ПРОСОЧИЛОСЬ',
    });
    expect(content).toContain('{{notATemplateField}}');
    expect(content).not.toContain('ПРОСОЧИЛОСЬ');
  });

  it('не отдаёт хеш полю отправителя, назвавшемуся сентинелом', () => {
    // Замена шла по первому вхождению строки в документе, поэтому значение
    // PLACEHOLDER в поле, стоящем раньше поля хеша, забирало хеш себе.
    const { content, hash } = generate({ sellerName: 'PLACEHOLDER' });
    expect(content).toContain(`Хеш документа: ${hash}`);
    expect(content).toContain('PLACEHOLDER');
  });

  it('не даёт отправителю переписать версию шаблона и поле хеша', () => {
    const { content, templateVersion, hash } = generate({
      templateVersion: 'ПОДДЕЛКА',
      documentHash: 'ПОДДЕЛКА',
    });
    expect(content).toContain(`Версия шаблона: ${templateVersion}`);
    expect(content).toContain(`Хеш документа: ${hash}`);
    expect(content).not.toContain('ПОДДЕЛКА');
  });

  it('считает хеш по документу с сентинелом в поле хеша', () => {
    // Величина, по которой считается хеш, зафиксирована намеренно: изменить её
    // значит сломать проверку всех ранее выданных документов.
    const { content, hash } = generate({ sellerName: 'ООО «Агро»' });
    const withSentinel = content.replace(hash, 'PLACEHOLDER');
    expect(createHash('sha256').update(withSentinel).digest('hex')).toBe(hash);
  });

  it('оставляет незаполненное поле пустым', () => {
    const { content } = generate({});
    expect(content).not.toMatch(/\{\{[^}]+\}\}/u);
  });

  it('переносит пустое тело так же, как переносил спред', () => {
    // Найдено ревью на #4836: прежняя реализация раскрывала `variables`
    // спредом, и `{...null}` — это `{}`. Object.entries на null бросает, то
    // есть переход на один проход превратил бы пустой документ в 500.
    for (const body of [null, undefined, 'строка', 42]) {
      const { content, hash } = service.generateDocument(
        'contract_sale',
        body as never,
      );
      expect(content).toContain(`Хеш документа: ${hash}`);
      expect(content).not.toMatch(/\{\{[^}]+\}\}/u);
    }
  });

  it('отказывает на неизвестном шаблоне', () => {
    expect(() => service.generateDocument('нет-такого' as never, {})).toThrow(NotFoundException);
  });
});
