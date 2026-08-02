#!/usr/bin/env python3
from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"{path}: expected exactly one replacement target, found {count}: {old!r}"
        )
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def insert_once(path: Path, anchor: str, insertion: str) -> None:
    text = path.read_text(encoding="utf-8")
    if insertion in text:
        return
    count = text.count(anchor)
    if count != 1:
        raise SystemExit(
            f"{path}: expected exactly one insertion anchor, found {count}: {anchor!r}"
        )
    path.write_text(text.replace(anchor, insertion + anchor, 1), encoding="utf-8")


deploy = Path("scripts/tai-reg-ru-deploy.sh")
checker = Path("scripts/check-tai-reg-ru-deploy.mjs")

replace_once(
    deploy,
    """  END LOOP;
END
\\$grant\\$;
SQL
""",
    """  END LOOP;
END;
\\$grant\\$;
SQL
""",
)

insert_once(
    checker,
    """
for (const fragment of [
  "set -Eeuo pipefail",
""",
    r"""requireFragment(
  deploy,
  'END;\n\\$grant\\$;',
  deployPath + ': PL/pgSQL runtime role grant block',
);
forbid(
  deploy,
  /END\n\\[$]grant\\[$];/u,
  deployPath + ': PL/pgSQL runtime role grant block must terminate END with a semicolon',
);
""",
)

print("TAI_DATABASE_ROLE_MATERIALIZATION_FIX=APPLIED")
