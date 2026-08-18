#!/usr/bin/env bash
set -Eeuo pipefail
: "${CANARY_RUN_ID:?CANARY_RUN_ID required}"
[[ "$CANARY_RUN_ID" =~ ^[0-9]{6,24}$ ]]
message_id="<pc-p0-direct-mx-canary-${CANARY_RUN_ID}@xn----8sbjf4befbjgs9b.xn--p1ai>"
MESSAGE_ID="$message_id" python3 - <<'PY'
import imaplib, os, re, ssl, sys
mid=os.environ['MESSAGE_ID']
host=os.environ.get('PC_P0_IMAP_HOST','').strip(); raw_user=os.environ.get('PC_P0_IMAP_USER','').strip(); password=os.environ.get('PC_P0_IMAP_PASSWORD',''); port=int((os.environ.get('PC_P0_IMAP_PORT') or '993').strip())
if not re.fullmatch(r'<pc-p0-direct-mx-canary-[0-9]{6,24}@xn----8sbjf4befbjgs9b\.xn--p1ai>',mid): sys.exit(70)
if not host or raw_user.count('@')!=1 or not password or any(c in raw_user+password for c in '\r\n\x00'): sys.exit(71)
local,domain=raw_user.rsplit('@',1); local.encode('ascii'); user=f"{local}@{domain.encode('idna').decode('ascii').lower()}"
c=imaplib.IMAP4_SSL(host,port,ssl_context=ssl.create_default_context(),timeout=15)
def folder_name(raw):
    text=raw.decode('utf-8','replace') if isinstance(raw,bytes) else str(raw)
    m=re.match(r'^\([^)]*\)\s+(?:"[^"]*"|NIL)\s+(.+)$',text)
    if not m: return None
    value=m.group(1).strip()
    if value.startswith('"') and value.endswith('"'):
        value=value[1:-1].replace('\\"','"').replace('\\\\','\\')
    return value if value and len(value)<=512 else None
try:
    caps={x.decode('ascii','ignore').upper() if isinstance(x,bytes) else str(x).upper() for x in c.capabilities}
    if 'AUTH=PLAIN' not in caps: sys.exit(72)
    payload=b'\x00'+user.encode('utf-8')+b'\x00'+password.encode('utf-8')
    if c.authenticate('PLAIN',lambda _challenge: payload)[0]!='OK': sys.exit(73)
    print('IMAP_UTF8_SAFE_AUTH=PASS')
    typ,rows=c.list()
    if typ!='OK': sys.exit(74)
    folders=[]
    for raw in rows or []:
        name=folder_name(raw)
        if name and name not in folders: folders.append(name)
    print(f'IMAP_FOLDER_COUNT={len(folders)}')
    matches=0; searched=0; matching_folders=0
    for folder in folders[:64]:
        try:
            typ,_=c.select(folder,readonly=True)
            if typ!='OK': continue
            searched+=1
            typ,data=c.uid('SEARCH',None,'HEADER','Message-ID',mid)
            if typ!='OK': continue
            ids=(data[0] or b'').split()
            if ids:
                matches += len(ids); matching_folders += 1
        except (imaplib.IMAP4.error,UnicodeError):
            continue
    print(f'IMAP_FOLDERS_SEARCHED={searched}')
    print(f'DIRECT_CANARY_MATCHING_FOLDER_COUNT={matching_folders}')
    print(f'DIRECT_CANARY_MAILBOX_MATCH_COUNT={matches}')
    print('DIRECT_CANARY_MAILBOX_READ_ONLY=PASS')
    print(f'DIRECT_CANARY_DELIVERY_GATE={"PASS" if matches==1 else "BLOCKED"}')
    print('PRODUCTION_MUTATION=NONE')
    sys.exit(0 if matches==1 else 3)
finally:
    try:c.logout()
    except Exception:pass
PY
