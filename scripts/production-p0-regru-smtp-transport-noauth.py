#!/usr/bin/env python3
import smtplib
import socket
import ssl

HOST = "mail.hosting.reg.ru"
TIMEOUT = 12


def emit(key: str, value: str | int) -> None:
    text = str(value)
    if not text or not all(ch.isalnum() or ch in "_-" for ch in text):
        raise RuntimeError(f"unsafe marker for {key}")
    print(f"{key}={text}")


def auth_caps(client: smtplib.SMTP) -> tuple[int, int]:
    raw = client.esmtp_features.get("auth", "")
    methods = {item.strip().upper() for item in raw.split() if item.strip()}
    return (1 if "PLAIN" in methods else 0, 1 if "LOGIN" in methods else 0)


def classify_465(context: ssl.SSLContext) -> dict[str, str | int]:
    result: dict[str, str | int] = {
        "SMTPS465_CLASS": "UNCLASSIFIED",
        "SMTPS465_TCP_OK": 0,
        "SMTPS465_TLS_OK": 0,
        "SMTPS465_EHLO_OK": 0,
        "SMTPS465_AUTH_PLAIN_ADVERTISED": 0,
        "SMTPS465_AUTH_LOGIN_ADVERTISED": 0,
    }
    client = None
    try:
        client = smtplib.SMTP_SSL(HOST, 465, timeout=TIMEOUT, context=context)
        result["SMTPS465_TCP_OK"] = 1
        result["SMTPS465_TLS_OK"] = 1
        code, _ = client.ehlo()
        if code != 250:
            result["SMTPS465_CLASS"] = "EHLO_REJECTED"
            return result
        result["SMTPS465_EHLO_OK"] = 1
        plain, login = auth_caps(client)
        result["SMTPS465_AUTH_PLAIN_ADVERTISED"] = plain
        result["SMTPS465_AUTH_LOGIN_ADVERTISED"] = login
        result["SMTPS465_CLASS"] = "PASS"
        return result
    except socket.gaierror:
        result["SMTPS465_CLASS"] = "DNS_FAILURE"
    except (TimeoutError, socket.timeout):
        result["SMTPS465_CLASS"] = "TIMEOUT"
    except ssl.SSLError:
        result["SMTPS465_CLASS"] = "TLS_FAILURE"
    except ConnectionRefusedError:
        result["SMTPS465_CLASS"] = "CONNECTION_REFUSED"
    except smtplib.SMTPServerDisconnected:
        result["SMTPS465_CLASS"] = "SMTP_DISCONNECTED"
    except smtplib.SMTPConnectError:
        result["SMTPS465_CLASS"] = "SMTP_CONNECT_ERROR"
    except smtplib.SMTPHeloError:
        result["SMTPS465_CLASS"] = "EHLO_ERROR"
    except OSError:
        result["SMTPS465_CLASS"] = "NETWORK_ERROR"
    except smtplib.SMTPException:
        result["SMTPS465_CLASS"] = "SMTP_PROTOCOL_ERROR"
    except Exception:
        result["SMTPS465_CLASS"] = "OTHER_ERROR"
    finally:
        if client is not None:
            try:
                client.quit()
            except Exception:
                try:
                    client.close()
                except Exception:
                    pass
    return result


def classify_587(context: ssl.SSLContext) -> dict[str, str | int]:
    result: dict[str, str | int] = {
        "STARTTLS587_CLASS": "UNCLASSIFIED",
        "STARTTLS587_TCP_OK": 0,
        "STARTTLS587_EHLO_OK": 0,
        "STARTTLS587_ADVERTISED": 0,
        "STARTTLS587_TLS_OK": 0,
        "STARTTLS587_POST_TLS_EHLO_OK": 0,
        "STARTTLS587_AUTH_PLAIN_ADVERTISED": 0,
        "STARTTLS587_AUTH_LOGIN_ADVERTISED": 0,
    }
    client = None
    try:
        client = smtplib.SMTP(HOST, 587, timeout=TIMEOUT)
        result["STARTTLS587_TCP_OK"] = 1
        code, _ = client.ehlo()
        if code != 250:
            result["STARTTLS587_CLASS"] = "EHLO_REJECTED"
            return result
        result["STARTTLS587_EHLO_OK"] = 1
        if "starttls" not in client.esmtp_features:
            result["STARTTLS587_CLASS"] = "STARTTLS_NOT_ADVERTISED"
            return result
        result["STARTTLS587_ADVERTISED"] = 1
        client.starttls(context=context)
        result["STARTTLS587_TLS_OK"] = 1
        code, _ = client.ehlo()
        if code != 250:
            result["STARTTLS587_CLASS"] = "POST_TLS_EHLO_REJECTED"
            return result
        result["STARTTLS587_POST_TLS_EHLO_OK"] = 1
        plain, login = auth_caps(client)
        result["STARTTLS587_AUTH_PLAIN_ADVERTISED"] = plain
        result["STARTTLS587_AUTH_LOGIN_ADVERTISED"] = login
        result["STARTTLS587_CLASS"] = "PASS"
        return result
    except socket.gaierror:
        result["STARTTLS587_CLASS"] = "DNS_FAILURE"
    except (TimeoutError, socket.timeout):
        result["STARTTLS587_CLASS"] = "TIMEOUT"
    except ssl.SSLError:
        result["STARTTLS587_CLASS"] = "TLS_FAILURE"
    except ConnectionRefusedError:
        result["STARTTLS587_CLASS"] = "CONNECTION_REFUSED"
    except smtplib.SMTPNotSupportedError:
        result["STARTTLS587_CLASS"] = "STARTTLS_NOT_SUPPORTED"
    except smtplib.SMTPServerDisconnected:
        result["STARTTLS587_CLASS"] = "SMTP_DISCONNECTED"
    except smtplib.SMTPConnectError:
        result["STARTTLS587_CLASS"] = "SMTP_CONNECT_ERROR"
    except smtplib.SMTPHeloError:
        result["STARTTLS587_CLASS"] = "EHLO_ERROR"
    except OSError:
        result["STARTTLS587_CLASS"] = "NETWORK_ERROR"
    except smtplib.SMTPException:
        result["STARTTLS587_CLASS"] = "SMTP_PROTOCOL_ERROR"
    except Exception:
        result["STARTTLS587_CLASS"] = "OTHER_ERROR"
    finally:
        if client is not None:
            try:
                client.quit()
            except Exception:
                try:
                    client.close()
                except Exception:
                    pass
    return result


def main() -> int:
    try:
        infos = socket.getaddrinfo(HOST, 465, type=socket.SOCK_STREAM)
        emit("SMTP_DNS_CLASS", "PASS" if infos else "NO_ADDRESSES")
    except socket.gaierror:
        emit("SMTP_DNS_CLASS", "FAIL")
        emit("SMTPS465_CLASS", "DNS_FAILURE")
        emit("STARTTLS587_CLASS", "DNS_FAILURE")
        emit("AUTH_ATTEMPT", "NO")
        emit("MAIL_SENT", "NO")
        emit("PRODUCTION_MUTATION", "NONE")
        return 0

    context = ssl.create_default_context()
    for key, value in classify_465(context).items():
        emit(key, value)
    for key, value in classify_587(context).items():
        emit(key, value)
    emit("AUTH_ATTEMPT", "NO")
    emit("MAIL_SENT", "NO")
    emit("PRODUCTION_MUTATION", "NONE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
