import type {
  FgisGrainBusinessFamily,
  FgisGrainBusinessOperationCode,
} from './fgis-grain-1.0.23.generated';
import {
  FGIS_GRAIN_1_0_23_BUSINESS_FAMILY_ROWS,
  FGIS_GRAIN_1_0_23_BUSINESS_OPERATION_ROWS,
} from './fgis-grain-1.0.23.operations.generated';

export type FgisGrainBusinessOperation = Readonly<{
  code: FgisGrainBusinessOperationCode;
  name: string;
  family: FgisGrainBusinessFamily;
  classification: 'READ' | 'MUTATION';
  namespace: string;
  requestQName: string;
  responseQName: string;
}>;

const NAMESPACE_BY_FAMILY = new Map<FgisGrainBusinessFamily, string>(
  FGIS_GRAIN_1_0_23_BUSINESS_FAMILY_ROWS.map((row) => [row[0], row[1]]),
);

export const FGIS_GRAIN_1_0_23_BUSINESS_OPERATIONS:
readonly FgisGrainBusinessOperation[] = Object.freeze(
  FGIS_GRAIN_1_0_23_BUSINESS_OPERATION_ROWS.map((row) => {
    const [
      code,
      name,
      family,
      classification,
      requestLocalName,
      responseLocalName,
    ] = row;
    const namespace = NAMESPACE_BY_FAMILY.get(family);
    if (!namespace) {
      throw new Error(`FGIS Grain family namespace missing: ${family}`);
    }
    return Object.freeze({
      code,
      name,
      family,
      classification,
      namespace,
      requestQName: `{${namespace}}${requestLocalName}`,
      responseQName: `{${namespace}}${responseLocalName}`,
    });
  }),
);

if (
  NAMESPACE_BY_FAMILY.size !== 8
  || FGIS_GRAIN_1_0_23_BUSINESS_OPERATIONS.length !== 57
  || new Set(
    FGIS_GRAIN_1_0_23_BUSINESS_OPERATIONS.map((operation) => operation.code),
  ).size !== 57
) {
  throw new Error('FGIS Grain API 1.0.23 generated operation rows are inconsistent.');
}
