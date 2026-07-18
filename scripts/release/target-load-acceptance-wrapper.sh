#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE="$ROOT_DIR/scripts/release/target-load-acceptance.sh"
GENERATED="$ROOT_DIR/scripts/release/.target-load-acceptance.generated.sh"

cleanup() { rm -f "$GENERATED"; }
trap cleanup EXIT

SOURCE="$SOURCE" GENERATED="$GENERATED" node <<'NODE'
const fs = require('node:fs');
const source = fs.readFileSync(process.env.SOURCE, 'utf8');

const envReplacements = [
  ['SEED_CANONICAL_TEST_DEAL=true', 'SEED_CANONICAL_TEST_DEAL=false'],
  [
    'ALLOW_CANONICAL_TEST_DEAL_IN_PRODUCTION=true',
    'ALLOW_CANONICAL_TEST_DEAL_IN_PRODUCTION=false',
  ],
];

const waitBefore = `for _ in $(seq 1 180); do
  [[ "$(admin_sql "SELECT count(*) FROM public.deals WHERE id='DEAL-INDUSTRIAL-001';")" = "1" ]] && break
  sleep 2
done
[[ "$(admin_sql "SELECT count(*) FROM public.deals WHERE id='DEAL-INDUSTRIAL-001';")" = "1" ]]`;

const waitAfter = `admin_sql "
INSERT INTO public.organizations
  (id,inn,name,type,status,\\"tenantId\\",\\"verifiedAt\\",\\"kycStatus\\",\\"amlStatus\\",\\"sanctionHit\\",\\"createdAt\\",\\"updatedAt\\")
VALUES
  ('org-canonical-seller','990000000003','Canonical Load Seller','LEGAL','VERIFIED','tenant-canonical-test',now(),'APPROVED','CLEAR',false,now(),now()),
  ('org-canonical-buyer','990000000002','Canonical Load Buyer','LEGAL','VERIFIED','tenant-canonical-test',now(),'APPROVED','CLEAR',false,now(),now())
ON CONFLICT (id) DO UPDATE SET \\"tenantId\\"=EXCLUDED.\\"tenantId\\",status='VERIFIED',\\"updatedAt\\"=now();
INSERT INTO public.deals
  (id,status,\\"tenantId\\",\\"sellerOrgId\\",\\"buyerOrgId\\",\\"volumeTonsDec\\",\\"pricePerTonDec\\",\\"totalKopecks\\",version,currency,culture,region,\\"nextAction\\",\\"createdAt\\",\\"updatedAt\\")
VALUES
  ('DEAL-INDUSTRIAL-001','DRAFT','tenant-canonical-test','org-canonical-seller','org-canonical-buyer',150.000000,16000.000000,240000000,0,'RUB','WHEAT','LOAD-REGION','approve_admission',TIMESTAMPTZ '\${DEAL_UPDATED_AT}',TIMESTAMPTZ '\${DEAL_UPDATED_AT}')
ON CONFLICT (id) DO UPDATE SET status='DRAFT',\\"tenantId\\"='tenant-canonical-test',version=0,\\"updatedAt\\"=TIMESTAMPTZ '\${DEAL_UPDATED_AT}';
" >/dev/null
[[ "$(admin_sql "SELECT count(*) FROM public.deals WHERE id='DEAL-INDUSTRIAL-001' AND \\"tenantId\\"='tenant-canonical-test';")" = "1" ]]`;

let rendered = source;
for (const [before, after] of envReplacements) {
  const count = rendered.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`target-load environment boundary "${before}" occurred ${count} times`);
  }
  rendered = rendered.replace(before, after);
}
const waitCount = rendered.split(waitBefore).length - 1;
if (waitCount !== 1) {
  throw new Error(`target-load canonical seed boundary occurred ${waitCount} times`);
}
rendered = rendered.replace(waitBefore, waitAfter);
if (
  rendered === source
  || rendered.includes(waitBefore)
  || envReplacements.some(([before]) => rendered.includes(before))
) {
  throw new Error('target-load wrapper did not replace all boundaries exactly once');
}
fs.writeFileSync(process.env.GENERATED, rendered, { mode: 0o700 });
NODE

bash "$GENERATED"
