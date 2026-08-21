const blockedIdRe = /^(?:AGPL|GPL|SSPL|BUSL)(?:[-.].*)?$/iu;
const reviewIdRe = /^(?:LGPL|MPL|EPL|CDDL|CPL|OSL|EUPL|CC-BY|CC-BY-SA|PolyForm|Commons-Clause)(?:[-.].*)?$/iu;
const permissiveIds = new Set([
  'MIT', 'MIT-0', 'MIT/X11', 'Apache-2.0', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD',
  'Zlib', 'Unlicense', 'CC0-1.0', 'OFL-1.1', 'Python-2.0', 'PSF-2.0', 'BlueOak-1.0.0',
].map((value) => value.toLowerCase()));

function classifyLicenseId(value, exception = '') {
  if (blockedIdRe.test(value)) return 'BLOCKED_STRONG_COPYLEFT_OR_SOURCE_AVAILABLE';
  if (exception || reviewIdRe.test(value)) return 'LEGAL_REVIEW';
  if (permissiveIds.has(value.toLowerCase())) return 'PERMISSIVE_OR_APPROVED';
  return 'UNKNOWN_REVIEW';
}

function combineAnd(classes) {
  if (classes.includes('BLOCKED_STRONG_COPYLEFT_OR_SOURCE_AVAILABLE')) return 'BLOCKED_STRONG_COPYLEFT_OR_SOURCE_AVAILABLE';
  if (classes.includes('LEGAL_REVIEW')) return 'LEGAL_REVIEW';
  if (classes.includes('UNKNOWN_REVIEW')) return 'UNKNOWN_REVIEW';
  if (classes.includes('PERMISSIVE_OR_APPROVED_DUAL_LICENSE')) return 'PERMISSIVE_OR_APPROVED_DUAL_LICENSE';
  return 'PERMISSIVE_OR_APPROVED';
}

function combineOr(classes) {
  if (classes.length === 1) return classes[0];
  if (classes.some((value) => value === 'PERMISSIVE_OR_APPROVED' || value === 'PERMISSIVE_OR_APPROVED_DUAL_LICENSE')) {
    return 'PERMISSIVE_OR_APPROVED_DUAL_LICENSE';
  }
  if (classes.includes('LEGAL_REVIEW')) return 'LEGAL_REVIEW';
  if (classes.includes('UNKNOWN_REVIEW')) return 'UNKNOWN_REVIEW';
  return 'BLOCKED_STRONG_COPYLEFT_OR_SOURCE_AVAILABLE';
}

export function classifyLicenseExpression(license) {
  if (!license || license === 'UNKNOWN') return 'UNKNOWN_REVIEW';
  const tokens = license.match(/\(|\)|\bAND\b|\bOR\b|\bWITH\b|[^\s()]+/giu) ?? [];
  let cursor = 0;
  const peek = () => tokens[cursor] ?? '';
  const consume = () => tokens[cursor++] ?? '';

  function primary() {
    if (peek() === '(') {
      consume();
      const value = orExpression();
      if (consume() !== ')') throw new Error('unbalanced license expression');
      return value;
    }
    const identifier = consume();
    if (!identifier || /^(?:AND|OR|WITH|\))$/iu.test(identifier)) throw new Error('invalid license identifier');
    let exception = '';
    if (/^WITH$/iu.test(peek())) {
      consume();
      exception = consume();
      if (!exception || /^(?:AND|OR|WITH|\(|\))$/iu.test(exception)) throw new Error('invalid license exception');
    }
    return classifyLicenseId(identifier, exception);
  }

  function andExpression() {
    const classes = [primary()];
    while (/^AND$/iu.test(peek())) {
      consume();
      classes.push(primary());
    }
    return combineAnd(classes);
  }

  function orExpression() {
    const classes = [andExpression()];
    while (/^OR$/iu.test(peek())) {
      consume();
      classes.push(andExpression());
    }
    return combineOr(classes);
  }

  try {
    const classification = orExpression();
    return cursor === tokens.length ? classification : 'UNKNOWN_REVIEW';
  } catch {
    return 'UNKNOWN_REVIEW';
  }
}
