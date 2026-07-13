from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(path: str, old: str, new: str, label: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: anchor count={count}")
    write(path, text.replace(old, new, 1))


def sub_once(path: str, pattern: str, replacement: str, label: str, flags: int = re.S | re.M) -> None:
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: regex count={count}")
    write(path, updated)


service_path = "apps/api/src/modules/deals/deal-command.service.ts"
sub_once(
    service_path,
    r"    if \(actionId === 'confirm_inspection'\) \{.*?^    \}\n\n    if \(actionId === 'finalize_lab'\) \{",
    """    if (actionId === 'confirm_inspection') {
      const shipmentId = requiredString(payload, 'shipmentId');
      const documentId = requiredString(payload, 'documentId');
      const inspectionResult = requiredString(payload, 'inspectionResult');
      const inspectedAt = requiredIso(payload, 'inspectedAt');
      const evidenceRef = requiredString(payload, 'evidenceRef');
      await this.requireShipment(tx, shipmentId, deal.id);
      const document = await tx.dealDocument.findUnique({ where: { id: documentId } });
      if (
        !document || document.dealId !== deal.id || document.type !== 'INSPECTION_REPORT'
        || !['VALIDATED', 'SIGNED'].includes(document.status) || !document.hash || !document.s3Key
      ) {
        invalid('documentId', 'Подтверждённое заключение независимого осмотра не найдено в сделке.');
      }
      await this.requireEvidence(tx, evidenceRef, deal.id, shipmentId);
      return {
        shipmentId,
        documentId,
        inspectionResult,
        inspectedAt: inspectedAt.toISOString(),
        evidenceRef,
      };
    }

    if (actionId === 'finalize_lab') {""",
    "confirm inspection authority",
)
sub_once(
    service_path,
    r"      await this\.requireEvidence\(\s*tx,\s*sample\.certificateDocId,\s*deal\.id,\s*sample\.shipmentId \?\? undefined,\s*\);",
    """      const protocolDocument = await tx.dealDocument.findUnique({
        where: { id: sample.certificateDocId },
      });
      if (
        !protocolDocument || protocolDocument.dealId !== deal.id
        || protocolDocument.type !== 'LAB_PROTOCOL' || protocolDocument.status !== 'SIGNED'
        || !protocolDocument.signedAt || !protocolDocument.isImmutable
        || !protocolDocument.hash || !protocolDocument.s3Key
      ) {
        invalid('sampleId', 'Подписанный неизменяемый лабораторный протокол не найден в сделке.');
      }""",
    "canonical protocol document authority",
)

harness_path = "apps/api/test/industrial/harness.ts"
replace_once(
    harness_path,
    "import { IndustrialDealCommandGateway } from '../../src/modules/deals/industrial-deal-command.gateway';\n",
    "import { IndustrialDealCommandGateway } from '../../src/modules/deals/industrial-deal-command.gateway';\nimport { PrismaLabRepository } from '../../src/modules/labs/prisma-lab.repository';\n",
    "harness lab repository import",
)
replace_once(
    harness_path,
    "  routeToFacilityId: string;\n  evidence: Record<string, string>;\n",
    "  routeToFacilityId: string;\n  labProtocolDocumentId: string;\n  labAccreditationId: string;\n  labMethodId: string;\n  labEquipmentId: string;\n  evidence: Record<string, string>;\n",
    "fixture laboratory fields",
)
replace_once(
    harness_path,
    "  gateway: IndustrialDealCommandGateway;\n}\n",
    "  gateway: IndustrialDealCommandGateway;\n  labs: PrismaLabRepository;\n}\n",
    "service instance laboratory repository",
)
replace_once(
    harness_path,
    "  const gateway = new IndustrialDealCommandGateway(prisma, rls, commands);\n  return { prisma, rls, commands, gateway };\n",
    "  const gateway = new IndustrialDealCommandGateway(prisma, rls, commands);\n  const labs = new PrismaLabRepository(rls);\n  return { prisma, rls, commands, gateway, labs };\n",
    "create laboratory repository",
)
replace_once(
    harness_path,
    "  const routeToFacilityId = `facility:${buyerOrgId}:acceptance`;\n  const passwordHash = bcrypt.hashSync('industrial-e2e', 4);\n",
    "  const routeToFacilityId = `facility:${buyerOrgId}:acceptance`;\n  const labProtocolDocumentId = `lab-protocol:${dealId}`;\n  const labAccreditationId = `lab-accreditation:${dealId}`;\n  const labMethodId = `lab-method:${dealId}:controlled-standard`;\n  const labEquipmentId = `lab-equipment:${dealId}:analyzer-1`;\n  const passwordHash = bcrypt.hashSync('industrial-e2e', 4);\n",
    "laboratory fixture identifiers",
)
replace_once(
    harness_path,
    "      { id: `lab-protocol:${dealId}`, type: 'LAB_PROTOCOL', name: 'Лабораторный протокол' },\n",
    "      { id: labProtocolDocumentId, type: 'LAB_PROTOCOL', name: 'Лабораторный протокол' },\n",
    "laboratory protocol document identifier",
)
sub_once(
    harness_path,
    r"    await tx\.labSample\.upsert\(\{.*?^    \}\);",
    """    const labUserId = `user-e2e-${slug}-lab`;
    const surveyorUserId = `user-e2e-${slug}-surveyor`;
    await tx.labAssignment.upsert({
      where: { dealId_labUserId: { dealId, labUserId } },
      update: {
        tenantId: INDUSTRIAL_TENANT,
        labOrgId: serviceOrgId,
        status: 'ACTIVE',
        validUntil: null,
        evidenceRef: evidence.lab,
      },
      create: {
        id: `lab-assignment:${dealId}`,
        tenantId: INDUSTRIAL_TENANT,
        dealId,
        labOrgId: serviceOrgId,
        labUserId,
        status: 'ACTIVE',
        evidenceRef: evidence.lab,
      },
    });
    await tx.labAccreditation.upsert({
      where: {
        tenantId_labOrgId_reference: {
          tenantId: INDUSTRIAL_TENANT,
          labOrgId: serviceOrgId,
          reference: `ACCREDITATION-${serviceOrgId}`,
        },
      },
      update: {
        status: 'ACTIVE',
        scope: { cultures: ['Пшеница'], standards: ['CONTROLLED-STANDARD-E2E'], testOnly: true },
        validUntil: new Date('2027-01-01T00:00:00.000Z'),
        verifiedAt: new Date(FACT_AT),
        evidenceRef: evidence.lab,
      },
      create: {
        id: labAccreditationId,
        tenantId: INDUSTRIAL_TENANT,
        labOrgId: serviceOrgId,
        reference: `ACCREDITATION-${serviceOrgId}`,
        status: 'ACTIVE',
        scope: { cultures: ['Пшеница'], standards: ['CONTROLLED-STANDARD-E2E'], testOnly: true },
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validUntil: new Date('2027-01-01T00:00:00.000Z'),
        verifiedAt: new Date(FACT_AT),
        evidenceRef: evidence.lab,
      },
    });
    await tx.labMethod.upsert({
      where: {
        tenantId_labOrgId_code: {
          tenantId: INDUSTRIAL_TENANT,
          labOrgId: serviceOrgId,
          code: 'CONTROLLED-E2E',
        },
      },
      update: {
        status: 'ACTIVE',
        applicableStandard: 'CONTROLLED-STANDARD-E2E',
        validUntil: new Date('2027-01-01T00:00:00.000Z'),
        evidenceRef: evidence.lab,
      },
      create: {
        id: labMethodId,
        tenantId: INDUSTRIAL_TENANT,
        labOrgId: serviceOrgId,
        code: 'CONTROLLED-E2E',
        name: 'Controlled industrial E2E method',
        applicableStandard: 'CONTROLLED-STANDARD-E2E',
        status: 'ACTIVE',
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validUntil: new Date('2027-01-01T00:00:00.000Z'),
        evidenceRef: evidence.lab,
      },
    });
    await tx.labEquipment.upsert({
      where: {
        tenantId_labOrgId_serialNumber: {
          tenantId: INDUSTRIAL_TENANT,
          labOrgId: serviceOrgId,
          serialNumber: `TEST-ANALYZER-${slug}`,
        },
      },
      update: {
        status: 'ACTIVE',
        calibratedAt: new Date('2026-06-01T00:00:00.000Z'),
        calibrationValidUntil: new Date('2027-01-01T00:00:00.000Z'),
        calibrationEvidenceRef: evidence.lab,
      },
      create: {
        id: labEquipmentId,
        tenantId: INDUSTRIAL_TENANT,
        labOrgId: serviceOrgId,
        name: 'Controlled industrial E2E analyzer',
        serialNumber: `TEST-ANALYZER-${slug}`,
        status: 'ACTIVE',
        calibratedAt: new Date('2026-06-01T00:00:00.000Z'),
        calibrationValidUntil: new Date('2027-01-01T00:00:00.000Z'),
        calibrationEvidenceRef: evidence.lab,
      },
    });
    await tx.labSample.upsert({
      where: { id: sampleId },
      update: {
        tenantId: INDUSTRIAL_TENANT,
        shipmentId,
        acceptanceId,
        labId: serviceOrgId,
        assignedLabUserId: labUserId,
        samplerUserId: null,
        currentCustodianOrgId: serviceOrgId,
        currentCustodianUserId: surveyorUserId,
        status: 'PENDING',
        protocol: null,
        gost: null,
        accreditationId: null,
        finalizedAt: null,
        finalizedByUserId: null,
        protocolHash: null,
        certificateDocId: null,
        version: 0,
        labName: serviceOrgId,
        collectedAt: null,
      },
      create: {
        id: sampleId,
        dealId,
        shipmentId,
        acceptanceId,
        tenantId: INDUSTRIAL_TENANT,
        labId: serviceOrgId,
        assignedLabUserId: labUserId,
        currentCustodianOrgId: serviceOrgId,
        currentCustodianUserId: surveyorUserId,
        status: 'PENDING',
        culture: 'Пшеница',
        labName: serviceOrgId,
      },
    });""",
    "normalized laboratory authority fixture",
)
replace_once(
    harness_path,
    "    routeToFacilityId,\n    evidence,\n",
    "    routeToFacilityId,\n    labProtocolDocumentId,\n    labAccreditationId,\n    labMethodId,\n    labEquipmentId,\n    evidence,\n",
    "return laboratory fixture identifiers",
)
helper = """export async function prepareLaboratoryFacts(
  instance: ServiceInstance,
  fixture: DealFixture,
): Promise<void> {
  const surveyor = fixture.users.surveyor;
  const lab = fixture.users.lab;
  let workspace = await instance.labs.getById(fixture.sampleId, lab);
  if (workspace.sample.status === 'FINALIZED') return;

  if (workspace.sample.status === 'PENDING') {
    await instance.labs.collect(fixture.sampleId, {
      commandId: `lab:${fixture.dealId}:collect`,
      idempotencyKey: `lab:${fixture.dealId}:collect`,
      expectedVersion: workspace.sample.version,
      occurredAt: '2026-07-12T14:05:00.000Z',
      evidenceRef: fixture.evidence.inspection,
    }, surveyor);
    workspace = await instance.labs.getById(fixture.sampleId, lab);
  }
  if (workspace.sample.status === 'COLLECTED') {
    await instance.labs.handoff(fixture.sampleId, {
      commandId: `lab:${fixture.dealId}:handoff`,
      idempotencyKey: `lab:${fixture.dealId}:handoff`,
      expectedVersion: workspace.sample.version,
      occurredAt: '2026-07-12T14:10:00.000Z',
      evidenceRef: fixture.evidence.lab,
    }, surveyor);
    workspace = await instance.labs.getById(fixture.sampleId, lab);
  }
  if (workspace.sample.status === 'IN_TRANSIT') {
    await instance.labs.receive(fixture.sampleId, {
      commandId: `lab:${fixture.dealId}:receive`,
      idempotencyKey: `lab:${fixture.dealId}:receive`,
      expectedVersion: workspace.sample.version,
      occurredAt: '2026-07-12T14:15:00.000Z',
      evidenceRef: fixture.evidence.lab,
    }, lab);
    workspace = await instance.labs.getById(fixture.sampleId, lab);
  }

  for (const test of [
    { metric: 'moisture', value: 12.4, normMax: 14, at: '2026-07-12T14:30:00.000Z' },
    { metric: 'protein', value: 13.2, normMin: 12.5, at: '2026-07-12T14:40:00.000Z' },
  ]) {
    if (workspace.tests.some((item) => item.parameter === test.metric && !item.correctionOfTestId)) continue;
    await instance.labs.recordTest(fixture.sampleId, {
      commandId: `lab:${fixture.dealId}:test:${test.metric}`,
      idempotencyKey: `lab:${fixture.dealId}:test:${test.metric}`,
      expectedVersion: workspace.sample.version,
      metric: test.metric,
      value: test.value,
      unit: '%',
      ...(test.normMin === undefined ? {} : { normMin: test.normMin }),
      ...(test.normMax === undefined ? {} : { normMax: test.normMax }),
      methodId: fixture.labMethodId,
      equipmentId: fixture.labEquipmentId,
      recordedAt: test.at,
    }, lab);
    workspace = await instance.labs.getById(fixture.sampleId, lab);
  }

  if (workspace.sample.status !== 'FINALIZED') {
    await instance.labs.finalize(fixture.sampleId, {
      commandId: `lab:${fixture.dealId}:finalize`,
      idempotencyKey: `lab:${fixture.dealId}:finalize`,
      expectedVersion: workspace.sample.version,
      protocolNumber: `PROTOCOL-${fixture.dealId}`,
      applicableStandard: 'CONTROLLED-STANDARD-E2E',
      accreditationId: fixture.labAccreditationId,
      signedEvidenceRef: fixture.labProtocolDocumentId,
      finalizedAt: '2026-07-12T15:00:00.000Z',
    }, lab);
  }
}

"""
replace_once(
    harness_path,
    "export function payloadForAction(fixture: DealFixture, actionId: DealActionId): Prisma.InputJsonObject {\n",
    helper + "export function payloadForAction(fixture: DealFixture, actionId: DealActionId): Prisma.InputJsonObject {\n",
    "laboratory preparation helper",
)
sub_once(
    harness_path,
    r"    case 'confirm_inspection':.*?    case 'accept_delivery':",
    """    case 'confirm_inspection':
      return {
        shipmentId: fixture.shipmentId,
        documentId: fixture.inspectionDocumentId,
        inspectionResult: 'CONFORMING',
        evidenceRef: fixture.evidence.inspection,
        inspectedAt: '2026-07-12T14:00:00.000Z',
      };
    case 'finalize_lab':
      return { sampleId: fixture.sampleId };
    case 'accept_delivery':""",
    "factual industrial payloads",
)
replace_once(
    harness_path,
    "        `DELETE FROM \"lab_tests\" WHERE \"sampleId\" IN (SELECT id FROM \"lab_samples\" WHERE \"dealId\" IN (${inList}))`,\n        `DELETE FROM \"lab_samples\" WHERE \"dealId\" IN (${inList})`,\n",
    "        `DELETE FROM \"lab_custody_events\" WHERE \"sampleId\" IN (SELECT id FROM \"lab_samples\" WHERE \"dealId\" IN (${inList}))`,\n        `DELETE FROM \"lab_tests\" WHERE \"sampleId\" IN (SELECT id FROM \"lab_samples\" WHERE \"dealId\" IN (${inList}))`,\n        `DELETE FROM \"lab_samples\" WHERE \"dealId\" IN (${inList})`,\n        `DELETE FROM \"lab_assignments\" WHERE \"dealId\" IN (${inList})`,\n        `DELETE FROM \"lab_accreditations\" WHERE \"tenantId\" = '${INDUSTRIAL_TENANT}'`,\n        `DELETE FROM \"lab_methods\" WHERE \"tenantId\" = '${INDUSTRIAL_TENANT}'`,\n        `DELETE FROM \"lab_equipment\" WHERE \"tenantId\" = '${INDUSTRIAL_TENANT}'`,\n",
    "laboratory cleanup order",
)

industrial_path = "apps/api/test/industrial/industrial-core.e2e-spec.ts"
replace_once(industrial_path, "  payloadForAction,\n  provisionDeal,\n", "  payloadForAction,\n  prepareLaboratoryFacts,\n  provisionDeal,\n", "industrial helper import")
replace_once(industrial_path, "  const deal = await currentDeal(instance, fixture.dealId);\n", "  if (actionId === 'finalize_lab') await prepareLaboratoryFacts(instance, fixture);\n  const deal = await currentDeal(instance, fixture.dealId);\n", "industrial laboratory preparation")

load_path = "apps/api/test/industrial/load-proof.e2e-spec.ts"
replace_once(load_path, "  payloadForAction,\n  provisionDeal,\n", "  payloadForAction,\n  prepareLaboratoryFacts,\n  provisionDeal,\n", "load helper import")
replace_once(load_path, "  const MAX_ATTEMPTS = 12;\n", "  const MAX_ATTEMPTS = 12;\n  if (actionId === 'finalize_lab') await prepareLaboratoryFacts(instance, fixture);\n", "load laboratory preparation")

nofake_path = "apps/api/test/industrial/deal-command-no-fake-live.e2e-spec.ts"
replace_once(nofake_path, "  payloadForAction,\n  provisionDeal,\n", "  payloadForAction,\n  prepareLaboratoryFacts,\n  provisionDeal,\n", "no-fake helper import")
replace_once(
    nofake_path,
    "  for (const [actionId, userKey] of sequence) await execute(fixture, actionId, userKey);\n",
    "  for (const [actionId, userKey] of sequence) {\n    if (actionId === 'finalize_lab') await prepareLaboratoryFacts(instance, fixture);\n    await execute(fixture, actionId, userKey);\n  }\n",
    "no-fake laboratory preparation",
)

seed_path = "apps/api/test/one-deal/seed.ts"
replace_once(
    seed_path,
    "          \"assignedLabUserId\" = 'lab-e2e', \"currentCustodianOrgId\" = 'org-canonical-lab',\n          \"currentCustodianUserId\" = 'lab-e2e', \"accreditationId\" = NULL,\n",
    "          \"assignedLabUserId\" = 'lab-e2e', \"currentCustodianOrgId\" = 'org-canonical-surveyor',\n          \"currentCustodianUserId\" = 'surveyor-e2e', \"accreditationId\" = NULL,\n",
    "one-deal initial custody",
)

one_path = "apps/api/test/one-deal/industrial-one-deal.e2e-spec.ts"
replace_once(one_path, "import { PrismaShipmentRepository } from '../../src/modules/logistics/prisma-shipment.repository';\n", "import { PrismaShipmentRepository } from '../../src/modules/logistics/prisma-shipment.repository';\nimport { PrismaLabRepository } from '../../src/modules/labs/prisma-lab.repository';\n", "one-deal lab import")
sub_once(
    one_path,
    r"    case 'confirm_inspection':.*?    case 'accept_delivery':",
    """    case 'confirm_inspection':
      return {
        shipmentId: SHIPMENT_ID,
        documentId: INSPECTION_ID,
        inspectionResult: 'CONFORMING',
        evidenceRef: evidence('inspection'),
        inspectedAt: '2026-07-12T14:00:00.000Z',
      };
    case 'finalize_lab':
      return { sampleId: SAMPLE_ID };
    case 'accept_delivery':""",
    "one-deal factual payloads",
)
replace_once(one_path, "  const gateway = new IndustrialDealCommandGateway(prisma, rls, commands);\n  const bankKeys = new BankKeyRegistryService(prisma);\n", "  const gateway = new IndustrialDealCommandGateway(prisma, rls, commands);\n  const labs = new PrismaLabRepository(rls);\n  const bankKeys = new BankKeyRegistryService(prisma);\n", "one-deal runtime lab repository")
replace_once(one_path, "  return { prisma, rls, gateway, settlement };\n", "  return { prisma, rls, gateway, settlement, labs };\n", "one-deal runtime return")
one_helper = """  async function prepareLaboratoryFacts(): Promise<void> {
    const surveyor = actor(Role.SURVEYOR);
    const lab = actor(Role.LAB);
    let current = await primary.labs.getById(SAMPLE_ID, lab);
    if (current.sample.status === 'FINALIZED') return;
    if (current.sample.status === 'PENDING') {
      await primary.labs.collect(SAMPLE_ID, {
        commandId: 'lab-command-collect', idempotencyKey: 'lab-idempotency-collect',
        expectedVersion: current.sample.version, evidenceRef: evidence('inspection'),
        occurredAt: '2026-07-12T14:05:00.000Z',
      }, surveyor);
      current = await primary.labs.getById(SAMPLE_ID, lab);
    }
    if (current.sample.status === 'COLLECTED') {
      await primary.labs.handoff(SAMPLE_ID, {
        commandId: 'lab-command-handoff', idempotencyKey: 'lab-idempotency-handoff',
        expectedVersion: current.sample.version, evidenceRef: evidence('lab'),
        occurredAt: '2026-07-12T14:10:00.000Z',
      }, surveyor);
      current = await primary.labs.getById(SAMPLE_ID, lab);
    }
    if (current.sample.status === 'IN_TRANSIT') {
      await primary.labs.receive(SAMPLE_ID, {
        commandId: 'lab-command-receive', idempotencyKey: 'lab-idempotency-receive',
        expectedVersion: current.sample.version, evidenceRef: evidence('lab'),
        occurredAt: '2026-07-12T14:15:00.000Z',
      }, lab);
      current = await primary.labs.getById(SAMPLE_ID, lab);
    }
    for (const test of [
      { metric: 'moisture', value: 12.4, normMax: 14, at: '2026-07-12T14:30:00.000Z' },
      { metric: 'protein', value: 13.2, normMin: 12.5, at: '2026-07-12T14:40:00.000Z' },
    ]) {
      if (current.tests.some((item) => item.parameter === test.metric && !item.correctionOfTestId)) continue;
      await primary.labs.recordTest(SAMPLE_ID, {
        commandId: `lab-command-test-${test.metric}`,
        idempotencyKey: `lab-idempotency-test-${test.metric}`,
        expectedVersion: current.sample.version,
        metric: test.metric,
        value: test.value,
        unit: '%',
        ...(test.normMin === undefined ? {} : { normMin: test.normMin }),
        ...(test.normMax === undefined ? {} : { normMax: test.normMax }),
        methodId: `lab-method:${CANONICAL_TEST_DEAL_ID}:gost-9353`,
        equipmentId: `lab-equipment:${CANONICAL_TEST_DEAL_ID}:analyzer-1`,
        recordedAt: test.at,
      }, lab);
      current = await primary.labs.getById(SAMPLE_ID, lab);
    }
    if (current.sample.status !== 'FINALIZED') {
      await primary.labs.finalize(SAMPLE_ID, {
        commandId: 'lab-command-finalize', idempotencyKey: 'lab-idempotency-finalize',
        expectedVersion: current.sample.version,
        protocolNumber: `PROTOCOL-${CANONICAL_TEST_DEAL_ID}`,
        applicableStandard: 'ГОСТ 9353-2016',
        accreditationId: `lab-accreditation:${CANONICAL_TEST_DEAL_ID}`,
        signedEvidenceRef: `lab-protocol:${CANONICAL_TEST_DEAL_ID}`,
        finalizedAt: '2026-07-12T15:00:00.000Z',
      }, lab);
    }
  }

"""
replace_once(one_path, "  async function evidenceSnapshot(targetRls: RlsTransactionService, user: RequestUser) {\n", one_helper + "  async function evidenceSnapshot(targetRls: RlsTransactionService, user: RequestUser) {\n", "one-deal laboratory helper")
replace_once(one_path, "    await executeUserAction('confirm_inspection');\n    await executeUserAction('finalize_lab');\n", "    await executeUserAction('confirm_inspection');\n    await prepareLaboratoryFacts();\n    await executeUserAction('finalize_lab');\n", "one-deal laboratory preparation")

for temporary in [
    ".tmp-ir103-diag.txt",
    ".tmp-ir103-patch-error.txt",
    ".github/workflows/tmp-ir-10-3-fix.yml",
    ".tmp-ir-10-3-fix-trigger",
]:
    Path(temporary).unlink(missing_ok=True)

print("IR-10.3 laboratory E2E patch applied")
