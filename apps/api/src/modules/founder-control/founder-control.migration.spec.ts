import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('founder control database authority',()=>{
  const migration=readFileSync(join(process.cwd(),'prisma/migrations/20260908123000_founder_control_center/migration.sql'),'utf8');
  it('keeps platform company data behind the staff principal',()=>{
    expect(migration).toContain('auth.founder_control_records');
    expect(migration).toContain('auth.founder_control_owner_authorized');
    expect(migration).toContain("assignment.role = 'PLATFORM_OWNER'");
    expect(migration).toContain('session.mfa_verified_at IS NOT NULL');
    expect(migration).toContain('REVOKE ALL ON auth.founder_control_records FROM pc_staff_runtime');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION auth.founder_control_upsert');
    expect(migration).not.toMatch(/GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE)[^;]*founder_control_records[^;]*pc_staff_runtime/i);
  });
  it('provisions the fixed founder RPC surface only to staff runtimes',()=>{
    expect(migration).toContain("WHERE rolname IN ('app_staff', 'one_deal_staff')");
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION auth.founder_control_list(text,text,text) TO %I');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION auth.founder_control_event_list(text,text,integer) TO %I');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION auth.founder_control_upsert(text,text,text,text,jsonb,text,text,text,bigint,text,text) TO %I');
    expect(migration).toContain('REVOKE ALL ON FUNCTION auth.founder_control_list(text,text,text) FROM %I');
  });
  it('keeps history append only and mutation concurrency controlled',()=>{
    expect(migration).toContain('Founder control events are append-only');
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain("session.mfa_verified_at >= NOW() - INTERVAL '15 minutes'");
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended('founder-control:idempotency:'");
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended('founder-control:record:'");
    expect(migration).toContain('Founder control version conflict');
    expect(migration).toContain('Founder control idempotency conflict');
    expect(migration).toContain("digest(convert_to(event_material::text,'UTF8'),'sha256')");
  });
});
