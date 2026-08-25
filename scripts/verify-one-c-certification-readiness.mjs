#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

const EXACT_HEAD = '198ae9fe100c5e5ad0ff462a6acf33ed0e2fd60f';
const EXACT_TREE = 'ae04ee3298a08a2bbd8962c1e69115de2cde3c07';
const EXACT_BRANCH = 'feat/one-c-certification-readiness-4321';
const EXACT_LOCK = 'PC-CROP-FEDERAL-ACCOUNTING';

const EXACT_COMMANDS = [
  'UPSERT_COUNTERPARTY',
  'CREATE_SALES_DRAFT',
  'CREATE_PURCHASE_DRAFT',
  'CREATE_CORRECTION_DRAFT',
  'GET_DOCUMENT_STATUS',
  'PUSH_PAYMENT_STATUS',
  'GET_REFERENCE_CANDIDATES',
];

const EXACT_DECISIONS = [
  'CERTIFICATION_CATEGORY',
  'TARGET_CONFIGURATION',
  'TARGET_PLATFORM_VERSION',
  'EXTENSION_PURPOSE',
  'REGISTERED_IDENTITY',
  'SECURITY_PROFILE',
  'BSP_AND_SECRET_STORAGE',
  'DEMONSTRATION_STAND_ROUTE',
  'SUBMISSION_PACKAGE_ROUTE',
  'LICENSED_TOOLCHAIN',
  'APPLICANT_LEGAL_FACTS',
];

const EXACT_OFFICIAL_SOURCES = [
  'https://1c.ru/rus/products/1c/predpr/compat/soft/requirements.htm',
  'https://1c.ru/rus/products/1c/predpr/compat/soft/condition.htm',
  'https://sovmestimo.1c.ru/cert/',
  'https://its.1c.ru/db/content/v8std/src/400/100/i8100456.htm',
  'https://its.1c.ru/db/content/v8std/src/400/100/i8100453.htm',
  'https://its.1c.ru/db/content/v8std/src/600/i8100669.htm',
  'https://its.1c.ru/db/content/v8std/src/600/i8100740.htm',
];

const EXACT_CASES = [
  'INSTALL-BSP',
  'INSTALL-PLATFORM',
  'UPDATE',
  'DISABLE',
  'REMOVE',
  'RELEASE-CHANGE',
  'MULTI-EXTENSION',
  'EXCEPTION-CHAIN',
  'PAIRING-ONE-TIME',
  'SECURE-STORAGE',
  'OUTBOUND-HTTPS',
  'NO-INBOUND',
  'MULTI-ORGANIZATION',
  'UNSUPPORTED-COMMAND',
  'ACK-BEFORE-EFFECT',
  'ACK-AMBIGUOUS',
  'RESULT-AMBIGUOUS',
  'OFFLINE-LEASE-EXPIRY',
  'RECONCILIATION',
  'SEVEN-COMMANDS',
  'NO-DIRECT-DB',
  'NO-REAL-DATA',
  'LOG-SECRET-SCRUB',
  'DEMO-WALKTHROUGH',
  'UPGRADE-COEXISTENCE',
];

const EXACT_REQUIREMENTS = [
  'COMMON-1.1',
  'COMMON-1.2',
  'COMMON-1.3',
  'COMMON-1.4',
  'COMMON-1.5',
  'COMMON-1.6',
  'COMMON-1.7',
  'COMMON-1.8',
  'COMMON-1.9',
  'COMMON-1.10',
  'COMMON-1.11',
  'COMMON-1.12',
  'COMMON-1.13',
  'COMMON-1.14',
  'COMMON-1.15',
  'EXCHANGE-7.1',
  'EXCHANGE-7.2',
  'EXCHANGE-7.3',
  'EXCHANGE-7.4',
  'EXCHANGE-7.5',
  'EXCHANGE-7.6',
  'EXCHANGE-7.7',
  'EXCHANGE-7.8',
  'EXCHANGE-7.9',
  'EXCHANGE-8.0',
  'EXCHANGE-8.1',
  'EXTENSION-8.1',
  'EXTENSION-8.2',
  'EXTENSION-8.3',
  'EXTENSION-8.4',
  'EXTENSION-8.5',
  'EXTENSION-8.6',
  'EXTENSION-8.7',
  'EXTENSION-8.8',
  'EXTENSION-8.9',
  'EXTENSION-8.10',
  'EXTENSION-8.11.1',
  'EXTENSION-8.11.2',
  'EXTENSION-8.11.3',
  'EXTENSION-8.11.4',
  'EXTENSION-8.11.5',
  'EXTENSION-8.11.6',
  'EXTENSION-8.11.7',
  'EXTENSION-8.11.8',
  'EXTENSION-8.11.9',
  'EXTENSION-8.12',
  'EXTENSION-8.13',
  'EXTENSION-8.14',
  'CONDITION-2.2.1-CATEGORY',
  'CONDITION-2.2.1-TARGET',
  'CONDITION-2.2.1-SIGNATURE',
  'CONDITION-2.2.3-COST',
  'CONDITION-2.2.4-PACKAGE',
  'CONDITION-2.2.5-REVIEW',
];

const EXACT_SOURCE_HASHES = new Map([
  [
    'apps/api/src/modules/accounting/one-c-extension-source/TransparentPriceConfigurationAdapter.bsl',
    '29046358e1c9cea3d954ebc5aab558c3ed8efeec7e87810fff348a06d9d486c1',
  ],
  [
    'apps/api/src/modules/accounting/one-c-extension-source/TransparentPriceConnectorCommands.bsl',
    'd29278242a4b9676a192138e6a2b449699a1621efb6f33d7ee51078e1d20dd24',
  ],
  [
    'apps/api/src/modules/accounting/one-c-extension-source/TransparentPriceConnectorDiscovery.bsl',
    '3c7424ca0ddc13c6bcff40a9f4ef4daa6028643c7c25d9d83c240d61de873622',
  ],
  [
    'apps/api/src/modules/accounting/one-c-extension-source/TransparentPriceConnectorHttp.bsl',
    '8daf8d9efd8166c2f45ef8719aae9219b4c634ea7b9a552e191a10e9f00b05bf',
  ],
  [
    'apps/api/src/modules/accounting/one-c-extension-source/README.md',
    '434ca83b1bf9c738d90be4512935a772ff7ea0015b8ecec525a590014eb612b4',
  ],
]);

const EXACT_CONTROLLED_FILES = {
  complianceMatrix:
    'docs/ops/pc-crop-federal-accounting/one-c-certification-compliance.v1.json',
  packageManifestTemplate:
    'docs/ops/pc-crop-federal-accounting/one-c-submission-package.template.json',
  userGuideTemplate:
    'docs/ops/pc-crop-federal-accounting/one-c-user-guide.template.md',
  acceptanceProtocol:
    'docs/ops/pc-crop-federal-accounting/one-c-isolated-acceptance-protocol.md',
  syntheticScenario:
    'docs/ops/pc-crop-federal-accounting/one-c-synthetic-demo-scenario.v1.json',
  correspondenceDraft:
    'docs/ops/pc-crop-federal-accounting/one-c-sv-1097-final-draft.md',
};

const EXACT_SCOPE_PATH =
  'docs/platform-v7/autopilot/scopes/pc-crop-one-c-certification-readiness-4321.json';
const EXACT_SCOPE_PATHS = [
  'apps/api/src/modules/accounting/one-c-certification-readiness.contract.spec.ts',
  'docs/ops/pc-crop-federal-accounting/one-c-certification-compliance.v1.json',
  'docs/ops/pc-crop-federal-accounting/one-c-certification-readiness-20260825.md',
  'docs/ops/pc-crop-federal-accounting/one-c-certification-readiness.v1.json',
  'docs/ops/pc-crop-federal-accounting/one-c-isolated-acceptance-protocol.md',
  'docs/ops/pc-crop-federal-accounting/one-c-submission-package.template.json',
  'docs/ops/pc-crop-federal-accounting/one-c-sv-1097-final-draft.md',
  'docs/ops/pc-crop-federal-accounting/one-c-synthetic-demo-scenario.v1.json',
  'docs/ops/pc-crop-federal-accounting/one-c-user-guide.template.md',
  EXACT_SCOPE_PATH,
  'scripts/verify-one-c-certification-readiness.mjs',
];

function parseArguments(argv) {
  let root = process.cwd();
  let manifest = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--root') {
      root = argv[index + 1] || '';
      index += 1;
    } else if (argument === '--manifest') {
      manifest = argv[index + 1] || '';
      index += 1;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  if (!root) throw new Error('--root requires a value');
  if (manifest === '') throw new Error('--manifest requires a value');
  return { root: resolve(root), manifest };
}

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function sameArray(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function sameSet(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && new Set(actual).size === actual.length
    && expected.every((value) => actual.includes(value));
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    failures.push(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function readText(path, label) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    failures.push(`${label} cannot be read: ${error instanceof Error ? error.message : String(error)}`);
    return '';
  }
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function repoPath(root, relative) {
  const candidate = resolve(root, relative);
  const prefix = `${root}/`;
  if (candidate !== root && !candidate.startsWith(prefix)) {
    throw new Error(`path escapes repository root: ${relative}`);
  }
  return candidate;
}

function findForbiddenObjectKeys(value, prefix = '$') {
  const found = [];
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      found.push(...findForbiddenObjectKeys(entry, `${prefix}[${index}]`));
    });
    return found;
  }
  if (!value || typeof value !== 'object') return found;
  for (const [key, entry] of Object.entries(value)) {
    if (/(?:inn|kpp|account|email|phone|password|secret|bearer)/iu.test(key)) {
      found.push(`${prefix}.${key}`);
    }
    found.push(...findForbiddenObjectKeys(entry, `${prefix}.${key}`));
  }
  return found;
}

function validateReadiness(root, readiness) {
  if (!readiness) return;
  check(
    readiness.schemaVersion === 'pc-crop.one-c-certification-readiness.v1',
    'readiness schema mismatch',
  );
  check(readiness.status === 'BLOCKED_EXTERNAL_PREREQUISITES', 'readiness status was elevated');
  check(readiness.authority?.issue === 4321, 'readiness issue mismatch');
  check(readiness.authority?.trackingIssue === 4607, 'readiness tracking issue mismatch');
  check(readiness.authority?.correspondence === 'SV-1097', 'correspondence boundary mismatch');
  check(readiness.authority?.projectLockId === EXACT_LOCK, 'readiness lock mismatch');
  check(readiness.sourceBase?.pullRequest === 4663, 'source-base PR mismatch');
  check(readiness.sourceBase?.headSha === EXACT_HEAD, 'source-base head mismatch');
  check(readiness.sourceBase?.treeSha === EXACT_TREE, 'source-base tree mismatch');
  check(
    readiness.sourceBase?.workflowSelection === 'latest pull_request run by workflow name',
    'workflow selection rule mismatch',
  );
  check(readiness.sourceBase?.workflowOutcome?.success === 20, 'successful workflow count mismatch');
  check(readiness.sourceBase?.workflowOutcome?.expectedSkipped === 2, 'skipped workflow count mismatch');
  check(readiness.sourceBase?.workflowOutcome?.failedOrIncomplete === 0, 'bad workflow count is nonzero');

  for (const key of [
    'certified',
    'compiledCfePresent',
    'licensedOneCRuntimeAcceptance',
    'productionConnected',
    'productionCredentialPresent',
    'realOneCDataUsed',
    'directInformationBaseDatabaseAccess',
  ]) {
    check(readiness.facts?.[key] === false, `readiness fact ${key} must remain false`);
  }
  check(readiness.facts?.newMandatoryCostRub === 0, 'new mandatory cost is not zero');
  check(readiness.categoryDecision?.status === 'BLOCKED', 'category decision must stay blocked');
  check(readiness.categoryDecision?.selectedCategory === null, 'certification category was guessed');
  check(
    sameArray(readiness.categoryDecision?.candidates, [
      'SECTION_7_DATA_EXCHANGE_PRODUCT',
      'SECTION_8_CONFIGURATION_EXTENSION',
    ]),
    'certification category candidates drifted',
  );
  check(
    sameArray(readiness.officialSources, EXACT_OFFICIAL_SOURCES),
    'official source set or order mismatch',
  );

  const decisions = readiness.requiredDecisions?.map((entry) => entry.id);
  check(sameArray(decisions, EXACT_DECISIONS), 'required decision set or order mismatch');
  for (const decision of readiness.requiredDecisions || []) {
    check(decision.status === 'BLOCKED', `decision ${decision.id} was not blocked`);
    check(['1C', 'project owner'].includes(decision.owner), `decision ${decision.id} has invalid owner`);
    check(typeof decision.requiredValue === 'string' && decision.requiredValue.length > 10, `decision ${decision.id} lacks required value`);
  }

  check(sameArray(readiness.requiredAcceptanceCases, EXACT_CASES), 'acceptance case set or order mismatch');
  check(
    JSON.stringify(readiness.controlledFiles) === JSON.stringify(EXACT_CONTROLLED_FILES),
    'controlled file mapping mismatch',
  );
  for (const path of Object.values(EXACT_CONTROLLED_FILES)) {
    check(existsSync(repoPath(root, path)), `controlled file is missing: ${path}`);
  }

  const declaredSources = new Map(
    (readiness.sourceFiles || []).map((entry) => [entry.path, entry.sha256]),
  );
  check(
    readiness.sourceFiles?.length === EXACT_SOURCE_HASHES.size,
    'source hash array contains missing or duplicate entries',
  );
  check(declaredSources.size === EXACT_SOURCE_HASHES.size, 'source hash entry count mismatch');
  for (const [path, expectedHash] of EXACT_SOURCE_HASHES) {
    check(declaredSources.get(path) === expectedHash, `manifest source hash drift: ${path}`);
    const absolute = repoPath(root, path);
    check(existsSync(absolute), `source file is missing: ${path}`);
    if (existsSync(absolute)) {
      check(sha256(absolute) === expectedHash, `source file hash mismatch: ${path}`);
    }
  }
}

function validateCompliance(root, compliance) {
  if (!compliance) return;
  check(
    compliance.schemaVersion === 'pc-crop.one-c-certification-compliance.v1',
    'compliance schema mismatch',
  );
  check(compliance.status === 'NOT_SUBMISSION_READY', 'compliance status was elevated');
  check(
    compliance.sources?.requirements === EXACT_OFFICIAL_SOURCES[0]
      && compliance.sources?.conditions === EXACT_OFFICIAL_SOURCES[1]
      && compliance.sources?.application === EXACT_OFFICIAL_SOURCES[2],
    'compliance primary sources drifted',
  );
  const requirements = compliance.requirements || [];
  const keys = requirements.map((entry) => entry.requirementId);
  check(sameArray(keys, EXACT_REQUIREMENTS), 'official requirement key set or order mismatch');
  const allowedStatuses = new Set([
    'EVIDENCED',
    'PARTIAL',
    'BLOCKED',
    'CONDITIONAL',
    'NOT_APPLICABLE',
  ]);
  for (const requirement of requirements) {
    check(allowedStatuses.has(requirement.status), `${requirement.requirementId} has invalid status`);
    check(Array.isArray(requirement.evidence), `${requirement.requirementId} evidence must be an array`);
    check(Array.isArray(requirement.blockers), `${requirement.requirementId} blockers must be an array`);
    check(typeof requirement.note === 'string' && requirement.note.length > 10, `${requirement.requirementId} note missing`);
    if (['BLOCKED', 'CONDITIONAL'].includes(requirement.status)) {
      check(requirement.blockers?.length > 0, `${requirement.requirementId} lacks blocker evidence`);
    }
    if (['EVIDENCED', 'PARTIAL'].includes(requirement.status)) {
      check(requirement.evidence?.length > 0, `${requirement.requirementId} lacks repository evidence`);
    }
    for (const blocker of requirement.blockers || []) {
      check(EXACT_DECISIONS.includes(blocker), `${requirement.requirementId} has unknown blocker ${blocker}`);
    }
    for (const evidence of requirement.evidence || []) {
      check(existsSync(repoPath(root, evidence)), `${requirement.requirementId} evidence is missing: ${evidence}`);
    }
  }
}

function validatePackage(packageTemplate) {
  if (!packageTemplate) return;
  check(
    packageTemplate.schemaVersion === 'pc-crop.one-c-submission-package.v1',
    'package schema mismatch',
  );
  check(packageTemplate.status === 'TEMPLATE_BLOCKED', 'package template status was elevated');
  for (const key of [
    'certificationCategory',
    'productName',
    'productVersion',
    'targetConfigurationFullName',
    'targetConfigurationEdition',
    'targetConfigurationRelease',
    'targetPlatformVersion',
    'extensionPurpose',
    'registeredPrefix',
    'registeredExtensionName',
    'installationCatalogProcedure',
  ]) {
    check(packageTemplate.application?.[key] === null, `package field ${key} was guessed`);
  }
  for (const key of [
    'legalName',
    'legalAddress',
    'supportChannel',
    'warrantyTerms',
    'authorizedSignatory',
  ]) {
    check(packageTemplate.applicant?.[key] === null, `applicant field ${key} was invented`);
  }
  for (const key of ['signaturePresent', 'sealPresentWhereRequired']) {
    check(packageTemplate.applicant?.[key] === false, `applicant fact ${key} was elevated`);
  }
  for (const key of [
    'certified',
    'officialApplicationSubmitted',
    'compiledCfePresent',
    'licensedRuntimeAccepted',
    'productionConnected',
    'productionCredentialPresent',
    'realDataPresent',
    'directInformationBaseDatabaseAccess',
  ]) {
    check(packageTemplate.facts?.[key] === false, `package fact ${key} must remain false`);
  }
  check(packageTemplate.facts?.newMandatoryCostRub === 0, 'package cost is not zero');
  check(sameSet(packageTemplate.blockers, EXACT_DECISIONS), 'package blocker set mismatch');
  const artifactIds = packageTemplate.artifacts?.map((entry) => entry.id);
  check(
    sameArray(artifactIds, [
      'COMPILED_CFE',
      'USER_GUIDE',
      'README',
      'RELEASE_NOTES',
      'DEMONSTRATION_DATABASE',
      'DEMONSTRATION_SCENARIO',
      'SOURCE_TEXTS',
      'INTEGRITY_MANIFEST',
    ]),
    'submission artifact inventory mismatch',
  );
  const cfe = packageTemplate.artifacts?.find((entry) => entry.id === 'COMPILED_CFE');
  check(cfe?.status === 'NOT_BUILT', 'compiled CFE was claimed');
  check(cfe?.path === null && cfe?.sha256 === null, 'compiled CFE has fabricated artifact data');
  check(packageTemplate.submissionPolicy?.maySubmitNow === false, 'submission was authorized');
  check(packageTemplate.submissionPolicy?.mayClaimCompatibilityMark === false, 'compatibility claim was authorized');
  check(packageTemplate.submissionPolicy?.mayCreateProductionCredential === false, 'production credential was authorized');
  check(packageTemplate.submissionPolicy?.mayConnectProduction === false, 'production connection was authorized');
  check(packageTemplate.submissionPolicy?.externalCorrespondenceThread === 'SV-1097', 'submission thread drifted');
  check(packageTemplate.submissionPolicy?.sendRequiresExplicitOwnerCommand === 'Отправляй', 'send gate drifted');
}

function validateScenario(scenario) {
  if (!scenario) return;
  check(
    scenario.schemaVersion === 'pc-crop.one-c-synthetic-demo-scenario.v1',
    'synthetic scenario schema mismatch',
  );
  check(scenario.status === 'PLAN_ONLY', 'synthetic scenario was represented as executed');
  for (const key of [
    'containsRealData',
    'containsPersonalData',
    'containsRealRequisites',
    'externalTransmissionAllowed',
    'productionEndpointAllowed',
  ]) {
    check(scenario.dataBoundary?.[key] === false, `scenario boundary ${key} must remain false`);
  }
  check(
    scenario.dataBoundary?.generatedPlatformGuidsOnlyInsideIsolatedDatabaseAtRuntime === true,
    'runtime GUID generation boundary missing',
  );
  check(scenario.execution?.executed === false, 'scenario execution was falsely claimed');
  check(scenario.execution?.licensedRuntime === false, 'licensed runtime was falsely claimed');
  check(scenario.execution?.exactTargetSelected === false, 'exact target was falsely claimed');
  check(findForbiddenObjectKeys(scenario).length === 0, `scenario contains prohibited field keys: ${findForbiddenObjectKeys(scenario).join(', ')}`);
  const commands = scenario.steps?.map((entry) => entry.command);
  check(sameArray(commands, EXACT_COMMANDS), 'synthetic scenario command set or order mismatch');
  const sequences = scenario.steps?.map((entry) => entry.sequence);
  check(sameArray(sequences, [1, 2, 3, 4, 5, 6, 7]), 'synthetic scenario sequence mismatch');
  const serialized = JSON.stringify(scenario);
  check(!/(?:Товар\s*1|Контрагент\s*3|"(?:inn|kpp)")/iu.test(serialized), 'scenario uses weak or prohibited fixture data');
  check(!/\b\d{10}\b|\b\d{12}\b/u.test(serialized), 'scenario appears to contain a real-shaped legal identifier');
}

function validateDocuments(root, readiness) {
  const acceptance = readText(
    repoPath(root, EXACT_CONTROLLED_FILES.acceptanceProtocol),
    'acceptance protocol',
  );
  for (const caseId of EXACT_CASES) {
    const occurrences = acceptance.split(`\`${caseId}\``).length - 1;
    check(occurrences >= 1, `acceptance protocol lacks case ${caseId}`);
  }
  check(acceptance.includes('BLOCKED_NOT_RUN'), 'acceptance protocol lacks not-run truth');
  check(acceptance.includes('25 cases'), 'acceptance protocol case count truth missing');

  const guide = readText(repoPath(root, EXACT_CONTROLLED_FILES.userGuideTemplate), 'user guide');
  for (const heading of [
    '# Руководство пользователя',
    '## 1. Назначение и границы',
    '## 2. Требования и подготовка',
    '## 3. Установка',
    '## 4. Первичная настройка и сопряжение',
    '## 5. Операции обмена',
    '## 6. Отказоустойчивость и сверка',
    '## 7. Обновление, отключение и удаление',
    '## 8. Безопасность и конфиденциальность',
    '## 9. Диагностика и поддержка',
    '## 10. Лицензирование и история изменений',
  ]) {
    check(guide.includes(heading), `user guide lacks required section: ${heading}`);
  }
  check(guide.includes('НЕ ГОТОВО К РАСПРОСТРАНЕНИЮ'), 'user guide lacks template banner');
  check(guide.includes('[[BLOCKED:'), 'user guide hides blocked fields');
  for (const command of EXACT_COMMANDS) {
    check(guide.includes(`\`${command}\``), `user guide lacks command ${command}`);
  }

  const correspondence = readText(
    repoPath(root, EXACT_CONTROLLED_FILES.correspondenceDraft),
    'correspondence draft',
  );
  check(correspondence.includes('SV-1097'), 'correspondence draft lacks thread number');
  check(correspondence.includes('НЕ ОТПРАВЛЕНО'), 'correspondence draft lacks unsent status');
  check(correspondence.includes('Отправляй'), 'correspondence draft lacks explicit owner gate');
  for (const term of [
    'разделу 7',
    'разделу 8',
    'полное наименование',
    'версию платформы',
    'Адаптация',
    'Дополнение',
    'префикса',
    'профилю безопасности',
    'безопасное хранилище БСП',
    'демонстрационную информационную базу',
    'пакет продукта',
  ]) {
    check(correspondence.includes(term), `correspondence draft lacks required question: ${term}`);
  }

  const summary = readText(
    repoPath(root, 'docs/ops/pc-crop-federal-accounting/one-c-certification-readiness-20260825.md'),
    'human readiness summary',
  );
  check(summary.includes(EXACT_HEAD) && summary.includes(EXACT_TREE), 'human summary lacks exact source base');
  check(summary.includes('20 `success`') && summary.includes('2 ожидаемых `skipped`'), 'human summary lacks exact CI outcome');
  check(summary.includes('0 RUB'), 'human summary lacks zero-cost boundary');
  check(summary.includes('NOT CERTIFIED / NOT PRODUCTION'), 'human summary lacks negative status');
  for (const source of EXACT_OFFICIAL_SOURCES) {
    check(summary.includes(source), `human summary lacks official source: ${source}`);
  }
}

function validateScope(scope) {
  if (!scope) return;
  check(scope.schemaVersion === 'platform-v7.concurrent-scope.v1', 'scope schema mismatch');
  check(scope.branch === EXACT_BRANCH, 'scope branch mismatch');
  check(scope.status === 'active', 'scope must remain active');
  check(scope.projectLockId === EXACT_LOCK, 'scope lock mismatch');
  check(scope.issue === 4321, 'scope issue mismatch');
  check(scope.trackingIssue === 4607, 'scope tracking issue mismatch');
  check(scope.productionHosting === 'REG_RU_VPS_ONLY', 'scope production boundary mismatch');
  check(scope.newRecurringCostRub === 0, 'scope cost is not zero');
  check(scope.operationalStatus === 'NOT_ATTESTED', 'scope operational status was elevated');
  check(sameArray(scope.allowedPaths, EXACT_SCOPE_PATHS), 'scope allowed paths mismatch');
  check(Array.isArray(scope.requiredInvariants) && scope.requiredInvariants.length >= 10, 'scope invariants incomplete');
  const invariants = (scope.requiredInvariants || []).join('\n');
  for (const term of [
    'source-only',
    'category',
    'exact target',
    'compiled CFE',
    'real 1С data',
    'direct information-base database access',
    'production credential',
    'SV-1097',
    'Отправляй',
    '0 RUB',
  ]) {
    check(invariants.includes(term), `scope invariant missing: ${term}`);
  }
}

let argumentsValue;
try {
  argumentsValue = parseArguments(process.argv.slice(2));
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
  argumentsValue = { root: process.cwd(), manifest: null };
}

const root = argumentsValue.root;
const defaultManifest = repoPath(
  root,
  'docs/ops/pc-crop-federal-accounting/one-c-certification-readiness.v1.json',
);
const manifestPath = argumentsValue.manifest
  ? (isAbsolute(argumentsValue.manifest)
    ? argumentsValue.manifest
    : resolve(root, argumentsValue.manifest))
  : defaultManifest;

const readiness = readJson(manifestPath, 'readiness manifest');
const compliance = readJson(
  repoPath(root, EXACT_CONTROLLED_FILES.complianceMatrix),
  'compliance matrix',
);
const packageTemplate = readJson(
  repoPath(root, EXACT_CONTROLLED_FILES.packageManifestTemplate),
  'submission package template',
);
const scenario = readJson(
  repoPath(root, EXACT_CONTROLLED_FILES.syntheticScenario),
  'synthetic scenario',
);
const scope = readJson(repoPath(root, EXACT_SCOPE_PATH), 'source-controlled scope');

validateReadiness(root, readiness);
validateCompliance(root, compliance);
validatePackage(packageTemplate);
validateScenario(scenario);
validateDocuments(root, readiness);
validateScope(scope);

const report = {
  schemaVersion: 'pc-crop.one-c-certification-readiness-acceptance.v1',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  sourceBase: {
    pullRequest: 4663,
    headSha: EXACT_HEAD,
    treeSha: EXACT_TREE,
  },
  checked: {
    sourceHashes: EXACT_SOURCE_HASHES.size,
    requirements: EXACT_REQUIREMENTS.length,
    acceptanceCases: EXACT_CASES.length,
    commands: EXACT_COMMANDS.length,
    controlledScopePaths: EXACT_SCOPE_PATHS.length,
  },
  facts: {
    certified: false,
    compiledCfePresent: false,
    licensedOneCRuntimeAcceptance: false,
    productionConnected: false,
    productionCredentialPresent: false,
    realOneCDataUsed: false,
    newMandatoryCostRub: 0,
  },
  failures,
};

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exitCode = 1;
