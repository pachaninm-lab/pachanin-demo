#!/usr/bin/env bash
set -euo pipefail

LIVE_BASE="${LIVE_BASE:-https://xn----8sbjf4befbjgs9b.xn--p1ai}"
DOWNLOAD_URL="${LIVE_BASE%/}/downloads/prozrachnaya-tsena-presentation.pdf"
MIN_EXPECTED_BYTES=312533
PATCH_MARKER='% PC-GEKTA-FRAME-PATCH-V1'

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
headers="$workdir/headers.txt"
pdf="$workdir/presentation.pdf"

http_code="$(curl -sS --connect-timeout 15 --max-time 60 \
  -H 'Cache-Control: no-cache' \
  -H 'Pragma: no-cache' \
  -D "$headers" \
  -o "$pdf" \
  -w '%{http_code}' \
  "$DOWNLOAD_URL")"

[[ "$http_code" == '200' ]] || {
  echo "Presentation download returned HTTP $http_code" >&2
  exit 20
}

bytes="$(wc -c < "$pdf" | tr -d '[:space:]')"
[[ "$bytes" =~ ^[0-9]+$ ]] || {
  echo 'Presentation byte count is invalid.' >&2
  exit 21
}
(( bytes > MIN_EXPECTED_BYTES )) || {
  echo "Presentation body is too small: $bytes bytes" >&2
  exit 22
}

[[ "$(head -c 5 "$pdf")" == '%PDF-' ]] || {
  echo 'Presentation body does not start with %PDF-.' >&2
  exit 23
}

tail -c 512 "$pdf" | grep -aFq '%%EOF' || {
  echo 'Presentation body is missing the final PDF EOF marker.' >&2
  exit 24
}

grep -aFq "$PATCH_MARKER" "$pdf" || {
  echo 'Presentation body is missing the corrected ГЕКТА frame patch.' >&2
  exit 25
}

content_type="$(awk 'BEGIN{IGNORECASE=1} /^content-type:/{sub(/^[^:]+:[[:space:]]*/, ""); sub(/\r$/, ""); print}' "$headers" | tail -1)"
[[ "$content_type" == application/pdf* ]] || {
  echo "Unexpected Content-Type: ${content_type:-missing}" >&2
  exit 26
}

content_length="$(awk 'BEGIN{IGNORECASE=1} /^content-length:/{sub(/^[^:]+:[[:space:]]*/, ""); sub(/\r$/, ""); print}' "$headers" | tail -1)"
[[ "$content_length" =~ ^[0-9]+$ ]] || {
  echo 'Content-Length is missing or invalid.' >&2
  exit 27
}
[[ "$content_length" == "$bytes" ]] || {
  echo "Content-Length mismatch: header=$content_length body=$bytes" >&2
  exit 28
}

disposition="$(awk 'BEGIN{IGNORECASE=1} /^content-disposition:/{sub(/^[^:]+:[[:space:]]*/, ""); sub(/\r$/, ""); print}' "$headers" | tail -1)"
[[ "$disposition" == attachment* ]] || {
  echo "Content-Disposition is not attachment: ${disposition:-missing}" >&2
  exit 29
}

echo 'LIVE_PRESENTATION_PDF=PASS'
echo "LIVE_PRESENTATION_PDF_HTTP=$http_code"
echo "LIVE_PRESENTATION_PDF_BYTES=$bytes"
echo "LIVE_PRESENTATION_PDF_CONTENT_LENGTH=$content_length"
echo 'LIVE_PRESENTATION_GEKTA_FRAME=PASS'
