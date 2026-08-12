#!/usr/bin/env python3
import imaplib
import json
import smtplib
import socket
import ssl
import sys

HOST = "mail.hosting.reg.ru"
SMTP_PORT = 587
IMAP_PORT = 993
TIMEOUT = 12


def ascii_email(value: str) -> str:
    if value.count("@") != 1:
        raise ValueError("email")
    local, domain = value.rsplit("@", 1)
    local.encode("ascii")
    domain_ascii = domain.encode("idna").decode("ascii").lower()
    result = f"{local}@{domain_ascii}"
    result.encode("ascii")
    return result


def auth_plain(client: smtplib.SMTP, user: str, password: str) -> None:
    def response(challenge=None):
        return f"\0{user}\0{password}"

    client.auth("PLAIN", response, initial_response_ok=True)


def auth_login(client: smtplib.SMTP, user: str, password: str) -> None:
    state = {"challenge": 0}

    def response(challenge=None):
        state["challenge"] += 1
        return user if state["challenge"] == 1 else password

    client.auth("LOGIN", response, initial_response_ok=False)


def advertised_auth_methods(client: smtplib.SMTP) -> set[str]:
    return {
        token
        for token in str(client.esmtp_features.get("auth", "")).upper().split()
        if token and len(token) <= 32
    }


def main() -> int:
    if len(sys.argv) != 2:
        return 20
    with open(sys.argv[1], encoding="utf-8") as handle:
        cfg = json.load(handle)
    user_raw = str(cfg.get("user", ""))
    password = str(cfg.get("password", ""))
    if not user_raw or not password or any(c in user_raw + password for c in ("\n", "\r", "\x00")):
        return 20
    try:
        login = ascii_email(user_raw)
    except Exception:
        return 21

    context = ssl.create_default_context()
    result = {
        "IMAP_TRANSPORT_CLASS": "UNKNOWN",
        "IMAP_GREETING_OK": "0",
        "IMAP_AUTH_RESULT": "NOT_ATTEMPTED",
        "SMTP_STARTTLS_TRANSPORT_CLASS": "UNKNOWN",
        "SMTP_STARTTLS_EHLO_OK": "0",
        "SMTP_STARTTLS_TLS_OK": "0",
        "SMTP_AUTH_LOGIN_ADVERTISED": "0",
        "SMTP_AUTH_PLAIN_ADVERTISED": "0",
        "SMTP_STARTTLS_AUTH_METHOD": "NONE",
        "SMTP_STARTTLS_AUTH_RESULT": "NOT_ATTEMPTED",
        "PRODUCTION_MUTATION": "NONE",
    }

    raw = None
    try:
        raw = socket.create_connection((HOST, IMAP_PORT), timeout=TIMEOUT)
        with context.wrap_socket(raw, server_hostname=HOST) as secure:
            secure.settimeout(TIMEOUT)
            greeting = secure.recv(512)
            if greeting.startswith(b"* OK"):
                result["IMAP_TRANSPORT_CLASS"] = "PASS"
                result["IMAP_GREETING_OK"] = "1"
            elif not greeting:
                result["IMAP_TRANSPORT_CLASS"] = "GREETING_CLOSED"
            else:
                result["IMAP_TRANSPORT_CLASS"] = "GREETING_INVALID"
    except socket.gaierror:
        result["IMAP_TRANSPORT_CLASS"] = "DNS"
    except (TimeoutError, socket.timeout):
        result["IMAP_TRANSPORT_CLASS"] = "TIMEOUT"
    except ssl.SSLError:
        result["IMAP_TRANSPORT_CLASS"] = "TLS"
    except OSError:
        result["IMAP_TRANSPORT_CLASS"] = "NETWORK"
    finally:
        if raw is not None:
            try:
                raw.close()
            except Exception:
                pass

    if result["IMAP_GREETING_OK"] == "1":
        mailbox = None
        try:
            mailbox = imaplib.IMAP4_SSL(HOST, IMAP_PORT, ssl_context=context, timeout=TIMEOUT)
            mailbox.login(login, password)
            result["IMAP_AUTH_RESULT"] = "PASS"
        except imaplib.IMAP4.abort:
            result["IMAP_AUTH_RESULT"] = "ABORT"
        except imaplib.IMAP4.error:
            result["IMAP_AUTH_RESULT"] = "REJECTED"
        except (TimeoutError, socket.timeout):
            result["IMAP_AUTH_RESULT"] = "TIMEOUT"
        except ssl.SSLError:
            result["IMAP_AUTH_RESULT"] = "TLS"
        except OSError:
            result["IMAP_AUTH_RESULT"] = "NETWORK"
        except Exception:
            result["IMAP_AUTH_RESULT"] = "PROTOCOL_ERROR"
        finally:
            if mailbox is not None:
                try:
                    mailbox.logout()
                except Exception:
                    pass

    def open_starttls():
        client = smtplib.SMTP(HOST, SMTP_PORT, timeout=TIMEOUT)
        code, _ = client.ehlo()
        if code != 250:
            raise smtplib.SMTPHeloError(code, b"")
        result["SMTP_STARTTLS_EHLO_OK"] = "1"
        if "starttls" not in client.esmtp_features:
            raise smtplib.SMTPNotSupportedError("STARTTLS_NOT_ADVERTISED")
        client.starttls(context=context)
        result["SMTP_STARTTLS_TLS_OK"] = "1"
        code, _ = client.ehlo()
        if code != 250:
            raise smtplib.SMTPHeloError(code, b"")
        result["SMTP_STARTTLS_TRANSPORT_CLASS"] = "PASS"
        methods = advertised_auth_methods(client)
        result["SMTP_AUTH_LOGIN_ADVERTISED"] = "1" if "LOGIN" in methods else "0"
        result["SMTP_AUTH_PLAIN_ADVERTISED"] = "1" if "PLAIN" in methods else "0"
        return client, methods

    client = None
    try:
        client, methods = open_starttls()
        if "PLAIN" in methods:
            result["SMTP_STARTTLS_AUTH_METHOD"] = "PLAIN"
            try:
                auth_plain(client, login, password)
                result["SMTP_STARTTLS_AUTH_RESULT"] = "PASS"
            except smtplib.SMTPAuthenticationError:
                result["SMTP_STARTTLS_AUTH_RESULT"] = "REJECTED"
            except smtplib.SMTPServerDisconnected:
                try:
                    client.close()
                except Exception:
                    pass
                client = None
                if "LOGIN" in methods:
                    client, retry_methods = open_starttls()
                    if "LOGIN" in retry_methods:
                        result["SMTP_STARTTLS_AUTH_METHOD"] = "LOGIN_AFTER_PLAIN_DISCONNECT"
                        try:
                            auth_login(client, login, password)
                            result["SMTP_STARTTLS_AUTH_RESULT"] = "PASS"
                        except smtplib.SMTPAuthenticationError:
                            result["SMTP_STARTTLS_AUTH_RESULT"] = "REJECTED"
                        except smtplib.SMTPServerDisconnected:
                            result["SMTP_STARTTLS_AUTH_RESULT"] = "DISCONNECTED"
                        except smtplib.SMTPException:
                            result["SMTP_STARTTLS_AUTH_RESULT"] = "PROTOCOL_ERROR"
                    else:
                        result["SMTP_STARTTLS_AUTH_RESULT"] = "LOGIN_NOT_ADVERTISED_AFTER_RECONNECT"
                else:
                    result["SMTP_STARTTLS_AUTH_RESULT"] = "DISCONNECTED"
            except smtplib.SMTPException:
                result["SMTP_STARTTLS_AUTH_RESULT"] = "PROTOCOL_ERROR"
        elif "LOGIN" in methods:
            result["SMTP_STARTTLS_AUTH_METHOD"] = "LOGIN"
            try:
                auth_login(client, login, password)
                result["SMTP_STARTTLS_AUTH_RESULT"] = "PASS"
            except smtplib.SMTPAuthenticationError:
                result["SMTP_STARTTLS_AUTH_RESULT"] = "REJECTED"
            except smtplib.SMTPServerDisconnected:
                result["SMTP_STARTTLS_AUTH_RESULT"] = "DISCONNECTED"
            except smtplib.SMTPException:
                result["SMTP_STARTTLS_AUTH_RESULT"] = "PROTOCOL_ERROR"
        else:
            result["SMTP_STARTTLS_AUTH_RESULT"] = "NO_SUPPORTED_AUTH_ADVERTISED"
    except socket.gaierror:
        result["SMTP_STARTTLS_TRANSPORT_CLASS"] = "DNS"
    except (TimeoutError, socket.timeout):
        result["SMTP_STARTTLS_TRANSPORT_CLASS"] = "TIMEOUT"
    except ssl.SSLError:
        result["SMTP_STARTTLS_TRANSPORT_CLASS"] = "TLS"
    except smtplib.SMTPNotSupportedError:
        result["SMTP_STARTTLS_TRANSPORT_CLASS"] = "STARTTLS_NOT_ADVERTISED"
    except smtplib.SMTPException:
        result["SMTP_STARTTLS_TRANSPORT_CLASS"] = "SMTP_PROTOCOL"
    except OSError:
        result["SMTP_STARTTLS_TRANSPORT_CLASS"] = "NETWORK"
    finally:
        if client is not None:
            try:
                client.quit()
            except Exception:
                try:
                    client.close()
                except Exception:
                    pass

    order = [
        "IMAP_TRANSPORT_CLASS",
        "IMAP_GREETING_OK",
        "IMAP_AUTH_RESULT",
        "SMTP_STARTTLS_TRANSPORT_CLASS",
        "SMTP_STARTTLS_EHLO_OK",
        "SMTP_STARTTLS_TLS_OK",
        "SMTP_AUTH_LOGIN_ADVERTISED",
        "SMTP_AUTH_PLAIN_ADVERTISED",
        "SMTP_STARTTLS_AUTH_METHOD",
        "SMTP_STARTTLS_AUTH_RESULT",
        "PRODUCTION_MUTATION",
    ]
    for key in order:
        print(f"{key}={result[key]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
