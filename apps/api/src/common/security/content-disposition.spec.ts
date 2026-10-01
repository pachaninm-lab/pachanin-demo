import { attachmentDisposition } from './content-disposition';

/**
 * ASVS 5.0 V5.4.1 и V5.4.2. Имя файла, попадающее в заголовок ответа, обязано
 * быть закодировано так, чтобы не менять структуру самого заголовка.
 *
 * Сборщик существовал под V3.2.1 и был написан правильно; проверок у него не
 * было ни одной. Здесь фиксируются те его свойства, на которые опираются
 * экспортные маршруты.
 */
describe('attachmentDisposition', () => {
  it('выдаёт обе формы имени', () => {
    const value = attachmentDisposition('ledger-7f3a.csv');
    expect(value).toBe(
      `attachment; filename="ledger-7f3a.csv"; filename*=UTF-8''ledger-7f3a.csv`,
    );
  });

  it('не даёт кавычке открыть второй параметр filename', () => {
    // Ровно то, что делал ручной сбор: dealId с кавычкой давал в заголовке два
    // параметра filename, и какой возьмёт браузер — его дело.
    const value = attachmentDisposition('ledger-x"; filename="ledger.csv.exe-1.csv');
    const parameters = value.match(/filename="/gu) ?? [];
    expect(parameters).toHaveLength(1);
    expect(value).not.toContain('"; filename="ledger.csv.exe');
  });

  it('кодирует кириллицу, а не отдаёт её сырой', () => {
    const value = attachmentDisposition('сделка-№1.csv');
    // ASCII-форма остаётся представимой...
    expect(value).toContain('attachment; filename="');
    expect(value).toMatch(/filename="[\u0020-\u007e]*"/u);
    // ...а точное имя едет во второй форме.
    expect(value).toContain("filename*=UTF-8''");
    expect(decodeURIComponent(value.split("filename*=UTF-8''")[1])).toBe('сделка-№1.csv');
  });

  it('вырезает управляющие символы, а не полагается на отказ Node', () => {
    // Node сам отвергает CR и LF в значении заголовка (ERR_INVALID_CHAR), но
    // полагаться на это значило бы отдать 500 вместо файла.
    const value = attachmentDisposition('ledger-x\r\nX-Injected: yes.csv');
    expect(value).not.toMatch(/[\r\n]/u);
    // Остаток текста в имени безвреден намеренно: примитив разрыва - это сам
    // перевод строки, а не слова после него. Утверждать, что из имени пропадает
    // всё похожее на заголовок, значило бы проверять не то свойство.
    expect(value).toContain('filename="ledger-xX-Injected: yes.csv"');
  });

  it('не даёт разделителю пути стать подсказкой каталога', () => {
    expect(attachmentDisposition('../../etc/passwd')).toContain('filename="passwd"');
    expect(attachmentDisposition('C:\\Windows\\win.ini')).toContain('filename="win.ini"');
  });

  it('на пустом имени возвращает голое attachment', () => {
    expect(attachmentDisposition('')).toBe('attachment');
    expect(attachmentDisposition(undefined)).toBe('attachment');
    expect(attachmentDisposition('   ')).toBe('attachment');
  });
});
