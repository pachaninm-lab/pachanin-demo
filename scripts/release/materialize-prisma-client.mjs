import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const [sourceProjectRoot, runtimeRoot] = process.argv.slice(2).map((value) => path.resolve(value ?? ''));
if (!sourceProjectRoot || !runtimeRoot) {
  throw new Error('usage: node materialize-prisma-client.mjs <source-project-root> <runtime-root>');
}

function resolveClient(root) {
  const requireFromRoot = createRequire(path.join(root, 'package.json'));
  const packageJsonPath = fs.realpathSync(requireFromRoot.resolve('@prisma/client/package.json'));
  const packageDir = path.dirname(packageJsonPath);
  const packageNodeModules = path.resolve(packageDir, '..', '..');
  const manifest = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return {
    requireFromRoot,
    version: manifest.version,
    generatedDir: path.join(packageNodeModules, '.prisma', 'client'),
  };
}

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const source = resolveClient(sourceProjectRoot);
const target = resolveClient(runtimeRoot);
if (source.version !== target.version) {
  throw new Error(`Prisma Client version mismatch: source=${source.version}, target=${target.version}`);
}

const sourceDefault = path.join(source.generatedDir, 'default.js');
if (!fs.existsSync(sourceDefault)) {
  throw new Error(`Generated Prisma Client is absent at ${source.generatedDir}`);
}

fs.rmSync(target.generatedDir, { recursive: true, force: true });
fs.mkdirSync(path.dirname(target.generatedDir), { recursive: true });
fs.cpSync(source.generatedDir, target.generatedDir, { recursive: true, preserveTimestamps: true });

const targetDefault = path.join(target.generatedDir, 'default.js');
if (!fs.existsSync(targetDefault)) {
  throw new Error(`Prisma Client copy is incomplete at ${target.generatedDir}`);
}
if (sha256(sourceDefault) !== sha256(targetDefault)) {
  throw new Error('Prisma Client default.js digest changed during materialization');
}

const runtimeClient = target.requireFromRoot('@prisma/client');
if (typeof runtimeClient.PrismaClient !== 'function') {
  throw new Error('Deployed @prisma/client does not export PrismaClient');
}

const engines = fs.readdirSync(target.generatedDir)
  .filter((name) => /query_engine|libquery_engine/.test(name))
  .sort();
if (engines.length === 0) {
  throw new Error('Deployed Prisma Client contains no query engine');
}

fs.writeFileSync(path.join(runtimeRoot, 'prisma-client-materialization.json'), `${JSON.stringify({
  prismaClientVersion: target.version,
  defaultJsSha256: sha256(targetDefault),
  engines,
}, null, 2)}\n`);
