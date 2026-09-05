/**
 * Removal of model scratchpad, tool envelopes and channel markers.
 *
 * Extracted from the controller so the streaming gate can use exactly the same
 * removal the buffered path uses. Two implementations of "strip the reasoning"
 * is how a scratchpad eventually reaches a browser: one of them gets a new
 * marker and the other does not.
 */

export const INTERNAL_TAG_BLOCK = /<\s*(think(?:ing)?|analysis|reasoning|scratchpad|tool(?:[_ -]?(?:call|calls|trace))?|debug)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/giu;
export const INTERNAL_TAG_TAIL = /<\s*(?:think(?:ing)?|analysis|reasoning|scratchpad|tool(?:[_ -]?(?:call|calls|trace))?|debug)\b[^>]*>[\s\S]*$/iu;
export const INTERNAL_FENCE_BLOCK = /```[ \t]*(?:think(?:ing)?|analysis|reasoning|scratchpad|tool(?:[_ -]?(?:call|calls|trace))?|debug)\b[^\n]*\n[\s\S]*?```/giu;
export const INTERNAL_CHANNEL_WITH_FINAL = /<\|channel\|>\s*(?:analysis|reasoning|commentary|tool)\s*<\|message\|>[\s\S]*?(?=<\|channel\|>\s*final\s*<\|message\|>)/giu;
export const INTERNAL_CHANNEL_TAIL = /<\|channel\|>\s*(?:analysis|reasoning|commentary|tool)\s*<\|message\|>[\s\S]*$/iu;

export const INTERNAL_MARKER = /(?:<\s*\/?\s*(?:think(?:ing)?|analysis|reasoning|scratchpad|tool(?:[_ -]?(?:call|calls|trace))?|debug)\b|```[ \t]*(?:think(?:ing)?|analysis|reasoning|scratchpad|tool(?:[_ -]?(?:call|calls|trace))?|debug)\b|<\|channel\|>\s*(?:analysis|reasoning|commentary|tool|final)\b)/iu;

export function stripInternalModelTrace(value: string): string {
  let result = typeof value === 'string' ? value : '';
  // Already-public text is an identity transform. In the streaming path the
  // leading space/newline may be the only separator between two committed
  // fragments; trimming it here collapses words on the public wire.
  if (!result || !INTERNAL_MARKER.test(result)) return result;

  for (let pass = 0; pass < 4; pass += 1) {
    const next = result.replace(INTERNAL_TAG_BLOCK, ' ');
    if (next === result) break;
    result = next;
  }

  result = result
    .replace(INTERNAL_FENCE_BLOCK, ' ')
    .replace(INTERNAL_CHANNEL_WITH_FINAL, ' ')
    .replace(INTERNAL_CHANNEL_TAIL, ' ')
    .replace(INTERNAL_TAG_TAIL, ' ')
    .replace(/<\|channel\|>\s*final\s*<\|message\|>/giu, ' ')
    .replace(/<\|[^|>\r\n]{1,64}\|>/gu, ' ')
    .replace(/<\s*\/?\s*(?:think(?:ing)?|analysis|reasoning|scratchpad|tool(?:[_ -]?(?:call|calls|trace))?|debug)\b[^>]*>/giu, ' ')
    .replace(/[ \t]+/gu, ' ')
    .replace(/ *\n */gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();

  return result;
}

/**
 * Index from which the tail must be withheld because a construct may still be
 * mid-arrival, or the whole length when everything present is decidable.
 *
 * The checks are deliberately syntactic and cheap: this runs on every model
 * delta, and an expensive gate would eat the latency streaming exists to win.
 */
export function undecidedTailStart(pending: string): number {
  const candidates: number[] = [];

  // An unclosed `<...` may become an internal tag once more bytes arrive.
  const lastOpenAngle = pending.lastIndexOf('<');
  if (lastOpenAngle !== -1 && pending.indexOf('>', lastOpenAngle) === -1) candidates.push(lastOpenAngle);

  // An internal tag that has opened but not closed.
  const tagOpen = /<\s*(think(?:ing)?|analysis|reasoning|scratchpad|tool(?:[_ -]?(?:call|calls|trace))?|debug)\b[^>]*>/giu;
  for (let match = tagOpen.exec(pending); match !== null; match = tagOpen.exec(pending)) {
    const closer = new RegExp(`<\\s*/\\s*${match[1]}\\s*>`, 'iu');
    if (!closer.test(pending.slice(match.index))) {
      candidates.push(match.index);
      break;
    }
  }

  // A channel marker before its final message has arrived.
  const channel = pending.lastIndexOf('<|');
  if (channel !== -1 && !/<\|channel\|>\s*final\s*<\|message\|>/iu.test(pending.slice(channel))) {
    candidates.push(channel);
  }

  // An unbalanced code fence: everything inside it is undecided.
  const fences = pending.split('```').length - 1;
  if (fences % 2 === 1) candidates.push(pending.lastIndexOf('```'));

  // An unbalanced JSON-ish envelope. Agronomic prose does not use braces, so
  // withholding on one costs nothing and covers a tool payload arriving raw.
  const brace = unbalancedStructureStart(pending);
  if (brace !== null) candidates.push(brace);

  const earliest = candidates.filter((index) => index >= 0).sort((left, right) => left - right)[0];
  return earliest === undefined ? pending.length : earliest;
}

function unbalancedStructureStart(value: string): number | null {
  const stack: { char: string; index: number }[] = [];
  let quoted = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === '{' || character === '[') stack.push({ char: character, index });
    else if (character === '}' || character === ']') stack.pop();
  }
  return stack.length > 0 ? stack[0].index : null;
}
