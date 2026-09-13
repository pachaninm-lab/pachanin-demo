#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Every dangerouslySetInnerHTML in the repository, and where its HTML came from.
 *
 * V1.1.2 and V3.2.2 rest on dangerouslySetInnerHTML being absent from
 * apps/web/lib. It is - and 23 files under apps/web/app and apps/web/components
 * use it, so the absence was a statement about one directory rather than about
 * the codebase. The register now says so. Saying so is not the same as knowing
 * the calls are safe, and reading them once is not a control.
 *
 * This is the control. Each call site is parsed, the __html expression is taken,
 * and its shape must be one this repository has decided is acceptable:
 *
 *   - a string or a template literal whose interpolations are all module-level
 *     constants or literals - static markup and CSS, written in the file;
 *   - JSON.stringify(...), which cannot emit a tag-closing sequence;
 *   - a call to an allowlisted sanitiser, currently safeJsonLd;
 *   - an identifier bound to a module-level const in the same file.
 *
 * Anything else fails, and the two shapes that matter most are named rather than
 * left to the default: an expression that reads a function parameter, and one
 * that reads props, params or searchParams. Those are how a request value would
 * arrive.
 *
 * The check is conservative by construction. It answers "could this expression
 * be a request value" from the file it is written in, not "is this string safe",
 * which no static rule can answer. A call it cannot classify is a failure, not a
 * pass - an analyser that shrugs is an analyser that approves.
 */

const ALLOWED_SANITISERS = new Set(['safeJsonLd']);
const REQUEST_SHAPED = new Set(['props', 'params', 'searchParams', 'request', 'req', 'query', 'body']);

const ts = await import(resolve('apps/api/node_modules/typescript/lib/typescript.js'))
  .then((module) => module.default ?? module)
  .catch(() => null);

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

/**
 * The nearest `const` declaration of a name, looking outwards from a node.
 *
 * A module-level constant is not the only safe binding. The idiomatic shape here
 * is a local one - `const structuredData = JSON.stringify({...})` two lines above
 * the JSX that uses it - and a check that only recognised module scope would
 * reject working code and teach people to work around it. What matters is not
 * where the binding lives but what it was initialised from, so the initialiser is
 * classified in turn.
 */
export function resolveConstInitializer(name, node, tsApi) {
  for (let current = node; current; current = current.parent) {
    const statements = current.statements ?? current.body?.statements;
    for (const statement of statements ?? []) {
      if (!tsApi.isVariableStatement(statement)) continue;
      if ((statement.declarationList.flags & tsApi.NodeFlags.Const) === 0) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (tsApi.isIdentifier(declaration.name) && declaration.name.text === name) return declaration.initializer ?? null;
      }
    }
  }
  return null;
}

/** Module-level `const x = ...` names, which cannot carry a request value. */
export function moduleConstants(source, tsApi) {
  const names = new Set();
  for (const statement of source.statements) {
    if (!tsApi.isVariableStatement(statement)) continue;
    const isConst = (statement.declarationList.flags & tsApi.NodeFlags.Const) !== 0;
    if (!isConst) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (tsApi.isIdentifier(declaration.name)) names.add(declaration.name.text);
    }
  }
  return names;
}

/** Parameter names of every function enclosing this node. */
export function enclosingParameters(node, tsApi) {
  const names = new Set();
  for (let current = node.parent; current; current = current.parent) {
    const parameters = current.parameters;
    if (!parameters) continue;
    for (const parameter of parameters) {
      if (tsApi.isIdentifier(parameter.name)) names.add(parameter.name.text);
      else for (const element of parameter.name.elements ?? []) {
        if (element.name && tsApi.isIdentifier(element.name)) names.add(element.name.text);
      }
    }
  }
  return names;
}

export function classify(expression, context, tsApi, depth = 0) {
  const { constants, parameters, site } = context;
  if (depth > 3) return { verdict: 'REJECTED', reasons: ['is bound through more indirection than this check will follow'] };
  const reasons = [];
  const identifiersIn = (node) => {
    const found = [];
    const walk = (current) => {
      if (tsApi.isIdentifier(current)) found.push(current.text);
      else if (tsApi.isPropertyAccessExpression(current)) { walk(current.expression); return; }
      current.forEachChild(walk);
    };
    walk(node);
    return found;
  };

  const rejectIfTainted = (node) => {
    for (const name of identifiersIn(node)) {
      if (parameters.has(name)) reasons.push(`reads the function parameter ${name}`);
      else if (REQUEST_SHAPED.has(name)) reasons.push(`reads ${name}, which carries request data`);
      else if (!constants.has(name) && !ALLOWED_SANITISERS.has(name)) reasons.push(`reads ${name}, which is not a module-level constant in this file`);
    }
  };

  if (tsApi.isStringLiteral(expression) || tsApi.isNoSubstitutionTemplateLiteral(expression)) return { verdict: 'STATIC_LITERAL', reasons };
  if (tsApi.isTemplateExpression(expression)) {
    for (const span of expression.templateSpans) rejectIfTainted(span.expression);
    return { verdict: reasons.length ? 'REJECTED' : 'STATIC_TEMPLATE', reasons };
  }
  if (tsApi.isCallExpression(expression)) {
    const callee = expression.expression;
    const calleeText = tsApi.isPropertyAccessExpression(callee)
      ? `${callee.expression.getText?.() ?? ''}.${callee.name.text}`
      : (tsApi.isIdentifier(callee) ? callee.text : '');
    if (calleeText === 'JSON.stringify') return { verdict: 'JSON_STRINGIFY', reasons };
    if (ALLOWED_SANITISERS.has(calleeText)) return { verdict: 'SANITISER', reasons };
    // A string method chained onto an allowed expression, with literal arguments
    // only. `.replace(/</g, '\\u003c')` is the standard JSON-LD escape and can
    // only narrow what the object already produced; an argument that is not a
    // literal could introduce content, so it is refused.
    if (tsApi.isPropertyAccessExpression(callee)) {
      const literalArguments = expression.arguments.every((argument) => tsApi.isStringLiteral(argument)
        || tsApi.isNoSubstitutionTemplateLiteral(argument)
        || tsApi.isRegularExpressionLiteral(argument)
        || tsApi.isNumericLiteral(argument));
      if (literalArguments) {
        const inner = classify(callee.expression, context, tsApi, depth + 1);
        if (inner.verdict !== 'REJECTED') return { verdict: inner.verdict, reasons };
        return { verdict: 'REJECTED', reasons: inner.reasons.map((reason) => `${callee.name.text}() is applied to something that ${reason}`) };
      }
      reasons.push(`calls ${callee.name.text}() with a non-literal argument, which could introduce content`);
      return { verdict: 'REJECTED', reasons };
    }
    reasons.push(`calls ${calleeText || 'an expression'}, which is not JSON.stringify and not an allowlisted sanitiser`);
    return { verdict: 'REJECTED', reasons };
  }
  if (tsApi.isIdentifier(expression)) {
    if (parameters.has(expression.text)) return { verdict: 'REJECTED', reasons: [`is the function parameter ${expression.text}`] };
    if (constants.has(expression.text)) return { verdict: 'MODULE_CONSTANT', reasons };
    const initializer = site ? resolveConstInitializer(expression.text, site, tsApi) : null;
    if (initializer) {
      const inner = classify(initializer, context, tsApi, depth + 1);
      if (inner.verdict !== 'REJECTED') return { verdict: 'LOCAL_CONSTANT', reasons };
      return { verdict: 'REJECTED', reasons: inner.reasons.map((reason) => `${expression.text} is bound to something that ${reason}`) };
    }
    return { verdict: 'REJECTED', reasons: [`is ${expression.text}, which is not a const declared in this file`] };
  }
  return { verdict: 'REJECTED', reasons: ['has a shape this check cannot classify; an analyser that shrugs is an analyser that approves'] };
}

function main() {
  if (!ts) {
    console.error('dangerous-html provenance: the TypeScript parser is not installed; run the workspace install first.');
    return 2;
  }
  const files = git(['ls-files', '-z']).split('\0')
    .filter((path) => /\.(tsx?|jsx?|mjs|cjs)$/u.test(path) && !/\.(test|spec)\./u.test(path));

  const sites = [];
  for (const path of files) {
    const text = readFileSync(path, 'utf8');
    if (!text.includes('dangerouslySetInnerHTML')) continue;
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const constants = moduleConstants(source, ts);
    const visit = (node) => {
      if (ts.isJsxAttribute(node) && node.name.getText(source) === 'dangerouslySetInnerHTML') {
        const initializer = node.initializer;
        const object = initializer && ts.isJsxExpression(initializer) ? initializer.expression : null;
        const property = object && ts.isObjectLiteralExpression(object)
          ? object.properties.find((entry) => entry.name?.getText(source)?.replace(/['"]/gu, '') === '__html')
          : null;
        const expression = property && ts.isPropertyAssignment(property) ? property.initializer : null;
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        if (!expression) {
          sites.push({ path, line, verdict: 'REJECTED', reasons: ['the __html value could not be read as a property assignment'] });
        } else {
          const parameters = enclosingParameters(node, ts);
          sites.push({ path, line, ...classify(expression, { constants, parameters, site: node }, ts) });
        }
      }
      node.forEachChild(visit);
    };
    source.forEachChild(visit);
  }

  const rejected = sites.filter((site) => site.verdict === 'REJECTED');
  const byVerdict = sites.reduce((counts, site) => ({ ...counts, [site.verdict]: (counts[site.verdict] ?? 0) + 1 }), {});
  console.log(`dangerous-html provenance: ${sites.length} call site(s) in ${new Set(sites.map((s) => s.path)).size} file(s)`);
  for (const [verdict, count] of Object.entries(byVerdict).sort()) console.log(`  ${verdict.padEnd(18)} ${count}`);
  if (!rejected.length) {
    console.log('  No call site takes its HTML from a function parameter, from props, params or searchParams, or from anything this check cannot classify.');
    return 0;
  }
  console.error(`dangerous-html provenance FAILED: ${rejected.length} call site(s) could carry a request value`);
  for (const site of rejected) console.error(`- ${site.path}:${site.line} ${site.reasons.join('; ')}`);
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
