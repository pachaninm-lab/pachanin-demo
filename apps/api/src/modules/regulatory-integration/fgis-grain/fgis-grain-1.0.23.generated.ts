/* eslint-disable */
/**
 * Generated from the hash-pinned official FGIS Grain API 1.0.23 package.
 * Do not edit by hand. Regenerate with scripts/pc-crop-08b/generate_contract_catalog.py.
 */

export const FGIS_GRAIN_1_0_23_CATALOG_SHA256 = "b17460c8a65ba7e984faa858537c6c4847b17732d079dc5722b0c2a6337a308b" as const;
export const FGIS_GRAIN_1_0_23_PACKAGE_SHA256 = "085e22c50b6564219585c96e814b0793d906f4c5e401cbb7446a949c26f0bcd7" as const;
export const FGIS_GRAIN_1_0_23_MAPPING_VERSION = "fgis-zerno-1.0.23-catalog.v1" as const;
export const FGIS_GRAIN_1_0_23_TARGET_NAMESPACE = "urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/1.0.23" as const;
export const FGIS_GRAIN_1_0_23_DOCUMENTATION_ENDPOINT = {
  url: "http://localhost/api/ws/1.0.23",
  placeholder: true,
  runtimeAllowed: false,
} as const;

export const FGIS_GRAIN_1_0_23_TRANSPORT_OPERATIONS = [
  {
    name: "Ack",
    soapAction: "urn:Ack",
    inputQName: "{urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/types/1.0.5}AckRequest",
    outputQName: "{urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/types/1.0.5}AckResponse",
    faultQName: "{urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/faults/1.0.5}ZernoFault",
  },
  {
    name: "SendRequest",
    soapAction: "urn:SendRequest",
    inputQName: "{urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/types/1.0.5}SendRequestRequest",
    outputQName: "{urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/types/1.0.5}SendRequestResponse",
    faultQName: "{urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/faults/1.0.5}ZernoFault",
  },
  {
    name: "SendResponse",
    soapAction: "urn:SendResponse",
    inputQName: "{urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/types/1.0.5}SendResponseRequest",
    outputQName: "{urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/types/1.0.5}SendResponseResponse",
    faultQName: "{urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/faults/1.0.5}ZernoFault",
  },
] as const;
export type FgisGrainTransportOperation = typeof FGIS_GRAIN_1_0_23_TRANSPORT_OPERATIONS[number]["name"];

export const FGIS_GRAIN_1_0_23_BUSINESS_FAMILIES = [
  "DICTIONARIES",
  "GPB",
  "GPB_SDIZ",
  "GRAIN_MONITOR",
  "LOTS",
  "RSHN_DOCUMENTS",
  "SDIZ",
  "VED_CONTRACT",
] as const;
export type FgisGrainBusinessFamily = typeof FGIS_GRAIN_1_0_23_BUSINESS_FAMILIES[number];

export const FGIS_GRAIN_1_0_23_BUSINESS_OPERATION_CODES = [
  "DICTIONARIES",
  "CANCELED_GPB",
  "CANCELED_GPB_DEBIT",
  "CREATE_GPB",
  "CREATE_GPB_DEBIT",
  "GET_LIST_GPB",
  "GET_LIST_GPB_DEBIT",
  "CANCELED_GPB_EXTINCTION",
  "CANCELED_GPB_EXTINCTION_REFUSAL",
  "CANCELED_GPB_SDIZ",
  "CREATE_GPB_EXTINCTION",
  "CREATE_GPB_EXTINCTION_REFUSAL",
  "CREATE_GPB_SDIZ",
  "GET_LIST_GPB_EXTINCTION",
  "GET_LIST_GPB_EXTINCTION_REFUSAL",
  "GET_LIST_GPB_SDIZ",
  "CANCELED_GM_APPLICATION",
  "CANCELED_HARVESTED_CROP",
  "CANCELED_PRIMARY_STORAGE_PLACE",
  "CREATE_GM_APPLICATION",
  "CREATE_HARVESTED_CROP",
  "CREATE_PRIMARY_STORAGE_PLACE",
  "DELETE_PRIMARY_STORAGE_PLACE",
  "GET_LIST_GM_APPLICATION",
  "GET_LIST_HARVESTED_CROP",
  "GET_LIST_PRIMARY_STORAGE_PLACE",
  "GET_LIST_RESEARCH",
  "GET_LIST_SAMPLES_PICKING",
  "CANCELED_LOT",
  "CANCELED_LOT_DEBIT",
  "CANCEL_PURCHASE_FROM_INDIVIDUAL_DOC",
  "CREATE_LOT",
  "CREATE_LOT_DEBIT",
  "CREATE_LOT_ON_ELEVATOR",
  "CREATE_PURCHASE_FROM_INDIVIDUAL_DOC",
  "GET_LIST_LOT",
  "GET_LIST_LOT_DEBIT",
  "GET_LIST_PURCHASE_FROM_INDIVIDUAL_DOC",
  "CREATE_CERTIFICATE",
  "CREATE_EXPORT_VET_CERTIFICATE",
  "CREATE_VET_CERTIFICATE",
  "CREATE_ZKFS",
  "CANCELED_EXTINCTION",
  "CANCELED_EXTINCTION_REFUSAL",
  "CANCELED_SDIZ",
  "CREATE_EXTINCTION",
  "CREATE_EXTINCTION_REFUSAL",
  "CREATE_SDIZ",
  "CREATE_SDIZ_ELEVATOR",
  "GET_LIST_EXTINCTION",
  "GET_LIST_EXTINCTION_REFUSAL",
  "GET_LIST_SDIZ",
  "GET_LIST_SDIZ_ELEVATOR",
  "CANCEL_VED_CONTRACT",
  "CLOSE_VED_CONTRACT",
  "CREATE_VED_CONTRACT",
  "GET_LIST_VED_CONTRACT",
] as const;
export type FgisGrainBusinessOperationCode = typeof FGIS_GRAIN_1_0_23_BUSINESS_OPERATION_CODES[number];

export const FGIS_GRAIN_1_0_23_RESPONSE_CODES = [
  "success",
  "accepted",
  "queue-is-empty",
  "ignored",
] as const;
export type FgisGrainResponseCode = typeof FGIS_GRAIN_1_0_23_RESPONSE_CODES[number];
export const FGIS_GRAIN_1_0_23_SDIZ_STATUSES = [
  "CREATED",
  "SUBSCRIBED",
  "CANCELED",
  "EXTINGUISHED",
  "SUBSCRIBED_CONFIRMED",
] as const;
export type FgisGrainSdizStatus = typeof FGIS_GRAIN_1_0_23_SDIZ_STATUSES[number];
export const FGIS_GRAIN_1_0_23_SDIZ_IDENTIFIER_FIELDS = [
  "Id",
  "MessageID",
  "ReferenceMessageID",
  "SDIZNumber",
  "correctedBySDIZNumber",
  "correctedSDIZNumber",
  "createLotNumber",
  "extinctionId",
  "extinctionRefusalId",
  "id",
  "lotNumber",
  "number",
  "recordsModifiedFrom",
  "sdizID",
  "sdizNumber",
] as const;
export type FgisGrainSdizIdentifierField = typeof FGIS_GRAIN_1_0_23_SDIZ_IDENTIFIER_FIELDS[number];
