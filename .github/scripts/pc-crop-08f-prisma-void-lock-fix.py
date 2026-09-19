from pathlib import Path

path = Path('apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-sdiz-projection.repository.ts')
source = path.read_text(encoding='utf-8')

old = '''        await tx.$queryRaw<Array<{ lock: null }>>(Prisma.sql`
          SELECT public.lock_fgis_grain_sdiz_projection_keys(
            ARRAY[${Prisma.join(identityLockKeys)}]::text[]
          ) AS "lock"
        `);
'''
new = '''        await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
          WITH acquired AS MATERIALIZED (
            SELECT public.lock_fgis_grain_sdiz_projection_keys(
              ARRAY[${Prisma.join(identityLockKeys)}]::text[]
            ) AS ignored
          )
          SELECT true AS "locked" FROM acquired
        `);
'''

if new in source:
    raise SystemExit(0)
if source.count(old) != 1:
    raise SystemExit('projection identity void lock boundary not found exactly once')
path.write_text(source.replace(old, new), encoding='utf-8')
