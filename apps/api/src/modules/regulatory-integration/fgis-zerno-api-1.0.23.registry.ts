export const FGIS_ZERNO_API_1_0_23_REGISTRY = Object.freeze({
  adapterCode: 'FGIS_ZERNO',
  adapterVersion: '1.0.23-contract-intake',
  mappingPackageVersion: '1.0.23',
  environmentStatus: 'ADAPTER_READY',
  operationalStatus: 'NOT_ATTESTED',
  confirmedLive: false,
  capabilities: Object.freeze(['SCHEMA_MAPPING'] as const),
  officialSourcePage: 'https://specagro.ru/fgis/api',
  packageFilename: 'fgis-zerno-api-1.0.23.zip',
  packageSha256: '085e22c50b6564219585c96e814b0793d906f4c5e401cbb7446a949c26f0bcd7',
  manifestSha256: '6c67835d804a26e85bca1cb248a13f1405173f349cab4ef0b31fc10bd88ad96f',
  schemaFileCount: 23,
  unresolvedReferenceCount: 0,
  liveEndpointUrl: null,
  credentialReference: null,
  certificateReference: null,
} as const);

export type FgisZernoApiRegistryDescriptor = typeof FGIS_ZERNO_API_1_0_23_REGISTRY;
