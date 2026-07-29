from __future__ import annotations

import argparse
import hashlib
import re
import subprocess
import time
from pathlib import Path
from typing import Iterable

import rpmfile

ROOT_SHA256 = "d26d2d0231b7c39f92cc738512ba54103519e4405d68b5bd703e9788ca8ecf31"
SUB_SHA256 = "2155785036c900dbb5f1bb2a1569c80c55595bd6bf94867a29bbddbc7d88a3f2"

ROOT_URLS = (
    "https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt",
    "http://company.rt.ru/cdp/rootca_ssl_rsa2022.crt",
    "http://rostelecom.ru/cdp/rootca_ssl_rsa2022.crt",
    "http://reestr-pki.ru/cdp/rootca_ssl_rsa2022.crt",
    "http://nuc-cdp.digital.gov.ru/cdp/rootca_ssl_rsa2022.crt",
    "http://nuc-cdp.voskhod.ru/cdp/rootca_ssl_rsa2022.crt",
)
SUB_URLS = (
    "https://gu-st.ru/content/lending/russian_trusted_sub_ca_2024_pem.crt",
    "https://gu-st.ru/content/lending/russian_trusted_sub_ca_pem.crt",
    "http://nuc-cdp.digital.gov.ru/cdp/subca_ssl_rsa2024.crt",
    "http://nuc-cdp.voskhod.ru/cdp/subca_ssl_rsa2024.crt",
    "http://nuc-cdp.digital.gov.ru/cdp/subca_ssl_rsa2024_dv.crt",
    "http://nuc-cdp.voskhod.ru/cdp/subca_ssl_rsa2024_dv.crt",
)
ROOT_RPM_URL = (
    "https://download.opensuse.org/repositories/home:/slyfox:/redsafe/"
    "Fedora_43/x86_64/russian-trusted-root-ca-pem-2025.12-5.1.x86_64.rpm"
)
SUB_RPM_URL = (
    "https://download.opensuse.org/repositories/home:/slyfox:/redsafe/"
    "Fedora_43/x86_64/russian-trusted-sub-ca-pem-2025.12-2.1.x86_64.rpm"
)
PEM_PATTERN = re.compile(
    rb"-----BEGIN CERTIFICATE-----\s+.+?-----END CERTIFICATE-----",
    re.DOTALL,
)


def run(*args: str, stdin: bytes | None = None) -> bytes:
    return subprocess.run(
        args,
        input=stdin,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    ).stdout


def download(url: str, target: Path, evidence: list[str]) -> bool:
    for attempt in range(1, 4):
        try:
            subprocess.run(
                (
                    "curl",
                    "--fail",
                    "--location",
                    "--silent",
                    "--show-error",
                    "--connect-timeout",
                    "10",
                    "--max-time",
                    "60",
                    "--retry",
                    "2",
                    "--retry-all-errors",
                    url,
                    "-o",
                    str(target),
                ),
                check=True,
            )
            evidence.append(f"OK\t{url}\t{target.stat().st_size}")
            return True
        except subprocess.CalledProcessError:
            time.sleep(attempt)
    target.unlink(missing_ok=True)
    evidence.append(f"FAILED\t{url}\t0")
    return False


def candidate_blocks(candidate: Path) -> Iterable[bytes]:
    raw = candidate.read_bytes()
    blocks = PEM_PATTERN.findall(raw)
    return blocks or (raw,)


def select_exact(
    candidates: Iterable[Path], expected: str, output: Path, evidence: list[str]
) -> bool:
    examined = 0
    for candidate in candidates:
        if not candidate.is_file() or candidate.stat().st_size == 0:
            continue
        for block in candidate_blocks(candidate):
            examined += 1
            try:
                inform = (
                    "PEM"
                    if block.lstrip().startswith(b"-----BEGIN CERTIFICATE-----")
                    else "DER"
                )
                der = run(
                    "openssl", "x509", "-inform", inform, "-outform", "DER", stdin=block
                )
            except subprocess.CalledProcessError:
                continue
            digest = hashlib.sha256(der).hexdigest()
            evidence.append(f"EXAMINED\t{candidate}\t{digest}")
            if digest != expected:
                continue
            output.write_bytes(
                run(
                    "openssl", "x509", "-inform", "DER", "-outform", "PEM", stdin=der
                )
            )
            evidence.append(f"MATCH\t{candidate}\t{digest}")
            evidence.append(f"EXAMINED_COUNT\t{examined}\t{digest}")
            return True
    return False


def extract_rpm(rpm_path: Path, destination: Path, prefix: str) -> list[Path]:
    extracted: list[Path] = []
    with rpmfile.open(str(rpm_path)) as package:
        for member in package.getmembers():
            if not member.name.endswith(".crt"):
                continue
            stream = package.extractfile(member)
            if stream is None:
                continue
            target = destination / f"{prefix}_{Path(member.name).name}"
            target.write_bytes(stream.read())
            extracted.append(target)
    return extracted


def collect(
    role: str,
    urls: tuple[str, ...],
    rpm_url: str,
    expected: str,
    output: Path,
    work: Path,
    evidence: list[str],
) -> None:
    candidates: list[Path] = []
    for index, url in enumerate(urls, start=1):
        target = work / "candidates" / f"{role}_{index}"
        if download(url, target, evidence):
            candidates.append(target)
    if select_exact(candidates, expected, output, evidence):
        return

    rpm_path = work / "candidates" / f"{role}.rpm"
    if download(rpm_url, rpm_path, evidence):
        rpm_candidates = extract_rpm(rpm_path, work / "rpm", role)
        if select_exact(rpm_candidates, expected, output, evidence):
            return
    raise RuntimeError(f"exact {role} certificate was not found")


def metadata(cert: Path) -> str:
    return run(
        "openssl",
        "x509",
        "-in",
        str(cert),
        "-noout",
        "-subject",
        "-issuer",
        "-serial",
        "-dates",
        "-fingerprint",
        "-sha256",
    ).decode("utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    output = args.output.resolve()
    work = output.parent / ".ca-export-work"
    for path in (output, work / "candidates", work / "rpm"):
        path.mkdir(parents=True, exist_ok=True)

    fetch_evidence: list[str] = []
    root = output / "russian-trusted-root-ca-2022.pem"
    sub = output / "russian-trusted-sub-ca-2024.pem"
    collect("root", ROOT_URLS, ROOT_RPM_URL, ROOT_SHA256, root, work, fetch_evidence)
    collect("sub", SUB_URLS, SUB_RPM_URL, SUB_SHA256, sub, work, fetch_evidence)

    root_der = run("openssl", "x509", "-in", str(root), "-outform", "DER")
    sub_der = run("openssl", "x509", "-in", str(sub), "-outform", "DER")
    root_digest = hashlib.sha256(root_der).hexdigest()
    sub_digest = hashlib.sha256(sub_der).hexdigest()
    if root_digest != ROOT_SHA256 or sub_digest != SUB_SHA256:
        raise RuntimeError("final DER fingerprint mismatch")

    run("openssl", "verify", "-CAfile", str(root), str(root))
    run("openssl", "verify", "-CAfile", str(root), str(sub))

    (output / "fetch-evidence.tsv").write_text(
        "\n".join(fetch_evidence) + "\n", encoding="utf-8"
    )
    (output / "exact-fingerprints.txt").write_text(
        f"ROOT_DER_SHA256={root_digest}\nSUB_DER_SHA256={sub_digest}\n",
        encoding="utf-8",
    )
    (output / "root-metadata.txt").write_text(metadata(root), encoding="utf-8")
    (output / "sub-metadata.txt").write_text(metadata(sub), encoding="utf-8")
    (output / "verification.txt").write_text(
        "ROOT_SELF_SIGNATURE=PASS\nSUB_SIGNATURE=PASS\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
