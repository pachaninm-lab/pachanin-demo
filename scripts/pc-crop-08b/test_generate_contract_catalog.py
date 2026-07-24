#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import importlib.util
import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

MODULE_PATH = Path(__file__).with_name('generate_contract_catalog.py')
SPEC = importlib.util.spec_from_file_location('pc_crop_08b_generator', MODULE_PATH)
assert SPEC and SPEC.loader
catalog = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(catalog)


def wsdl(address: str = 'http://localhost/api/ws/1.0.23', operations: tuple[str, ...] = ('SendRequest', 'SendResponse', 'Ack')) -> bytes:
    message_rows = []
    operation_rows = []
    binding_rows = []
    for name in operations:
        message_rows.extend([
            f'<wsdl:message name="{name}RequestMsg"><wsdl:part name="parameters" element="types:{name}Request"/></wsdl:message>',
            f'<wsdl:message name="{name}ResponseMsg"><wsdl:part name="parameters" element="types:{name}Response"/></wsdl:message>',
        ])
        operation_rows.append(
            f'<wsdl:operation name="{name}"><wsdl:input message="tns:{name}RequestMsg"/>'
            f'<wsdl:output message="tns:{name}ResponseMsg"/><wsdl:fault name="RequestFault" message="tns:FaultMsg"/></wsdl:operation>'
        )
        binding_rows.append(f'<wsdl:operation name="{name}"><soap:operation soapAction="urn:{name}"/></wsdl:operation>')
    return f'''<?xml version="1.0"?>
<wsdl:definitions targetNamespace="{catalog.EXPECTED_WSDL_TNS}"
 xmlns:tns="{catalog.EXPECTED_WSDL_TNS}"
 xmlns:types="urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/types/1.0.5"
 xmlns:fault="urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/faults/1.0.5"
 xmlns:wsdl="{catalog.WSDL_NS}" xmlns:soap="{catalog.SOAP_NS}">
 {''.join(message_rows)}
 <wsdl:message name="FaultMsg"><wsdl:part name="parameters" element="fault:ZernoFault"/></wsdl:message>
 <wsdl:portType name="FGIS_Zerno_ExchangePortType">{''.join(operation_rows)}</wsdl:portType>
 <wsdl:binding name="FGIS_Zerno_ExchangeSoap11Binding" type="tns:FGIS_Zerno_ExchangePortType">
  <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>{''.join(binding_rows)}
 </wsdl:binding>
 <wsdl:service name="FGIS_Zerno_ExchangeService"><wsdl:port name="Endpoint" binding="tns:FGIS_Zerno_ExchangeSoap11Binding"><soap:address location="{address}"/></wsdl:port></wsdl:service>
</wsdl:definitions>'''.encode()


def schema(namespace: str, request: str, response: str | None) -> bytes:
    response_xml = f'<xs:element name="{response}" type="xs:string"/>' if response else ''
    return f'''<xs:schema xmlns:xs="{catalog.XSD_NS}" targetNamespace="{namespace}">
<xs:element name="{request}" type="xs:string"/>{response_xml}</xs:schema>'''.encode()


def archive_bytes(members: list[tuple[str, bytes]]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for path, payload in members:
            archive.writestr(path, payload)
    return buffer.getvalue()


class ContractCatalogGeneratorTests(unittest.TestCase):
    def test_screaming_snake_preserves_acronyms(self):
        self.assertEqual(catalog.screaming('CreateGpbSDIZ'), 'CREATE_GPB_SDIZ')
        self.assertEqual(catalog.screaming('CreateZKFS'), 'CREATE_ZKFS')
        self.assertEqual(catalog.screaming('GetListSDIZElevator'), 'GET_LIST_SDIZ_ELEVATOR')

    def test_family_map_is_explicit_and_crop_agnostic(self):
        self.assertEqual(catalog.family_from('x/fgis-zerno-api-gpb-sdiz-1.0.23.xsd'), 'GPB_SDIZ')
        self.assertEqual(catalog.family_from('x/fgis-zerno-api-grain-monitor-1.0.23.xsd'), 'GRAIN_MONITOR')
        self.assertIsNone(catalog.family_from('x/unknown-1.0.23.xsd'))

    def test_wsdl_transport_contract_and_placeholder_are_derived(self):
        value = catalog.parse_wsdl(wsdl(), 'contract.wsdl')
        self.assertEqual([item['name'] for item in value['operations']], ['Ack', 'SendRequest', 'SendResponse'])
        self.assertEqual(value['binding'], 'FGIS_Zerno_ExchangeSoap11Binding')
        self.assertEqual(value['portType'], 'FGIS_Zerno_ExchangePortType')
        self.assertEqual(value['documentationPlaceholderEndpoint'], 'http://localhost/api/ws/1.0.23')
        self.assertFalse(value['runtimeEndpointAllowed'])
        self.assertTrue(all(item['faultElementQName'].endswith('}ZernoFault') for item in value['operations']))

    def test_wsdl_transport_drift_fails_closed(self):
        with self.assertRaisesRegex(catalog.CatalogError, 'transport operation drift'):
            catalog.parse_wsdl(wsdl(operations=('SendRequest', 'Ack')), 'contract.wsdl')

    def test_non_placeholder_documentation_address_fails_closed(self):
        with self.assertRaisesRegex(catalog.CatalogError, 'localhost'):
            catalog.parse_wsdl(wsdl(address='https://provider.invalid/api'), 'contract.wsdl')

    def test_package_hash_mismatch_fails_before_schema_generation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'package.zip'
            path.write_bytes(archive_bytes([('contract.wsdl', wsdl())]))
            with self.assertRaisesRegex(catalog.CatalogError, 'package hash mismatch'):
                catalog.generate(path, {
                    'packageSha256': '0' * 64,
                    'inventorySha256': '1' * 64,
                    'schemaManifestSha256': '2' * 64,
                })

    def test_orphan_request_fails_closed(self):
        package = archive_bytes([
            ('contract.wsdl', wsdl()),
            ('fgis-zerno-api-gpb-1.0.23.xsd', schema('urn:test:gpb', 'RequestCreateGpb', None)),
        ])
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'package.zip'
            path.write_bytes(package)
            old_hash = catalog.EXPECTED_PACKAGE_SHA
            catalog.EXPECTED_PACKAGE_SHA = hashlib.sha256(package).hexdigest()
            try:
                with self.assertRaisesRegex(catalog.CatalogError, 'orphan request'):
                    catalog.generate(path, {
                        'packageSha256': catalog.EXPECTED_PACKAGE_SHA,
                        'inventorySha256': '1' * 64,
                        'schemaManifestSha256': '2' * 64,
                    })
            finally:
                catalog.EXPECTED_PACKAGE_SHA = old_hash

    def test_source_lock_requires_pinned_hashes(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'lock.json'
            path.write_text(json.dumps({'status': 'DISCOVERY_REQUIRED'}), 'utf-8')
            with self.assertRaisesRegex(catalog.CatalogError, 'PINNED'):
                catalog.load_lock(path)


if __name__ == '__main__':
    unittest.main()
