#!/usr/bin/env python3
import email
import imaplib
import os
import re
import secrets
import smtplib
import ssl
import sys
import time
from email.message import EmailMessage
from email.policy import default
from email.utils import formatdate, getaddresses, make_msgid


CANONICAL_REG_RU_MAIL_HOST = "mail.hosting.reg.ru"
CANONICAL_REG_RU_IMAP_PORT = 993


def required(name: str) -> str:
    value = os.environ.get(name, "")
    if not value or "\n" in value or "\r" in value or "\x00" in value:
        raise SystemExit(20)
    return value


def ascii_email(value: str) -> str:
    if value.count("@") != 1:
        raise ValueError("email")
    local, domain = value.rsplit("@", 1)
    local.encode("ascii")
    domain_ascii = domain.encode("idna").decode("ascii").lower()
    result = f"{local}@{domain_ascii}"
    if len(result) > 254 or not re.fullmatch(r"[^\s@]{1,64}@[^\s@]{1,189}", result):
        raise ValueError("email")
    return result


def render_control_recipient(template: str, run_id: str) -> str:
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
        rendered = template.replace("{identity}", f"smtp-{run_id}")
    elif run_slot_format:
        rendered = template.replace("{run}", run_id).replace("{slot}", "smtp")
    else:
        raise ValueError("email-template")
    return ascii_email(rendered.lower())


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


def main() -> int:
    smtp_host = required("PC_PROBE_SMTP_HOST")
    smtp_port_raw = required("PC_PROBE_SMTP_PORT")
    mailbox_user_raw = required("PC_PROBE_MAILBOX_USER")
    mailbox_password = required("PC_PROBE_MAILBOX_PASSWORD")
    email_template = required("PC_PROBE_EMAIL_TEMPLATE")
    mail_from_raw = required("PC_PROBE_MAIL_FROM")
    # REG.RU documents one canonical SSL/TLS mail authority for both directions.
    # Do not inherit a historical per-host IMAP endpoint from repository secrets.
    imap_host = CANONICAL_REG_RU_MAIL_HOST
    imap_port_raw = str(CANONICAL_REG_RU_IMAP_PORT)
    imap_folder = os.environ.get("PC_PROBE_IMAP_FOLDER", "INBOX").strip() or "INBOX"
    target_sha = required("PC_PROBE_TARGET_SHA")
    run_id = required("PC_PROBE_RUN_ID")
    login_output = required("PC_PROBE_LOGIN_OUTPUT")

    if smtp_host != CANONICAL_REG_RU_MAIL_HOST:
        return 21
    if not smtp_port_raw.isdigit() or not 1 <= int(smtp_port_raw) <= 65535:
        return 22
    if not re.fullmatch(r"[A-Za-z0-9.-]{1,253}", imap_host):
        return 23
    if not imap_port_raw.isdigit() or not 1 <= int(imap_port_raw) <= 65535:
        return 24
    if len(imap_folder) > 128 or any(ord(c) < 32 for c in imap_folder):
        return 25
    if not re.fullmatch(r"[0-9a-f]{40}", target_sha):
        return 26
    if not re.fullmatch(r"[0-9]+", run_id):
        return 27

    try:
        smtp_login = ascii_email(mailbox_user_raw)
        recipient = render_control_recipient(email_template, run_id)
        mail_from = ascii_email(mail_from_raw)
    except Exception:
        return 28

    old_umask = os.umask(0o077)
    try:
        with open(login_output, "w", encoding="ascii") as handle:
            handle.write(smtp_login + "\n")
    finally:
        os.umask(old_umask)
    os.chmod(login_output, 0o600)

    token = f"PC-CROP-AUTH-MAIL-{target_sha[:12]}-{run_id}-{secrets.token_hex(8)}"
    msg = EmailMessage()
    msg["From"] = mail_from
    msg["To"] = recipient
    msg["Date"] = formatdate(localtime=False)
    msg["Message-ID"] = make_msgid(domain="xn----8sbjf4befbjgs9b.xn--p1ai")
    msg["Subject"] = "PC-CROP auth mail channel verification"
    msg.set_content(
        "Production auth-mail channel verification.\n"
        "This message confirms the existing sender path for account verification.\n"
        f"Verification marker: {token}\n"
    )

    context = ssl.create_default_context()
    try:
        with smtplib.SMTP_SSL(smtp_host, int(smtp_port_raw), timeout=15, context=context) as client:
            code, _ = client.ehlo()
            if code != 250:
                return 31
            client.login(smtp_login, mailbox_password)
            client.send_message(msg, from_addr=mail_from, to_addrs=[recipient])
    except smtplib.SMTPAuthenticationError:
        return 32
    except smtplib.SMTPSenderRefused:
        return 33
    except smtplib.SMTPRecipientsRefused:
        return 34
    except smtplib.SMTPDataError:
        return 35
    except (smtplib.SMTPException, OSError, ssl.SSLError):
        return 36

    deadline = time.time() + 120
    while time.time() < deadline:
        mailbox = None
        try:
            mailbox = imaplib.IMAP4_SSL(imap_host, int(imap_port_raw), ssl_context=context, timeout=15)
            mailbox.login(mailbox_user_raw, mailbox_password)
            status, _ = mailbox.select(imap_folder, readonly=True)
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
                raw = next((item[1] for item in rows if isinstance(item, tuple) and len(item) > 1), None)
                if not raw:
                    continue
                parsed = email.message_from_bytes(raw, policy=default)
                body = message_text(parsed)
                if token not in body:
                    continue
                try:
                    senders = [ascii_email(address) for _, address in getaddresses(parsed.get_all("from", [])) if address]
                    recipients = []
                    for header in ("to", "cc", "delivered-to", "x-original-to", "envelope-to"):
                        recipients.extend(
                            ascii_email(address)
                            for _, address in getaddresses(parsed.get_all(header, []))
                            if address
                        )
                except Exception:
                    return 43
                if mail_from not in senders or recipient not in recipients:
                    return 43
                mailbox.logout()
                print("SMTP_AUTHENTICATED_SEND_OK=1")
                print("IMAP_PROBE_RECEIPT_OK=1")
                return 0
            mailbox.logout()
        except imaplib.IMAP4.error:
            # Authentication/protocol failures are deterministic configuration
            # failures and must not be misreported as a delivery timeout.
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
