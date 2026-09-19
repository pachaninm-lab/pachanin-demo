#!/usr/bin/env python3
import email
import hashlib
import html
import imaplib
import os
import re
import ssl
from datetime import datetime, timezone
from email.policy import default
from email.utils import getaddresses, parsedate_to_datetime
from urllib.parse import parse_qs, unquote, urlparse


def emit(key: str, value: object) -> None:
    safe = str(value)
    if not re.fullmatch(r"[A-Za-z0-9_.:-]{1,100}", safe):
        safe = "INVALID_SAFE_VALUE"
    print(f"{key}={safe}")


def canonical_candidates(address: str) -> set[str]:
    value = str(address or "").strip().lower()
    if value.count("@") != 1:
        return set()
    local, domain = value.rsplit("@", 1)
    if not local or not domain:
        return set()
    result = {value}
    try:
        result.add(f"{local}@{domain.encode('idna').decode('ascii').lower()}")
    except Exception:
        pass
    try:
        result.add(f"{local}@{domain.encode('ascii').decode('idna').lower()}")
    except Exception:
        pass
    return result


def body_text(message) -> str:
    parts: list[str] = []
    iterator = message.walk() if message.is_multipart() else (message,)
    for part in iterator:
        if part.get_content_type() not in ("text/plain", "text/html"):
            continue
        try:
            parts.append(str(part.get_content()))
        except Exception:
            payload = part.get_payload(decode=True) or b""
            parts.append(payload.decode(part.get_content_charset() or "utf-8", errors="replace"))
    return html.unescape("\n".join(parts))


def finish(values: dict[str, object]) -> None:
    for key in (
        "IMAP_CONNECT",
        "IMAP_LOGIN",
        "IMAP_SELECT",
        "IMAP_SEARCH",
        "IMAP_WINDOW_MESSAGES",
        "IMAP_RECIPIENT_MATCH",
        "IMAP_LINK_MATCH",
        "IMAP_TOKEN_SHAPE",
        "IMAP_ERROR",
    ):
        emit(key, values[key])
    emit("PRODUCTION_MUTATION", "NONE")


values: dict[str, object] = {
    "IMAP_CONNECT": "NOT_RUN",
    "IMAP_LOGIN": "NOT_RUN",
    "IMAP_SELECT": "NOT_RUN",
    "IMAP_SEARCH": "NOT_RUN",
    "IMAP_WINDOW_MESSAGES": 0,
    "IMAP_RECIPIENT_MATCH": 0,
    "IMAP_LINK_MATCH": 0,
    "IMAP_TOKEN_SHAPE": 0,
    "IMAP_ERROR": "NONE",
}

account_hash = str(os.environ.get("P0_ACCOUNT_HASH") or "").strip().lower()
if not re.fullmatch(r"[a-f0-9]{16}", account_hash):
    values["IMAP_ERROR"] = "ACCOUNT_HASH_UNAVAILABLE"
    finish(values)
    raise SystemExit(0)

host = str(os.environ.get("PC_P0_IMAP_HOST") or "").strip()
username = str(os.environ.get("PC_P0_IMAP_USER") or "")
password = str(os.environ.get("PC_P0_IMAP_PASSWORD") or "")
folder = str(os.environ.get("PC_P0_IMAP_FOLDER") or "INBOX").strip() or "INBOX"
try:
    port = int(str(os.environ.get("PC_P0_IMAP_PORT") or "993").strip())
except Exception:
    port = 993

if not host or not username or not password or port < 1 or port > 65535:
    values["IMAP_ERROR"] = "PREREQUISITE_MISSING"
    finish(values)
    raise SystemExit(0)

try:
    window_start = datetime.fromisoformat(str(os.environ["P0_WINDOW_START"]).replace("Z", "+00:00")).timestamp() - 300
    window_end = datetime.fromisoformat(str(os.environ["P0_WINDOW_END"]).replace("Z", "+00:00")).timestamp() + 300
except Exception:
    values["IMAP_ERROR"] = "WINDOW_INVALID"
    finish(values)
    raise SystemExit(0)

url_pattern = re.compile(r"https://[^\s<>\"']+/platform-v7/register\?[^\s<>\"']+", re.I)
client = None
try:
    client = imaplib.IMAP4_SSL(host, port, ssl_context=ssl.create_default_context())
    values["IMAP_CONNECT"] = "PASS"
    client.login(username, password)
    values["IMAP_LOGIN"] = "PASS"
    status, _ = client.select(folder, readonly=True)
    values["IMAP_SELECT"] = "PASS" if status == "OK" else "FAIL"
    if status != "OK":
        values["IMAP_ERROR"] = "SELECT_FAILED"
        finish(values)
        raise SystemExit(0)
    status, data = client.search(None, "ALL")
    values["IMAP_SEARCH"] = "PASS" if status == "OK" else "FAIL"
    if status != "OK":
        values["IMAP_ERROR"] = "SEARCH_FAILED"
        finish(values)
        raise SystemExit(0)

    window_messages = 0
    recipient_matches = 0
    link_matches = 0
    token_matches = 0
    identifiers = (data[0] or b"").split()[-750:]
    for identifier in reversed(identifiers):
        status, rows = client.fetch(identifier, "(BODY.PEEK[])")
        if status != "OK":
            continue
        raw = next((item[1] for item in rows if isinstance(item, tuple) and len(item) > 1), None)
        if not raw:
            continue
        message = email.message_from_bytes(raw, policy=default)
        try:
            sent = parsedate_to_datetime(message.get("date"))
            if sent.tzinfo is None:
                sent = sent.replace(tzinfo=timezone.utc)
            sent_at = sent.timestamp()
        except Exception:
            continue
        if sent_at < window_start or sent_at > window_end:
            continue
        window_messages += 1

        recipients: list[str] = []
        for header in ("to", "cc", "delivered-to", "x-original-to", "envelope-to"):
            recipients.extend(address for _, address in getaddresses(message.get_all(header, [])) if address)
        matched = False
        for recipient in recipients:
            for candidate in canonical_candidates(recipient):
                if hashlib.sha256(candidate.encode("utf-8")).hexdigest()[:16] == account_hash:
                    matched = True
                    break
            if matched:
                break
        if not matched:
            continue
        recipient_matches += 1

        urls = url_pattern.findall(body_text(message))
        if urls:
            link_matches += 1
        valid_token = False
        for candidate in urls:
            query = parse_qs(urlparse(candidate).query)
            token = unquote((query.get("verify") or [""])[0])
            if 48 <= len(token) <= 512 and re.fullmatch(r"[A-Za-z0-9._~-]+", token):
                valid_token = True
                break
        if valid_token:
            token_matches += 1

    values["IMAP_WINDOW_MESSAGES"] = window_messages
    values["IMAP_RECIPIENT_MATCH"] = recipient_matches
    values["IMAP_LINK_MATCH"] = link_matches
    values["IMAP_TOKEN_SHAPE"] = token_matches
except imaplib.IMAP4.error:
    if values["IMAP_CONNECT"] == "PASS" and values["IMAP_LOGIN"] == "NOT_RUN":
        values["IMAP_LOGIN"] = "FAIL"
        values["IMAP_ERROR"] = "LOGIN_FAILED"
    else:
        values["IMAP_ERROR"] = "IMAP_PROTOCOL_FAILED"
except ssl.SSLError:
    values["IMAP_ERROR"] = "TLS_FAILED"
except (OSError, TimeoutError):
    values["IMAP_ERROR"] = "NETWORK_FAILED"
except SystemExit:
    raise
except Exception:
    values["IMAP_ERROR"] = "IMAP_READ_FAILED"
finally:
    if client is not None:
        try:
            client.logout()
        except Exception:
            pass

finish(values)
