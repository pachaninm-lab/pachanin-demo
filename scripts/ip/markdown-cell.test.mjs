import { strict as assert } from 'node:assert';
import test from 'node:test';
import { markdownCell, renderedCellCount } from './markdown-cell.mjs';

const row = (subject) => `| 1 | \`abc123\` | 2026-01-01 | ${markdownCell(subject)} |`;
const CELLS = 6;

test('замеренные способы выйти из ячейки закрыты', () => {
  for (const [name, subject] of [
    ['слеш вплотную к трубе', 'feat: a\\|INJECTED|cells'],
    ['две трубы после слеша', 'x\\|A|B|C'],
    ['перевод строки', 'feat: first\nINJECTED ROW | x |'],
    ['возврат каретки', 'feat: first\r\nINJECTED | y |'],
    ['только слеши', '\\\\\\\\|A|B'],
  ]) {
    const built = row(subject);
    assert.equal(renderedCellCount(built), CELLS, name);
    assert.equal(built.split('\n').length, 1, name);
  }
});

test('обычный текст не искажается сверх необходимого', () => {
  assert.equal(markdownCell('feat: добавить отчёт'), 'feat: добавить отчёт');
  assert.equal(markdownCell('a | b'), 'a \\| b');
  assert.equal(markdownCell('C:\\path'), 'C:\\\\path');
});

test('срез идёт до экранирования, поэтому не оставляет висящий слеш', () => {
  // При срезе ПОСЛЕ экранирования строка обрывалась на одиночном слеше.
  const cut = markdownCell(`${'y'.repeat(99)}|zzz`);
  assert.equal(cut.endsWith('\\'), false);
  // Экранированная труба внутри ячейки разделителем не считается:
  // живых труб две — границы ячейки, значит ячеек три.
  assert.equal(renderedCellCount(`| ${cut} |`), 3);
});

test('счётчик ячеек не считает экранированные трубы разделителями', () => {
  assert.equal(renderedCellCount('| a | b |'), 4);        // три живых трубы
  assert.equal(renderedCellCount('| a \\| b |'), 3);       // средняя экранирована
  assert.equal(renderedCellCount('| a \\\\| b |'), 4);     // слеш экранирован, труба живая
});

test('пустое и отсутствующее значение дают пустую ячейку, а не «undefined»', () => {
  assert.equal(markdownCell(undefined), '');
  assert.equal(markdownCell(null), '');
});
