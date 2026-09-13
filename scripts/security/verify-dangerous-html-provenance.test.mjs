import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import test from 'node:test';

import { classify, enclosingParameters, moduleConstants, resolveConstInitializer } from './verify-dangerous-html-provenance.mjs';

const ts = await import(resolve('apps/api/node_modules/typescript/lib/typescript.js')).then((m) => m.default ?? m);

/** Parses a component and returns the __html expression with its context. */
function site(body) {
  const source = ts.createSourceFile('probe.tsx', body, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let attribute = null;
  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(source) === 'dangerouslySetInnerHTML') attribute = node;
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  assert.ok(attribute, 'the probe must contain a dangerouslySetInnerHTML attribute');
  const object = attribute.initializer.expression;
  const property = object.properties.find((entry) => entry.name.getText(source).replace(/['"]/gu, '') === '__html');
  return {
    expression: property.initializer,
    context: { constants: moduleConstants(source, ts), parameters: enclosingParameters(attribute, ts), site: attribute },
  };
}

const verdict = (body) => {
  const { expression, context } = site(body);
  return classify(expression, context, ts);
};

test('a static literal and a static template are accepted', () => {
  assert.equal(verdict("const A = () => <s dangerouslySetInnerHTML={{ __html: '<b>x</b>' }} />;").verdict, 'STATIC_LITERAL');
  assert.equal(verdict('const K = 4;\nconst A = () => <s dangerouslySetInnerHTML={{ __html: `a{b:${K}px}` }} />;').verdict, 'STATIC_TEMPLATE');
});

test('JSON.stringify and an allowlisted sanitiser are accepted', () => {
  assert.equal(verdict('const A = () => <s dangerouslySetInnerHTML={{ __html: JSON.stringify({ a: 1 }) }} />;').verdict, 'JSON_STRINGIFY');
  assert.equal(verdict('const A = () => <s dangerouslySetInnerHTML={{ __html: safeJsonLd(x) }} />;').verdict, 'SANITISER');
});

test('a module-level constant and a local const are accepted', () => {
  assert.equal(verdict("const S = '<b>x</b>';\nconst A = () => <s dangerouslySetInnerHTML={{ __html: S }} />;").verdict, 'MODULE_CONSTANT');
  assert.equal(verdict('const A = () => { const S = JSON.stringify({ a: 1 }); return <s dangerouslySetInnerHTML={{ __html: S }} />; };').verdict, 'LOCAL_CONSTANT');
});

/**
 * The negative controls. A check that only ever says yes is not a check, and the
 * two shapes below are exactly how a request value would reach the page.
 */
test('reading a function parameter is refused', () => {
  const result = verdict('const A = (html) => <s dangerouslySetInnerHTML={{ __html: html }} />;');
  assert.equal(result.verdict, 'REJECTED');
  assert.match(result.reasons.join(' '), /function parameter html/u);
});

test('reading props, params or searchParams is refused', () => {
  for (const source of [
    'const A = () => <s dangerouslySetInnerHTML={{ __html: props.body }} />;',
    'const A = () => <s dangerouslySetInnerHTML={{ __html: searchParams.q }} />;',
  ]) assert.equal(verdict(source).verdict, 'REJECTED', source);
});

test('a local const that is itself bound to a parameter is refused through the chain', () => {
  const result = verdict('const A = (raw) => { const S = raw; return <s dangerouslySetInnerHTML={{ __html: S }} />; };');
  assert.equal(result.verdict, 'REJECTED');
  assert.match(result.reasons.join(' '), /S is bound to something that .*parameter raw/u);
});

/**
 * The reason text is asserted, not only the verdict. Every tainted name would be
 * refused by the catch-all branch anyway, so a test that checked the verdict
 * alone would pass with the parameter and request-shape branches deleted - and
 * the tool would then tell a reader "not a module-level constant" about a value
 * that came straight off the request. A diagnostic nobody can act on is a
 * diagnostic nobody reads.
 */
test('a template interpolating a parameter is refused, and says it is a parameter', () => {
  const result = verdict('const A = (name) => <s dangerouslySetInnerHTML={{ __html: `<b>${name}</b>` }} />;');
  assert.equal(result.verdict, 'REJECTED');
  assert.match(result.reasons.join(' '), /reads the function parameter name/u);
});

test('a template interpolating request-shaped data is refused, and names it as request data', () => {
  const result = verdict('const A = () => <s dangerouslySetInnerHTML={{ __html: `<b>${searchParams.q}</b>` }} />;');
  assert.equal(result.verdict, 'REJECTED');
  assert.match(result.reasons.join(' '), /reads searchParams, which carries request data/u);
});

/** `.replace(/</g, '<')` narrows; `.replace(x, y)` can introduce. */
test('a chained string method is accepted only with literal arguments', () => {
  assert.equal(verdict("const A = () => <s dangerouslySetInnerHTML={{ __html: JSON.stringify({}).replace(/</g, '\\\\u003c') }} />;").verdict, 'JSON_STRINGIFY');
  const tainted = verdict('const A = (evil) => <s dangerouslySetInnerHTML={{ __html: JSON.stringify({}).replace(/a/g, evil) }} />;');
  assert.equal(tainted.verdict, 'REJECTED');
  assert.match(tainted.reasons.join(' '), /non-literal argument/u);
});

test('an unrecognised shape is refused rather than waved through', () => {
  const result = verdict('const A = (a, b) => <s dangerouslySetInnerHTML={{ __html: a ? b : b }} />;');
  assert.equal(result.verdict, 'REJECTED');
});

test('a const is resolved from the nearest enclosing scope, and an unbound name is refused', () => {
  const { context } = site('const A = () => <s dangerouslySetInnerHTML={{ __html: q }} />;');
  assert.equal(resolveConstInitializer('nothing-here', context.site, ts), null);
  assert.equal(verdict('const A = () => <s dangerouslySetInnerHTML={{ __html: q }} />;').verdict, 'REJECTED');
});
