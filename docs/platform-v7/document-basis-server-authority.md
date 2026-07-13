# Document basis server authority

## Proven by this package

- `/platform-v7/deal-documents-basis` reads the authenticated canonical Deal workspace with `cache: no-store`.
- Deal, tenant, shipment, acceptance, laboratory and document relationships are checked before rendering.
- The latest immutable document version is evaluated for every canonical pre-bank document type.
- A missing, malformed, cross-tenant or contradictory envelope fails closed.
- Pre-bank package readiness is separated from bank-basis confirmation.

## Not proven by this package

- Live EDO, KEP, FGIS Grain, SDIZ or bank connectivity.
- Creation, signing, verification or external registration of documents from this route.
- Production deployment, operational throughput or confirmed production use.

The route remains read-only. PostgreSQL and verified integration callbacks remain the authority for document and bank state.
