#!/usr/bin/env node
/**
 * Каждый исходящий вызов API-сервера должен быть ограничен по времени.
 *
 * Неограниченный fetch к внешней системе — это отказ в обслуживании, который не
 * требует от атакующего ничего: достаточно, чтобы зависла чужая система. Node
 * держит один событийный цикл, поэтому запросы, ждущие вечно, исчерпывают пул.
 *
 * Проверка разбирает список аргументов вызова по балансу скобок, а не по окну
 * строк: окно фиксированного размера обрезает длинный вызов и объявляет
 * ограниченный вызов неограниченным (или наоборот).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const OUTBOUND_ROOTS = ['apps/api/src'];

const SOURCE = /\.(?:ts|mjs|js)$/u;
const FIXTURE = /\.(?:spec|test)\.(?:ts|mjs|js)$/u;
const CALL = /(?:^|[^.\w$])fetch\s*\(/gu;
const BOUNDED = /AbortSignal\.timeout|AbortController|(?:^|[\s,{])signal\s*[,:}]/u;

/** Аргументы вызова, открывающегося на позиции `open`, по балансу скобок. */
export function callArguments(source, open) {
  let depth = 0;
  let quote = '';
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  return '';
}

export function isBoundedCall(argumentList) {
  return BOUNDED.test(argumentList);
}

export function outboundCallSites(source, file) {
  const sites = [];
  for (const match of source.matchAll(CALL)) {
    const open = source.indexOf('(', match.index);
    if (open < 0) continue;
    sites.push({
      file,
      line: source.slice(0, open).split('\n').length,
      bounded: isBoundedCall(callArguments(source, open)),
    });
  }
  return sites;
}

export function trackedSources(roots = OUTBOUND_ROOTS) {
  return execFileSync('git', ['ls-files', '-z', ...roots], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .filter((path) => SOURCE.test(path) && !FIXTURE.test(path));
}

export function scanOutboundTimeouts(roots = OUTBOUND_ROOTS) {
  const files = trackedSources(roots);
  const sites = files.flatMap((file) => outboundCallSites(readFileSync(file, 'utf8'), file));
  return { files: files.length, sites, unbounded: sites.filter((site) => !site.bounded) };
}

function main() {
  const { files, sites, unbounded } = scanOutboundTimeouts();
  console.log(
    `OUTBOUND_TIMEOUTS: files=${files} sites=${sites.length} bounded=${sites.length - unbounded.length} unbounded=${unbounded.length}`,
  );
  if (unbounded.length === 0) {
    console.log('Every outbound call from the API server is bounded by a timeout.');
    return;
  }
  for (const site of unbounded) console.error(`UNBOUNDED_OUTBOUND_CALL ${site.file}:${site.line}`);
  console.error(
    `${unbounded.length} outbound call(s) have no timeout. An unreachable dependency would hold the request forever.`,
  );
  process.exit(1);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}
