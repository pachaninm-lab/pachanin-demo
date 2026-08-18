#!/usr/bin/env bash
set -Eeuo pipefail
: "${CANARY_RUN_ID:?CANARY_RUN_ID required}"
[[ "$CANARY_RUN_ID" =~ ^[0-9]{6,24}$ ]]
message_id="<pc-p0-direct-mx-canary-${CANARY_RUN_ID}@xn----8sbjf4befbjgs9b.xn--p1ai>"
MESSAGE_ID="$message_id" python3 - <<'PY'
import email, imaplib, os, re, ssl, sys
from email.policy import default
mid=os.environ['MESSAGE_ID']
host=os.environ.get('PC_P0_IMAP_HOST','').strip()
raw_user=os.environ.get('PC_P0_IMAP_USER','').strip()
password=os.environ.get('PC_P0_IMAP_PASSWORD','')
port=int((os.environ.get('PC_P0_IMAP_PORT') or '993').strip())
folder=(os.environ.get('PC_P0_IMAP_FOLDER') or 'INBOX').strip() or 'INBOX'
if not re.fullmatch(r'<pc-p0-direct-mx-canary-[0-9]{6,24}@xn----8sbjf4befbjgs9b\.xn--p1ai>',mid): raise SystemExit(70)
if not host or not raw_user or not password or any(c in raw_user+password for c in '\r\n\x00'): raise SystemExit(71)
if raw_user.count('@') != 1: raise SystemExit(72)
local,domain=raw_user.rsplit('@',1)
local.encode('ascii')
user=f"{local}@{domain.encode('idna').decode('ascii').lower()}"
if len(user)>254 or not re.fullmatch(r'[^\s@]{1,64}@[^\s@]{1,189}',user): raise SystemExit(73)
c=imaplib.IMAP4_SSL(host,port,ssl_context=ssl.create_default_context(),timeout=15)
try:
    caps={x.decode('ascii','ignore').upper() if isinstance(x,bytes) else str(x).upper() for x in c.capabilities}
    auth_plain=any(x == 'AUTH=PLAIN' for x in caps)
    print(f'IMAP_AUTH_PLAIN_ADVERTISED={"YES" if auth_plain else "NO"}')
    if not auth_plain: raise SystemExit(74)
    payload=(b'\x00'+user.encode('utf-8')+b'\x00'+password.encode('utf-8'))
    typ,_=c.authenticate('PLAIN',lambda _challenge: payload)
    if typ!='OK': raise SystemExit(75)
    print('IMAP_UTF8_SAFE_AUTH=PASS')
    typ,_=c.select(folder,readonly=True)
    if typ!='OK': raise SystemExit(76)
    typ,data=c.search(None,'ALL')
    if typ!='OK': raise SystemExit(77)
    matches=0; checked=0
    for ident in reversed((data[0] or b'').split()[-2000:]):
        typ,rows=c.fetch(ident,'(BODY.PEEK[HEADER.FIELDS (MESSAGE-ID SUBJECT DATE)])')
        if typ!='OK': continue
        raw=next((x[1] for x in rows if isinstance(x,tuple) and len(x)>1),None)
        if not raw: continue
        checked+=1
        msg=email.message_from_bytes(raw,policy=default)
        if str(msg.get('message-id') or '').strip()==mid: matches+=1
    print(f'DIRECT_CANARY_MAILBOX_MATCH_COUNT={matches}')
    print(f'DIRECT_CANARY_MAILBOX_MESSAGES_CHECKED={checked}')
    print('DIRECT_CANARY_MAILBOX_READ_ONLY=PASS')
    print(f'DIRECT_CANARY_DELIVERY_GATE={"PASS" if matches==1 else "BLOCKED"}')
    print('PRODUCTION_MUTATION=NONE')
    sys.exit(0 if matches==1 else 3)
finally:
    try:c.logout()
    except Exception:pass
PY
