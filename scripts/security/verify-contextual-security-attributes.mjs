#!/usr/bin/env node
/**
 * Контекстные признаки в решениях о доступе (ASVS V8.1.3, V8.1.4).
 *
 * Реестр отвечает на то, чего сканер не выведет: какое решение принимается, по
 * какому порогу и что происходит при его превышении. Но одно утверждение реестра
 * проверяемо машинно, и именно оно здесь держит запись — отрицательное.
 *
 * «Устройство не участвует в решениях» и «геолокация не используется» — это
 * ответы на требование, а не умолчание. Поэтому признак, объявленный не входящим
 * в решение, не должен встречаться в СРАВНЕНИИ внутри кода, принимающего решения
 * о доступе. Появится сравнение — сборка упадёт, и реестр придётся пересмотреть,
 * а не обнаружить расхождение годом позже.
 *
 * Присутствие в метаданных аудита сравнением не считается и не запрещается:
 * запись в журнал — это не решение.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const REGISTRY = 'docs/security/contextual-security-attributes.json';

const SOURCE = /\.ts$/u;
const FIXTURE = /\.(?:spec|test)\.ts$/u;

/** Сравнение, а не упоминание: признак стоит рядом с оператором сравнения. */
export function comparisonSites(source, token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const patterns = [
    // x === token / token !== x, в любом регистре имени
    new RegExp(`${escaped}\\s*(?:===|!==|==|!=)`, 'giu'),
    new RegExp(`(?:===|!==|==|!=)\\s*[\\w.?]*${escaped}`, 'giu'),
    // token в условии сопоставления: startsWith/includes/match, вызванные НА признаке
    new RegExp(`${escaped}[\\w.?]*\\s*\\.\\s*(?:startsWith|endsWith|includes|match|test)\\s*\\(`, 'giu'),
  ];
  const hits = [];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      hits.push(source.slice(0, match.index).split('\n').length);
    }
  }
  return [...new Set(hits)].sort((a, b) => a - b);
}

export function trackedDecisionSources(roots) {
  return execFileSync('git', ['ls-files', '-z', ...roots], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .filter((path) => SOURCE.test(path) && !FIXTURE.test(path));
}

export function auditContextualAttributes(registry, readFile = (p) => readFileSync(p, 'utf8')) {
  const problems = [];
  const files = trackedDecisionSources(registry.decisionRoots);

  for (const attribute of registry.attributes) {
    const stated = [
      String(attribute.decision || '').trim(),
      String(attribute.threshold || '').trim(),
      String(attribute.action || '').trim(),
      String(attribute.failureMode || '').trim(),
    ];
    if (stated.some((value) => value.length < 3)) {
      problems.push({
        kind: 'INCOMPLETE_ATTRIBUTE_RECORD',
        detail: `${attribute.id}: the requirement asks for the attribute, the threshold and the action taken; a blank is not an answer`,
      });
    }

    if (attribute.isDecisionInput) {
      // Положительное утверждение: названные места должны существовать.
      const missing = [...(attribute.decisionSites || []), ...(attribute.resolvedBy || [])]
        .filter((path) => !files.includes(path) && !fileExists(path, readFile));
      if ((attribute.decisionSites || []).length === 0) {
        problems.push({
          kind: 'DECISION_INPUT_WITHOUT_SITE',
          detail: `${attribute.id}: declared a decision input but names no site where the decision is made`,
        });
      }
      if (missing.length > 0) {
        problems.push({
          kind: 'ATTRIBUTE_SITE_GONE',
          detail: `${attribute.id}: names a file that no longer exists: ${missing.join(', ')}`,
        });
      }
      continue;
    }

    // Отрицательное утверждение: признак не должен участвовать в сравнении.
    const tokens = registry.negativeClaimPatterns?.[attribute.id] ?? [];
    if (tokens.length === 0) {
      problems.push({
        kind: 'UNCHECKABLE_NEGATIVE_CLAIM',
        detail: `${attribute.id}: claims it is not a decision input but gives no pattern by which that claim could ever fail`,
      });
      continue;
    }
    for (const file of files) {
      const source = readFile(file);
      for (const token of tokens) {
        const lines = comparisonSites(source, token);
        if (lines.length > 0) {
          problems.push({
            kind: 'NEGATIVE_CLAIM_CONTRADICTED',
            detail: `${attribute.id}: "${token}" is compared at ${file}:${lines.join(',')} inside access-decision code, so it is an input after all`,
          });
        }
      }
    }
  }

  return { files: files.length, problems, ok: problems.length === 0 };
}

function fileExists(path, readFile) {
  try {
    readFile(path);
    return true;
  } catch {
    return false;
  }
}

function main() {
  const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
  const result = auditContextualAttributes(registry);
  const inputs = registry.attributes.filter((a) => a.isDecisionInput);
  console.log(
    `CONTEXTUAL_ATTRIBUTES: declared=${registry.attributes.length} decisionInputs=${inputs.length} notInputs=${registry.attributes.length - inputs.length} decisionFiles=${result.files}`,
  );
  if (result.ok) {
    console.log('Every contextual attribute states its decision, threshold and action, and every negative claim still holds.');
    return 0;
  }
  for (const problem of result.problems) console.error(`${problem.kind}: ${problem.detail}`);
  return 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exit(main());
}
