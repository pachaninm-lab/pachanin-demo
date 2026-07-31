from pathlib import Path
import json

EXPECTED_BLOBS = {
    'apps/api/prisma/schema.prisma': '7925903d1fd511f3c496eb1a318e2c0bd26ddb38',
    'apps/api/src/modules/auth/registration-application.service.ts': 'b2bfb8e05cc6fd4995d924794b710d8dc7f09754',
    'apps/api/src/modules/auth/registration-decision.service.ts': '6e3921efa3121981e7bfa68dadaaa54735db21d3',
    'apps/api/src/modules/auth/dto/registration-application.dto.ts': 'dabe1f96f072288d9d7440233c8c45a81bc4aec8',
    'docs/platform-v7/autopilot/scopes/p0-first-customer-access-3563.json': 'bd568ca1f8289f73cdfa8f7a9c37780fd0fb3269',
}

schema_path = Path('apps/api/prisma/schema.prisma')
schema = schema_path.read_text()
old_org = '''  ogrn        String?
  name        String
'''
new_org = '''  ogrn        String?
  kpp         String?
  region      String?
  version     BigInt    @default(0)
  name        String
'''
assert schema.count(old_org) == 1, 'organization schema anchor mismatch'
schema = schema.replace(old_org, new_org, 1)

old_membership = '''  role           String
  isDefault      Boolean  @default(false)
  joinedAt       DateTime @default(now())
'''
new_membership = '''  role               String
  status             String    @default("ACTIVE")
  requestedWorkspace String?   @map("requested_workspace")
  isDefault          Boolean   @default(false)
  isOrgAdmin         Boolean   @default(false) @map("is_org_admin")
  joinedAt           DateTime  @default(now())
  activatedAt        DateTime? @map("activated_at")
  revokedAt          DateTime? @map("revoked_at")
  version            BigInt    @default(0)
'''
assert schema.count(old_membership) == 1, 'membership schema anchor mismatch'
schema = schema.replace(old_membership, new_membership, 1)
schema_path.write_text(schema)

application_path = Path('apps/api/src/modules/auth/registration-application.service.ts')
application = application_path.read_text()
assert application.count('  ForbiddenException,\n') == 1
application = application.replace('  ForbiddenException,\n', '', 1)
old_request_user_import = "import { Role, type RequestUser } from '../../common/types/request-user';"
assert application.count(old_request_user_import) == 1
application = application.replace(old_request_user_import, "import { Role } from '../../common/types/request-user';", 1)

type_start = application.index('type DecisionApplicationRow = {')
type_end_marker = "export type RegistrationDecision = 'APPROVE' | 'REJECT' | 'REQUEST_INFORMATION' | 'SUSPEND';\n\n"
type_end = application.index(type_end_marker, type_start) + len(type_end_marker)
application = application[:type_start] + application[type_end:]

decide_start = application.index('  async decide(\n')
decide_end = application.index('\n  private async findByIdempotency(', decide_start)
application = application[:decide_start] + application[decide_end:]

result_start = application.index('  private async readDecisionResult(')
result_end = application.index('\n  private async insertEvent(', result_start)
application = application[:result_start] + application[result_end:]

assert 'async decide(' not in application
assert 'DecisionApplicationRow' not in application
assert 'readDecisionResult' not in application
assert 'RequestUser' not in application
assert 'ForbiddenException' not in application
application_path.write_text(application)

decision_path = Path('apps/api/src/modules/auth/registration-decision.service.ts')
decision = decision_path.read_text()
old_type_import = "import type { RegistrationDecision } from './registration-application.service';\n"
assert decision.count(old_type_import) == 1, 'decision type import anchor mismatch'
decision = decision.replace(
    old_type_import,
    "\nexport type RegistrationDecision = 'APPROVE' | 'REJECT' | 'REQUEST_INFORMATION' | 'SUSPEND';\n",
    1,
)
decision_path.write_text(decision)

dto_path = Path('apps/api/src/modules/auth/dto/registration-application.dto.ts')
dto = dto_path.read_text()
old_dto_import = "import type { RegistrationDecision } from '../registration-application.service';"
assert dto.count(old_dto_import) == 1, 'dto type import anchor mismatch'
dto = dto.replace(old_dto_import, "import type { RegistrationDecision } from '../registration-decision.service';", 1)
dto_path.write_text(dto)

scope_path = Path('docs/platform-v7/autopilot/scopes/p0-first-customer-access-3563.json')
scope = json.loads(scope_path.read_text())
schema_entry = 'apps/api/prisma/schema.prisma'
if schema_entry not in scope['allowedPaths']:
    scope['allowedPaths'].insert(0, schema_entry)
scope['authorityBaseExactMain'] = '73574d194b53d71103f733553296820f023615a5'
scope['acceptance']['changedPathCount'] = len(scope['allowedPaths'])
assert scope['acceptance']['changedPathCount'] == 35
scope_path.write_text(json.dumps(scope, ensure_ascii=False, indent=2) + '\n')
