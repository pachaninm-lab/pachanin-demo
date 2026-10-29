import http from 'node:http';
import net from 'node:net';
import { encodeLogField } from './log-encode';

/**
 * Подделка строки журнала (ASVS 5.0 V16.4.1).
 *
 * Запись в матрице утверждала: «a newline in that header produces a forged
 * additional log line». Это неверно, и набор ниже доказывает это на настоящем
 * HTTP-парсере Node, а не пересказывает: сырой LF в значении заголовка даёт
 * 400 Bad Request и до обработчика не доходит вовсе.
 *
 * Первая замена этому утверждению — «проходит U+2028» — тоже была неверной, и
 * это записано, а не заменено молча: Node декодирует значения заголовков как
 * latin1, поэтому три UTF-8 байта U+2028 приходят как три отдельные кодовые
 * точки (U+00E2, U+00A8 и, между ними, C1-байт U+0080).
 *
 * Верно измеренное: парсер отвергает блок C0 и DEL, а ВЕСЬ блок C1 —
 * U+0080..U+009F — пропускает. U+009B это CSI, восьмибитная форма вводителя
 * ANSI-последовательностей: сам ESC отвергнут, его эквивалент — нет, и
 * терминал, читающий журнал, ему подчиняется.
 *
 * Вердикт FAIL был верен. Вектор — другой, и полей два, а не одно: те же
 * байты измерены проходящими и через X-Forwarded-For, из которого при
 * trust proxy выводится req.ip.
 */

const LS = '\u2028';
const PS = '\u2029';
const NEL = '\u0085';
const CSI = '\u009b';
const ESC = '\u001b';
const NUL = '\u0000';
const TAB = '\u0009';

describe('encodeLogField — строку нельзя добавить, разорвать или перерисовать', () => {
  it.each([
    ['U+2028 LINE SEPARATOR', LS, '\\u2028'],
    ['U+2029 PARAGRAPH SEPARATOR', PS, '\\u2029'],
    ['U+0085 NEXT LINE', NEL, '\\x85'],
    ['U+009B C1 CSI', CSI, '\\x9b'],
    ['U+001B ESC', ESC, '\\x1b'],
    ['U+0000 NUL', NUL, '\\x00'],
    ['U+0009 TAB', TAB, '\\x09'],
    ['LF', '\n', '\\x0a'],
    ['CR', '\r', '\\x0d'],
  ])('%s экранируется', (_name, character, expected) => {
    const encoded = encodeLogField(`a${character}b`);
    expect(encoded).toBe(`a${expected}b`);
    expect(encoded).not.toContain(character);
  });

  it('подделанный хвост перестаёт быть отдельной строкой', () => {
    // Ровно та строка, которой измерялся вектор: одна строка при разбиении по
    // /[\r\n]/ и две — по юникодным терминаторам. После кодирования — одна по
    // обоим.
    const forged = `Mozilla${LS}Sep  3 23:00:00 api WARN admin bypassed the rate limit`;
    expect(forged.split(/[\r\n\u2028\u2029\u0085]/u)).toHaveLength(2);

    const encoded = encodeLogField(forged);
    expect(encoded.split(/[\r\n\u2028\u2029\u0085]/u)).toHaveLength(1);
    // Содержимое не выброшено: подделка обязана остаться видимой в журнале.
    expect(encoded).toContain('bypassed the rate limit');
  });

  it('обычный текст не портится', () => {
    // Обратная сторона. Без неё «экранируем всё подряд» прошло бы как успех, а
    // нечитаемый журнал — это журнал, который никто не смотрит.
    const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)';
    expect(encodeLogField(ua)).toBe(ua);
    expect(encodeLogField('Яндекс.Браузер 24.1 — «Прозрачная Цена»')).toBe(
      'Яндекс.Браузер 24.1 — «Прозрачная Цена»',
    );
  });

  it('обратная косая экранируется первой, иначе результат неоднозначен', () => {
    // Вызывающий, приславший четыре символа \x0a, и настоящий перевод строки
    // обязаны выглядеть в журнале по-разному.
    expect(encodeLogField('a\\x0ab')).toBe('a\\\\x0ab');
    expect(encodeLogField('a\nb')).toBe('a\\x0ab');
    expect(encodeLogField('a\\x0ab')).not.toBe(encodeLogField('a\nb'));
  });

  it('кавычка экранируется, потому что ею огорожено поле ua', () => {
    expect(encodeLogField('a"b')).toBe('a\\"b');
  });

  it('длина ограничена, и обрезка помечена', () => {
    const encoded = encodeLogField('x'.repeat(5000));
    expect(encoded.length).toBeLessThan(300);
    expect(encoded).toContain('[truncated]');
  });

  it('null и undefined дают прочерк, а не строку «null»', () => {
    expect(encodeLogField(null)).toBe('-');
    expect(encodeLogField(undefined)).toBe('-');
  });

  it('не строки приводятся, а не пропускаются', () => {
    expect(encodeLogField(404)).toBe('404');
    expect(encodeLogField({ toString: () => `x${LS}y` })).toBe('x\\u2028y');
  });
});

describe('HTTP-парсер Node — что действительно доходит до обработчика', () => {
  /**
   * Это не тест кодировщика, а зафиксированное измерение. Оно существует,
   * чтобы запись в матрице не съехала обратно к неверному утверждению про
   * перевод строки, и чтобы версия Node, открывающая новый символ, была
   * замечена здесь, а не в журнале.
   */
  let server: http.Server;
  let port: number;
  let received: Array<Record<string, unknown>>;

  beforeAll(async () => {
    received = [];
    server = http.createServer((req, res) => {
      received.push({ ua: req.headers['user-agent'], xff: req.headers['x-forwarded-for'] });
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as net.AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function send(rawRequest: Buffer): Promise<string> {
    return new Promise((resolve) => {
      const socket = net.connect(port, '127.0.0.1', () => socket.write(rawRequest));
      let out = '';
      socket.on('data', (chunk) => { out += chunk.toString('latin1'); });
      socket.on('close', () => resolve(out.split('\r\n')[0] ?? ''));
      socket.on('error', () => resolve('SOCKET_ERROR'));
    });
  }

  // Connection: close обязателен. С keep-alive сокет после 200 не закрывается,
  // и ожидание события close висит до таймаута — тест падал бы по причине, не
  // имеющей отношения к измеряемому.
  //
  // Запрос собирается из БАЙТОВ, а не из строки: latin1 здесь принципиален,
  // потому что именно так Node читает значения заголовков, и подстановка utf8
  // измеряла бы не то.
  const request = (userAgentBytes: Buffer, extraHeader = '') =>
    Buffer.concat([
      Buffer.from(`GET / HTTP/1.1\r\nHost: x\r\nConnection: close\r\n${extraHeader}User-Agent: `, 'latin1'),
      userAgentBytes,
      Buffer.from('\r\n\r\n', 'latin1'),
    ]);

  const withByte = (byte: number) => Buffer.concat([
    Buffer.from('a', 'latin1'), Buffer.from([byte]), Buffer.from('b', 'latin1'),
  ]);

  it.each([
    ['LF 0x0a', 0x0a],
    ['CR 0x0d', 0x0d],
    ['NUL 0x00', 0x00],
    ['ESC 0x1b', 0x1b],
    ['DEL 0x7f', 0x7f],
  ])('%s парсер отвергает — до обработчика не доходит', async (_name, byte) => {
    const before = received.length;
    await expect(send(request(withByte(byte)))).resolves.toContain('400');
    expect(received).toHaveLength(before);
  });

  it.each([
    ['0x80 (начало блока C1)', 0x80],
    ['0x85 NEL', 0x85],
    ['0x9b CSI — восьмибитный ESC', 0x9b],
    ['0x9f (конец блока C1)', 0x9f],
    ['0x09 TAB', 0x09],
  ])('%s парсер пропускает — вот почему кодирование обязательно', async (_name, byte) => {
    const before = received.length;
    await expect(send(request(withByte(byte)))).resolves.toContain('200');
    expect(received.length).toBe(before + 1);

    const delivered = String(received[received.length - 1].ua);
    expect(delivered.codePointAt(1)).toBe(byte);
    // И ровно этот доставленный символ кодировщик обязан обезвредить.
    expect(encodeLogField(delivered)).not.toContain(String.fromCodePoint(byte));
    expect(encodeLogField(delivered)).toContain(`\\x${byte.toString(16).padStart(2, '0')}`);
  });

  it('UTF-8 байты U+2028 приходят как три кодовые точки, а не как разделитель строк', async () => {
    // Первое исправление записи было неверным именно здесь. Смуглить U+2028
    // через заголовок нельзя — но байт 0x80 внутри него проходит, и потому
    // кодировщик всё равно срабатывает.
    const before = received.length;
    await expect(
      send(request(Buffer.from([0x61, 0xe2, 0x80, 0xa8, 0x62]))),
    ).resolves.toContain('200');

    const delivered = String(received[received.length - 1].ua);
    expect([...delivered].map((c) => c.codePointAt(0))).toEqual([0x61, 0xe2, 0x80, 0xa8, 0x62]);
    expect(delivered).not.toContain(LS);
    expect(encodeLogField(delivered)).toContain('\\x80');
    expect(received.length).toBe(before + 1);
  });

  it('тот же байт проходит и через X-Forwarded-For, из которого выводится req.ip', async () => {
    // Запись ASVS называла одно поле. Их два.
    const before = received.length;
    const xff = Buffer.concat([
      Buffer.from('X-Forwarded-For: 1.2.3.4', 'latin1'),
      Buffer.from([0x9b]),
      Buffer.from('FORGED\r\n', 'latin1'),
    ]).toString('latin1');

    await expect(send(request(Buffer.from('ok', 'latin1'), xff))).resolves.toContain('200');
    expect(String(received[received.length - 1].xff)).toContain(CSI);
    expect(received.length).toBe(before + 1);
  });
});
