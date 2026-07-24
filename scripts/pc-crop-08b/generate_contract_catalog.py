#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, io, json, re, urllib.parse, zipfile
from pathlib import Path, PurePosixPath
from typing import Any
from xml.etree import ElementTree as ET

API_VERSION='1.0.23'
ADAPTER_CODE='FGIS_ZERNO'
EXPECTED_PACKAGE_SHA='085e22c50b6564219585c96e814b0793d906f4c5e401cbb7446a949c26f0bcd7'
WSDL_NS='http://schemas.xmlsoap.org/wsdl/'
SOAP_NS='http://schemas.xmlsoap.org/wsdl/soap/'
XSD_NS='http://www.w3.org/2001/XMLSchema'
EXPECTED_WSDL_TNS='urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/1.0.23'
EXPECTED_TRANSPORT=('Ack','SendRequest','SendResponse')
FAMILIES={
'dictionaries':'DICTIONARIES','gpb':'GPB','gpb-sdiz':'GPB_SDIZ','grain-monitor':'GRAIN_MONITOR',
'lots':'LOTS','rshn-documents':'RSHN_DOCUMENTS','sdiz':'SDIZ','ved-contract':'VED_CONTRACT'}

class CatalogError(RuntimeError): pass

def canonical(v:Any)->bytes: return json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
def sha(b:bytes)->str: return hashlib.sha256(b).hexdigest()
def nsmap(data:bytes)->dict[str,str]:
    out={}
    for _,(prefix,uri) in ET.iterparse(io.BytesIO(data),events=('start-ns',)):
        out[prefix or '']=uri
    return out

def expand(value:str|None, ns:dict[str,str])->str:
    if not value: raise CatalogError('QName is required')
    if value.startswith('{'): return value
    if ':' in value:
        p,l=value.split(':',1)
        if p not in ns: raise CatalogError(f'unknown QName prefix: {p}')
        return f'{{{ns[p]}}}{l}'
    uri=ns.get('','')
    return f'{{{uri}}}{value}' if uri else value

def screaming(name:str)->str:
    s=re.sub(r'([a-z0-9])([A-Z])',r'\1_\2',name)
    s=re.sub(r'([A-Z]+)([A-Z][a-z])',r'\1_\2',s)
    return re.sub(r'[^A-Za-z0-9]+','_',s).strip('_').upper()

def family_from(path:str)->str|None:
    m=re.match(r'^fgis-zerno-api-(.+)-1\.0\.23\.xsd$',PurePosixPath(path).name)
    return FAMILIES.get(m.group(1)) if m else None

def parse_wsdl(data:bytes,path:str)->dict[str,Any]:
    root=ET.fromstring(data); ns=nsmap(data)
    if root.attrib.get('targetNamespace')!=EXPECTED_WSDL_TNS: raise CatalogError('WSDL target namespace drift')
    messages={}
    for msg in root.findall(f'{{{WSDL_NS}}}message'):
        name=msg.attrib.get('name'); parts=msg.findall(f'{{{WSDL_NS}}}part')
        if not name or len(parts)!=1: raise CatalogError('WSDL message must have one part')
        messages[name]=expand(parts[0].attrib.get('element'),ns)
    port_types=root.findall(f'{{{WSDL_NS}}}portType')
    if len(port_types)!=1: raise CatalogError('exactly one portType is required')
    pt=port_types[0]; operations=[]
    soap_bindings=[]
    for binding in root.findall(f'{{{WSDL_NS}}}binding'):
        if binding.find(f'{{{SOAP_NS}}}binding') is not None: soap_bindings.append(binding)
    if len(soap_bindings)!=1: raise CatalogError('exactly one SOAP 1.1 binding is required')
    binding=soap_bindings[0]
    actions={}
    for op in binding.findall(f'{{{WSDL_NS}}}operation'):
        soap=op.find(f'{{{SOAP_NS}}}operation')
        if soap is None: raise CatalogError('SOAP action missing')
        actions[op.attrib['name']]=soap.attrib.get('soapAction')
    for op in pt.findall(f'{{{WSDL_NS}}}operation'):
        name=op.attrib.get('name')
        inp=op.find(f'{{{WSDL_NS}}}input'); out=op.find(f'{{{WSDL_NS}}}output'); fault=op.find(f'{{{WSDL_NS}}}fault')
        if not name or inp is None or out is None or fault is None: raise CatalogError('incomplete transport operation')
        im=expand(inp.attrib.get('message'),ns).rsplit('}',1)[-1]
        om=expand(out.attrib.get('message'),ns).rsplit('}',1)[-1]
        fm=expand(fault.attrib.get('message'),ns).rsplit('}',1)[-1]
        if im not in messages or om not in messages or fm not in messages: raise CatalogError('unresolved WSDL message')
        operations.append({'name':name,'soapAction':actions.get(name),'inputMessage':im,'inputElementQName':messages[im],
                           'outputMessage':om,'outputElementQName':messages[om],'faultMessage':fm,'faultElementQName':messages[fm]})
    operations.sort(key=lambda item:item['name'])
    if tuple(item['name'] for item in operations)!=EXPECTED_TRANSPORT: raise CatalogError('transport operation drift')
    addresses=[]
    for service in root.findall(f'{{{WSDL_NS}}}service'):
        for port in service.findall(f'{{{WSDL_NS}}}port'):
            address=port.find(f'{{{SOAP_NS}}}address')
            if address is not None and address.attrib.get('location'): addresses.append(address.attrib['location'])
    if len(addresses)!=1: raise CatalogError('exactly one documentation address expected')
    if urllib.parse.urlparse(addresses[0]).hostname!='localhost': raise CatalogError('WSDL address is not localhost placeholder')
    return {'wsdlPath':path,'wsdlSha256':sha(data),'targetNamespace':EXPECTED_WSDL_TNS,
            'portType':pt.attrib.get('name'),'binding':binding.attrib.get('name'),'soapVersion':'1.1',
            'documentationPlaceholderEndpoint':addresses[0],'runtimeEndpointAllowed':False,'operations':operations}

def load_lock(path:Path)->dict[str,Any]:
    try: value=json.loads(path.read_text('utf-8'))
    except (OSError,json.JSONDecodeError) as error: raise CatalogError(f'source lock cannot be read: {error}') from error
    if value.get('status')!='PINNED': raise CatalogError('source lock is not PINNED')
    for field in ('packageSha256','inventorySha256','schemaManifestSha256'):
        if not re.fullmatch(r'[0-9a-f]{64}',str(value.get(field,''))): raise CatalogError(f'invalid source lock {field}')
    return value

def generate(archive_path:Path, source_lock:dict[str,Any])->dict[str,Any]:
    data=archive_path.read_bytes(); package_sha=sha(data)
    if package_sha!=source_lock.get('packageSha256') or package_sha!=EXPECTED_PACKAGE_SHA: raise CatalogError('package hash mismatch')
    try: archive=zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as error: raise CatalogError(f'invalid ZIP: {error}') from error
    with archive:
        files=[name for name in archive.namelist() if not name.endswith('/')]
        wsdl_files=[name for name in files if name.endswith('.wsdl')]
        if len(wsdl_files)!=1: raise CatalogError('exactly one WSDL is required')
        transport=parse_wsdl(archive.read(wsdl_files[0]),wsdl_files[0])
        operations=[]; seen_qnames=set(); seen_codes=set(); paired_responses=set(); candidate_responses=set()
        for path in sorted(name for name in files if name.endswith('.xsd')):
            family=family_from(path)
            if not family: continue
            raw=archive.read(path); root=ET.fromstring(raw); namespace=root.attrib.get('targetNamespace')
            if not namespace: raise CatalogError(f'missing targetNamespace: {path}')
            names=[element.attrib['name'] for element in root.findall(f'{{{XSD_NS}}}element') if element.attrib.get('name')]
            if len(names)!=len(set(names)): raise CatalogError(f'duplicate global element: {path}')
            name_set=set(names)
            requests=[name for name in names if name=='Request' or (name.startswith('Request') and len(name)>7)]
            responses=[name for name in names if name=='Response' or (name.startswith('Response') and len(name)>8)]
            candidate_responses.update(f'{{{namespace}}}{name}' for name in responses)
            for request_name in sorted(requests):
                operation_name=request_name[7:] if request_name!='Request' else 'GetDictionary'
                response_name='Response'+(request_name[7:] if request_name!='Request' else '')
                if response_name not in name_set: raise CatalogError(f'orphan request: {path}#{request_name}')
                request_qname=f'{{{namespace}}}{request_name}'; response_qname=f'{{{namespace}}}{response_name}'
                if request_qname in seen_qnames or response_qname in seen_qnames: raise CatalogError('duplicate QName')
                seen_qnames.update((request_qname,response_qname)); paired_responses.add(response_qname)
                local=screaming(operation_name); code=f'{family}_{local}'
                if code in seen_codes: raise CatalogError(f'duplicate operation code: {code}')
                seen_codes.add(code)
                classification='READ' if local=='GET_DICTIONARY' or local.startswith(('GET_','LIST_')) else 'MUTATION'
                operations.append({'family':family,'operationCode':code,'operationName':operation_name,
                    'classification':classification,'transportOperation':'SendRequest','namespace':namespace,
                    'requestElement':request_name,'responseElement':response_name,'requestQName':request_qname,
                    'responseQName':response_qname,'schemaPath':path,'schemaSha256':sha(raw)})
        orphan=sorted(candidate_responses-paired_responses)
        if orphan: raise CatalogError(f'orphan responses: {orphan[:3]}')
    operations.sort(key=lambda item:(item['family'],item['operationCode']))
    if len(operations)!=57: raise CatalogError(f'expected 57 operations, found {len(operations)}')
    catalog={'schemaVersion':'pc-crop.fgis-zerno-contract-catalog.v1','adapterCode':ADAPTER_CODE,
             'apiVersion':API_VERSION,'packageSha256':package_sha,'inventorySha256':source_lock['inventorySha256'],
             'schemaManifestSha256':source_lock['schemaManifestSha256'],'status':'ADAPTER_READY',
             'operationalStatus':'NOT_ATTESTED','confirmedLive':False,'transport':transport,
             'families':sorted({item['family'] for item in operations}),'operationCount':len(operations),'operations':operations,
             'boundaries':{'xmlSerialization':False,'soapHttpClient':False,'cryptographicSigning':False,
                           'credentialsOrCertificates':False,'directDomainMutation':False,'secondInboxOutboxOrRelay':False}}
    catalog['catalogSha256']=sha(canonical(catalog))
    return catalog

def main()->int:
    parser=argparse.ArgumentParser(); parser.add_argument('--archive',type=Path,required=True)
    parser.add_argument('--source-lock',type=Path,required=True); parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args(); catalog=generate(args.archive,load_lock(args.source_lock))
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(catalog,ensure_ascii=False,sort_keys=True,indent=2)+'\n','utf-8')
    print(json.dumps({'operationCount':catalog['operationCount'],'catalogSha256':catalog['catalogSha256']},indent=2))
    return 0

if __name__=='__main__': raise SystemExit(main())
