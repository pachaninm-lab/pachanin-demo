from __future__ import annotations

XS_NS = "http://www.w3.org/2001/XMLSchema"
WSDL_NS = "http://schemas.xmlsoap.org/wsdl/"
SOAP11_NS = "http://schemas.xmlsoap.org/wsdl/soap/"
WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

EXPECTED_PACKAGE_SHA = "085e22c50b6564219585c96e814b0793d906f4c5e401cbb7446a949c26f0bcd7"
EXPECTED_SOURCE_INVENTORY_SHA = "06c0abd45138654abe805fcb34fa07eae5c708353e0042724f09ac910c14cede"
EXPECTED_SOURCE_SCHEMA_MANIFEST_SHA = "8b8d04ecaf2e3aa96a4bca83530302d66cd82adc5c4c0c6834f37ab20d0d46a8"
EXPECTED_API_VERSION = "1.0.23"
EXPECTED_WSDL_TNS = "urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/1.0.23"
EXPECTED_BINDING = "FGIS_Zerno_ExchangeSoap11Binding"
EXPECTED_PORT_TYPE = "FGIS_Zerno_ExchangePortType"
EXPECTED_SERVICE = "FGIS_Zerno_ExchangeService"
EXPECTED_PORT = "FGIS_Zerno_ExchangeEndpoint"
EXPECTED_DOCUMENTED_ENDPOINT = "http://localhost/api/ws/1.0.23"
EXPECTED_SOAP_TRANSPORT = "http://schemas.xmlsoap.org/soap/http"
EXPECTED_TRANSPORT = ("SendRequest", "SendResponse", "Ack")
EXPECTED_BUSINESS_OPERATION_COUNT = 57
EXPECTED_FAMILY_COUNT = 8

FAMILY_BY_FILE = {
    "fgis-zerno-api-dictionaries-1.0.23.xsd": "DICTIONARIES",
    "fgis-zerno-api-gpb-1.0.23.xsd": "GPB",
    "fgis-zerno-api-gpb-sdiz-1.0.23.xsd": "GPB_SDIZ",
    "fgis-zerno-api-grain-monitor-1.0.23.xsd": "GRAIN_MONITOR",
    "fgis-zerno-api-lots-1.0.23.xsd": "LOTS",
    "fgis-zerno-api-rshn-documents-1.0.23.xsd": "RSHN_DOCUMENTS",
    "fgis-zerno-api-sdiz-1.0.23.xsd": "SDIZ",
    "fgis-zerno-api-ved-contract-1.0.23.xsd": "VED_CONTRACT",
}

PROTOCOL_EVIDENCE = (
    "Все вызовы синхронные",
    "Обработка поступивших запросов выполняется асинхронно",
    "ответ удаляется из очереди безвозвратно",
    "SendRequestRequest",
    "SendResponseRequest",
    "AckRequest",
)


class CatalogError(RuntimeError):
    """Fail-closed contract generation error."""
