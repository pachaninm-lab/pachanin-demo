/* eslint-disable */
/** Generated from the hash-pinned official FGIS Grain API 1.0.23 profile. */
export const FGIS_GRAIN_MESSAGE_DATA_PROFILE_SHA256 = "82362f9976c6e5acd3df55a63972c8b64ba1661410bbc01c3ffe69aee91c6a14" as const;
export const FGIS_GRAIN_MESSAGE_DATA_PROFILE = {
  "boundaries": {
    "confirmedLive": false,
    "credentialOrCertificateMaterial": false,
    "domainMutation": false,
    "fullSoapEnvelope": false,
    "gostDigestOrSigning": false,
    "mtomOrXop": false,
    "productionHosting": "REG_RU_VPS_ONLY",
    "providerCall": false,
    "secondInboxOutboxOrRelay": false,
    "smevTransform": false,
    "xmlCanonicalization": false,
    "xmlDsigOrPkcs7Assembly": false
  },
  "limits": {
    "maxAttributesPerElement": 64,
    "maxBytes": 1048576,
    "maxDepth": 64,
    "maxIdCount": 10000,
    "maxNameLength": 256,
    "maxNamespaceDeclarations": 256,
    "maxNodes": 10000
  },
  "profileVersion": "fgis-zerno-1.0.23-message-data.v1",
  "signingPolicy": {
    "canonicalization": {
      "implemented": false,
      "name": "EXCLUSIVE_XML_CANONICALIZATION_1_0",
      "uri": "http://www.w3.org/2001/10/xml-exc-c14n#"
    },
    "container": {
      "authenticatedAttributes": [
        "1.2.840.113549.1.9.3",
        "1.2.840.113549.1.9.4"
      ],
      "certificateType": "X509",
      "detached": true,
      "embeddedContent": false,
      "format": "PKCS7",
      "maxSignatures": 1,
      "orderingStandard": "RFC5652",
      "version": "1.5"
    },
    "digestAlgorithm": {
      "name": "GOST_R_34_11_2012_256",
      "uri": "urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34112012-256"
    },
    "platformEvidenceDigest": {
      "algorithm": "SHA-256",
      "isGostDigest": false,
      "purpose": "BYTE_IDENTITY_ONLY"
    },
    "signatureAlgorithm": {
      "name": "GOST_R_34_10_2012_256",
      "uri": "urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34102012-gostr34112012-256"
    },
    "statuses": {
      "operational": "NOT_ATTESTED",
      "preparation": "PREPARED_NOT_CANONICALIZED",
      "signature": "NOT_SIGNED",
      "verification": "NOT_VERIFIED"
    },
    "target": "MESSAGE_DATA_CONTENT",
    "targetElementQName": "{urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/types/1.0.5}MessageData",
    "transforms": [
      {
        "implemented": false,
        "name": "SMEV_XML_TRANSFORM",
        "uri": "urn://smev-gov-ru/xmldsig/transform"
      }
    ],
    "xmlIdAttribute": "Id"
  },
  "xml": {
    "messageData": {
      "fields": [
        {
          "maxOccurs": "1",
          "minOccurs": 1,
          "name": "MessageID",
          "order": 0,
          "typeQName": "tns:UUID"
        },
        {
          "maxOccurs": "1",
          "minOccurs": 1,
          "name": "ReferenceMessageID",
          "order": 1,
          "typeQName": "tns:UUID"
        },
        {
          "maxOccurs": "1",
          "minOccurs": 0,
          "name": "MessagePrimaryContent",
          "order": 2,
          "typeQName": "tns:MessagePrimaryContentType"
        },
        {
          "maxOccurs": "1",
          "minOccurs": 0,
          "name": "TestMessage",
          "order": 3,
          "typeQName": "tns:Void"
        }
      ],
      "idAttribute": {
        "name": "Id",
        "typeQName": "xs:ID",
        "use": "optional"
      },
      "primaryContentWildcard": {
        "maxOccurs": "1",
        "minOccurs": 1,
        "namespace": "##other",
        "processContents": "skip"
      },
      "qname": "{urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/types/1.0.5}MessageData"
    },
    "responseCodes": [
      "success",
      "accepted",
      "queue-is-empty",
      "ignored"
    ],
    "typesNamespace": "urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/types/1.0.5",
    "wrappers": [
      {
        "fields": [
          {
            "maxOccurs": "1",
            "minOccurs": 1,
            "name": "MessageData",
            "order": 0,
            "typeQName": "tns:MessageDataType"
          },
          {
            "maxOccurs": "1",
            "minOccurs": 1,
            "name": "InformationSystemSignature",
            "order": 1,
            "typeQName": "tns:XMLDSigSignatureType"
          }
        ],
        "name": "SendRequestRequest",
        "qname": "{urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/types/1.0.5}SendRequestRequest"
      },
      {
        "fields": [
          {
            "maxOccurs": "1",
            "minOccurs": 1,
            "name": "ResponseCode",
            "order": 0,
            "typeQName": "tns:ResponseCodeType"
          },
          {
            "maxOccurs": "1",
            "minOccurs": 0,
            "name": "MessageData",
            "order": 1,
            "typeQName": "tns:MessageDataType"
          },
          {
            "maxOccurs": "1",
            "minOccurs": 0,
            "name": "InformationSystemSignature",
            "order": 2,
            "typeQName": "tns:XMLDSigSignatureType"
          }
        ],
        "name": "SendRequestResponse",
        "qname": "{urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/types/1.0.5}SendRequestResponse"
      },
      {
        "fields": [
          {
            "maxOccurs": "1",
            "minOccurs": 1,
            "name": "MessageData",
            "order": 0,
            "typeQName": "tns:MessageDataType"
          },
          {
            "maxOccurs": "1",
            "minOccurs": 1,
            "name": "InformationSystemSignature",
            "order": 1,
            "typeQName": "tns:XMLDSigSignatureType"
          }
        ],
        "name": "SendResponseRequest",
        "qname": "{urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/types/1.0.5}SendResponseRequest"
      },
      {
        "fields": [
          {
            "maxOccurs": "1",
            "minOccurs": 1,
            "name": "ResponseCode",
            "order": 0,
            "typeQName": "tns:ResponseCodeType"
          },
          {
            "maxOccurs": "1",
            "minOccurs": 0,
            "name": "MessageData",
            "order": 1,
            "typeQName": "tns:MessageDataType"
          },
          {
            "maxOccurs": "1",
            "minOccurs": 0,
            "name": "InformationSystemSignature",
            "order": 2,
            "typeQName": "tns:XMLDSigSignatureType"
          }
        ],
        "name": "SendResponseResponse",
        "qname": "{urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/types/1.0.5}SendResponseResponse"
      },
      {
        "fields": [
          {
            "maxOccurs": "1",
            "minOccurs": 1,
            "name": "MessageData",
            "order": 0,
            "typeQName": "tns:MessageDataType"
          },
          {
            "maxOccurs": "1",
            "minOccurs": 1,
            "name": "InformationSystemSignature",
            "order": 1,
            "typeQName": "tns:XMLDSigSignatureType"
          }
        ],
        "name": "AckRequest",
        "qname": "{urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/types/1.0.5}AckRequest"
      },
      {
        "fields": [
          {
            "maxOccurs": "1",
            "minOccurs": 1,
            "name": "ResponseCode",
            "order": 0,
            "typeQName": "tns:ResponseCodeType"
          },
          {
            "maxOccurs": "1",
            "minOccurs": 0,
            "name": "InformationSystemSignature",
            "order": 1,
            "typeQName": "tns:XMLDSigSignatureType"
          }
        ],
        "name": "AckResponse",
        "qname": "{urn://x-artefacts-mcx-gov-ru/fgiz-zerno/api/ws/types/1.0.5}AckResponse"
      }
    ]
  }
} as const;
