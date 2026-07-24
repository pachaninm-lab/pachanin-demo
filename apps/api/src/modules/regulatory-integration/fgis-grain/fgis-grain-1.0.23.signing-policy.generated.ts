// Generated from the hash-pinned official FGIS Grain API 1.0.23 protocol.
// Do not edit by hand. Binary source and prose excerpts are not committed.

export const FGIS_GRAIN_1_0_23_SIGNING_POLICY = {
  "adapterCode": "FGIS_ZERNO",
  "algorithms": {
    "canonicalizationAlgorithmUri": "http://www.w3.org/2001/10/xml-exc-c14n#",
    "digestAlgorithmUri": "urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34112012-256",
    "signatureAlgorithmUri": "urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34102012-gostr34112012-256",
    "transformAlgorithmUri": "urn://smev-gov-ru/xmldsig/transform"
  },
  "apiVersion": "1.0.23",
  "authenticatedAttributes": {
    "contentTypeRequired": true,
    "messageDigestRequired": true,
    "orderingStandard": "RFC_5652"
  },
  "boundaries": {
    "binaryProtocolCommittedToGit": false,
    "canonicalizationImplemented": false,
    "externalRelationshipsResolved": false,
    "gostSigningImplemented": false,
    "macroExecution": false,
    "providerCall": false,
    "signatureVerificationImplemented": false,
    "smevTransformImplemented": false
  },
  "evidence": {
    "canonicalizationAlgorithmUri": {
      "paragraphIndex": 337,
      "paragraphSha256": "f6f54fb4b72d5ff76f872e4ba5b4b6aac4526f3d471d791a085e8cbd832491fc"
    },
    "contentTypeAttribute": {
      "paragraphIndex": 344,
      "paragraphSha256": "0e56f8369d35c9f0d858321162269a78f022c4172cc9fa7e233948a30ab855a0"
    },
    "detached": {
      "paragraphIndex": 345,
      "paragraphSha256": "3ae15e0a0a7b420ba2a105f2bfb90956ddb7b995fc504c126732aa9d670de326"
    },
    "digestAlgorithmUri": {
      "paragraphIndex": 331,
      "paragraphSha256": "65a54f585907c30e9a1aa593bae036786895e1342e5cbfedc8ccdd68d08f006e"
    },
    "messageDataTarget": {
      "paragraphIndex": 323,
      "paragraphSha256": "023927d799dd26a6dd0d6a2de1c27ae8fc89983ccc0c55ca07823b2d51d1d73a"
    },
    "messageDigestAttribute": {
      "paragraphIndex": 352,
      "paragraphSha256": "890b1e452c530880a6a4b2e41ea20e380df55f9550bc4f35e74b216d6b30855e"
    },
    "pkcs7": {
      "paragraphIndex": 342,
      "paragraphSha256": "ea46f1ae88ee38853f480e5476760404fb7003d1889ebeb5e178eb1fc8b7c11e"
    },
    "pkcs7Version15": {
      "paragraphIndex": 342,
      "paragraphSha256": "ea46f1ae88ee38853f480e5476760404fb7003d1889ebeb5e178eb1fc8b7c11e"
    },
    "rfc5652": {
      "paragraphIndex": 353,
      "paragraphSha256": "c6217aa58a253c417d2dd644cac9a7867d4908a24e3b34f8a64a534947348612"
    },
    "signatureAlgorithmUri": {
      "paragraphIndex": 334,
      "paragraphSha256": "75017b47218acc0b4eae71ec720a160a27e3ab15a1dcb3598411b3cd1e9ab30b"
    },
    "singleSignature": {
      "paragraphIndex": 345,
      "paragraphSha256": "3ae15e0a0a7b420ba2a105f2bfb90956ddb7b995fc504c126732aa9d670de326"
    },
    "transformAlgorithmUri": {
      "paragraphIndex": 340,
      "paragraphSha256": "c6a755f48fe38a8ce43c1f7c8e62fef80ee1231326caaab6fbf9600e4daa3e88"
    },
    "x509": {
      "paragraphIndex": 348,
      "paragraphSha256": "f34c54e1a702e052d0cf996aaf491598b297bdd6764a6017498d49ae1cac26d4"
    }
  },
  "implementationStatus": "PORTS_ONLY",
  "operationalStatus": "NOT_ATTESTED",
  "packageSha256": "085e22c50b6564219585c96e814b0793d906f4c5e401cbb7446a949c26f0bcd7",
  "policyVersion": "fgis-zerno-1.0.23-signing-policy.v1",
  "productionHosting": "REG_RU_VPS_ONLY",
  "protocolDocument": {
    "documentXmlSha256": "8c8447b7eee71320025f813b244dccce826f60ecfc6aa8506cd5b150fb6af2fb",
    "externalRelationshipCount": 3,
    "externalRelationshipFingerprints": [
      {
        "part": "word/_rels/document.xml.rels",
        "targetSha256": "c6a755f48fe38a8ce43c1f7c8e62fef80ee1231326caaab6fbf9600e4daa3e88",
        "type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"
      },
      {
        "part": "word/_rels/document.xml.rels",
        "targetSha256": "3f33cab7b1aaed82d60e324574fb75f6e1b8c84bc02cdcabfa0c8f740947fd49",
        "type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"
      },
      {
        "part": "word/_rels/footnotes.xml.rels",
        "targetSha256": "56b94442bdc054c1f6a7c8d2eda973985dc820e76502787aeaabaad0c868c790",
        "type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"
      }
    ],
    "externalRelationshipsResolved": false,
    "macroOrEmbeddedPayloadPresent": false,
    "paragraphCount": 6673,
    "path": "ФГИС ЗЕРНО - API 1.0.23/ФГИС ЗЕРНО API 1.0.23.docx",
    "sha256": "b195a9928970761dde282c4789ebe71b6095435973028688fefbb1beb8e1de9a",
    "sizeBytes": 367964
  },
  "schemaVersion": "pc-crop.fgis-grain-signing-policy.v1",
  "signatureContainer": {
    "certificateProfile": "X509_ONLY",
    "detached": true,
    "embeddedContentAllowed": false,
    "format": "PKCS7",
    "singleSignatureRequired": true,
    "version": "1.5"
  },
  "signatureTarget": {
    "contentInsideElement": true,
    "elementLocalName": "MessageData",
    "referenceStyle": "XML_ID_FRAGMENT"
  }
} as const;

export type FgisGrainSigningPolicy = typeof FGIS_GRAIN_1_0_23_SIGNING_POLICY;
