#!/usr/bin/env python3
import email
import imaplib
import json
import re
import secrets
import smtplib
import socket
import ssl
import sys
import time
from email.message import EmailMessage
from email.policy import default
from email.utils import formatdate, getaddresses, make_msgid

HOST = "mail.hosting.reg.ru"
SMTP_PORT = 465
IMAP_PORT = 993
ROOT_DOMAIN = "xn----8sbjf4befbjgs9b.xn--p1ai"
ACCEPTANCE_DOMAIN = "acceptance.xn----8sbjf4befbjgs9b.xn--p1ai"


def ascii_email(value: str) -> str:
    if value.count("@") != 1:
        raise ValueError("email")
    local, domain = value.rsplit("@", 1)
    local.encode("ascii")
    normalized = f"{local}@{domain.encode('idna').decode('ascii').lower()}"
    if len(normalized) > 254 or not re.fullmatch(r"[^\s@]{1,64}@[^\s@]{1,189}", normalized):
        raise ValueError("email")
    return normalized


def render_recipient(template: str, run_id: str) -> str:
    identity_format = (
        template.count("{identity}") == 1
        and "{run}" not in template
        and "{slot}" not in template
    )
    run_slot_format = (
        template.count("{identity}") == 0
        and template.count("{run}") == 1
        and template.count("{slot}") == 1
    )
    if identity_format:
        rendered = template.replace("{identity}", f"coherent-{run_id}")
    elif run_slot_format:
        rendered = template.replace("{run}", run_id).replace("{slot}", "coherent")
    else:
        raise ValueError("template")
    recipient = ascii_email(rendered.lower())
    if not recipient.endswith("@" + ACCEPTANCE_DOMAIN):
        raise ValueError("recipient-domain")
    return recipient


def message_text(message) -> str:
    parts = []
    iterator = message.walk() if message.is_multipart() else (message,)
    for part in iterator:
        if part.get_content_type() not in ("text/plain", "text/html"):
            continue
        try:
            parts.append(part.get_content())
        except Exception:
            payload = part.get_payload(decode=True) or b""
            parts.append(payload.decode(part.get_content_charset() or "utf-8", errors="replace"))
    return "\n".join(parts)


def advertised_auth_methods(client: smtplib.SMTP) -> set[str]:
    raw = str(client.esmtp_features.get("auth", "")).upper()
    return {token for token in raw.split() if re.fullmatch(r"[A-Z0-9_-]{1,32}", token)}


def auth_plain(client: smtplib.SMTP, user: str, password: str) -> None:
    client.auth("PLAIN", lambda challenge=None: f"\0{user}\0{password}", initial_response_ok=True)


def auth_login(client: smtplib.SMTP, user: str, password: str) -> None:
    state = {"challenge": 0}

    def response(challenge=None):
        state["challenge"] += 1
        return user if state["challenge"] == 1 else password

    client.auth("LOGIN", response, initial_response_ok=False)


def main() -> int:
    if len(sys.argv) != 2:
        return 20
    try:
        with open(sys.argv[1], encoding="utf-8") as handle:
            cfg = json.load(handle)
        user = ascii_email(str(cfg["user"]))
        password = str(cfg["password"])
        template = str(cfg["template"])
        target_sha = str(cfg["target_sha"])
        run_id = str(cfg["run_id"])
        recipient = render_recipient(template, run_id)
    except Exception:
        return 21

    if (
        not user.endswith("@" + ACCEPTANCE_DOMAIN)
        or not password
        or "\n" in password
        or "\r" in password
        or "\x00" in password
        or not re.fullmatch(r"[0-9a-f]{40}", target_sha)
        or not run_id.isdigit()
    ):
        return 21

    token = f"PC-CROP-COHERENT-{target_sha[:12]}-{run_id}-{secrets.token_hex(8)}"
    message = EmailMessage()
    message["From"] = user
    message["To"] = recipient
    message["Date"] = formatdate(localtime=False)
    message["Message-ID"] = make_msgid(domain=ROOT_DOMAIN)
    message["Subject"] = "PC-CROP auth mail coherence verification"
    message.set_content(
        "Production authentication mail channel verification.\n"
        f"Verification marker: {token}\n"
    )

    context = ssl.create_default_context()
    sent = False
    supported_method_seen = False
    for method in ("PLAIN", "LOGIN"):
        try:
            with smtplib.SMTP_SSL(HOST, SMTP_PORT, timeout=15, context=context) as client:
                code, _ = client.ehlo()
                if code != 250:
                    return 31
                methods = advertised_auth_methods(client)
                if method not in methods:
                    continue
                supported_method_seen = True
                if method == "PLAIN":
                    auth_plain(client, user, password)
                else:
                    auth_login(client, user, password)
                client.send_message(message, from_addr=user, to_addrs=[recipient])
                print(f"SMTP_AUTH_METHOD={method}")
                sent = True
                break
        except smtplib.SMTPAuthenticationError:
            if method == "PLAIN":
                continue
            return 32
        except smtplib.SMTPSenderRefused:
            return 33
        except smtplib.SMTPRecipientsRefused:
            return 34
        except smtplib.SMTPDataError:
            return 35
        except (
            socket.gaierror,
            TimeoutError,
            socket.timeout,
            ssl.SSLError,
            smtplib.SMTPException,
            OSError,
        ):
            return 36

    if not sent:
        return 31 if not supported_method_seen else 32

    deadline = time.time() + 120
    while time.time() < deadline:
        mailbox = None
        try:
            mailbox = imaplib.IMAP4_SSL(HOST, IMAP_PORT, ssl_context=context, timeout=15)
            mailbox.login(user, password)
            status, _ = mailbox.select("INBOX", readonly=True)
            if status != "OK":
                return 41
            status, data = mailbox.search(None, "ALL")
            if status != "OK":
                return 42
            identifiers = (data[0] or b"").split()[-250:]
            for identifier in reversed(identifiers):
                status, rows = mailbox.fetch(identifier, "(BODY.PEEK[])")
                if status != "OK":
                    continue
                raw = next(
                    (item[1] for item in rows if isinstance(item, tuple) and len(item) > 1),
                    None,
                )
                if not raw:
                    continue
                parsed = email.message_from_bytes(raw, policy=default)
                if token not in message_text(parsed):
                    continue
                try:
                    senders = [
                        ascii_email(address)
                        for _, address in getaddresses(parsed.get_all("from", []))
                        if address
                    ]
                    recipients = []
                    for header in ("to", "cc", "delivered-to", "x-original-to", "envelope-to"):
                        recipients.extend(
                            ascii_email(address)
                            for _, address in getaddresses(parsed.get_all(header, []))
                            if address
                        )
                except Exception:
                    return 43
                if user not in senders or recipient not in recipients:
                    return 43
                mailbox.logout()
                print("SMTP_AUTHENTICATED_SEND_OK=1")
                print("IMAP_PROBE_RECEIPT_OK=1")
                return 0
            mailbox.logout()
        except imaplib.IMAP4.error:
            if mailbox is not None:
                try:
                    mailbox.logout()
                except Exception:
                    pass
            return 41
        except (OSError, ssl.SSLError, ValueError):
            if mailbox is not None:
                try:
                    mailbox.logout()
                except Exception:
                    pass
        time.sleep(5)
    return 44


if __name__ == "__main__":
    raise SystemExit(main())
