#!/usr/bin/env bash
#
# setup-euserv.sh — VLESS+Reality на EuServ бесплатном VPS (Debian, IPv6)
#
# Запускать от root на сервере EuServ:
#   bash <(curl -fsSL https://raw.githubusercontent.com/pachaninm-lab/pachanin-demo/claude/xray-endpoint-happ-36Qc0/vpn/euserv/setup-euserv.sh)
#
set -euo pipefail

DEST="www.microsoft.com"
SERVER_NAME="www.microsoft.com"
PORT=443
LABEL="EuServ-Reality"

red()  { printf '\033[31m%s\033[0m\n' "$*"; }
grn()  { printf '\033[32m%s\033[0m\n' "$*"; }
ylw()  { printf '\033[33m%s\033[0m\n' "$*"; }

grn "==> 1/6  Обновляю пакеты..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null 2>&1
apt-get install -y curl unzip ca-certificates >/dev/null 2>&1

grn "==> 2/6  Устанавливаю Xray-core..."
bash -c "$(curl -fsSL https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install >/dev/null

XRAY_BIN="$(command -v xray || echo /usr/local/bin/xray)"
if [ ! -x "$XRAY_BIN" ]; then
  red "Xray не установился. Прерываю."
  exit 1
fi

grn "==> 3/6  Генерирую ключи..."
UUID="$("$XRAY_BIN" uuid)"
KEYS="$("$XRAY_BIN" x25519)"
PRIV="$(echo "$KEYS" | awk '/Private/{print $NF}')"
PUB="$(echo  "$KEYS" | awk '/Public/{print $NF}')"
SHORT_ID="$(openssl rand -hex 8)"

grn "==> 4/6  Пишу конфиг..."
mkdir -p /usr/local/etc/xray
cat > /usr/local/etc/xray/config.json <<JSON
{
  "log": { "loglevel": "warning" },
  "inbounds": [
    {
      "listen": "::",
      "port": ${PORT},
      "protocol": "vless",
      "settings": {
        "clients": [
          { "id": "${UUID}", "flow": "xtls-rprx-vision" }
        ],
        "decryption": "none"
      },
      "streamSettings": {
        "network": "tcp",
        "security": "reality",
        "realitySettings": {
          "show": false,
          "dest": "${DEST}:443",
          "xver": 0,
          "serverNames": [ "${SERVER_NAME}" ],
          "privateKey": "${PRIV}",
          "shortIds": [ "${SHORT_ID}" ]
        }
      },
      "sniffing": { "enabled": true, "destOverride": [ "http", "tls", "quic" ] }
    }
  ],
  "outbounds": [
    { "protocol": "freedom", "tag": "direct" },
    { "protocol": "blackhole", "tag": "block" }
  ]
}
JSON

if ! "$XRAY_BIN" run -test -config /usr/local/etc/xray/config.json >/dev/null 2>&1; then
  red "Конфиг не прошёл проверку."
  exit 1
fi

grn "==> 5/6  Запускаю Xray..."
systemctl enable xray >/dev/null 2>&1 || true
systemctl restart xray
sleep 2
if ! systemctl is-active --quiet xray; then
  red "Xray не запустился. Логи:"
  journalctl -u xray --no-pager -n 30 || true
  exit 1
fi

grn "==> 6/6  Определяю IPv6 адрес..."
# EuServ — только IPv6
IP="$(curl -6 -fsSL --max-time 10 https://api6.ipify.org 2>/dev/null \
   || ip -6 addr show scope global | grep -oP '(?<=inet6 )[^/]+' | grep -v '^fe80' | head -1 \
   || echo 'ВАШ_IPv6')"

# В vless-ссылке IPv6 заключается в квадратные скобки
IP_IN_URL="[${IP}]"

LINK="vless://${UUID}@${IP_IN_URL}:${PORT}?security=reality&encryption=none&flow=xtls-rprx-vision&type=tcp&sni=${SERVER_NAME}&fp=chrome&pbk=${PUB}&sid=${SHORT_ID}&spx=%2F#${LABEL}"

cat > /root/vpn-info.txt <<INFO
==== ДАННЫЕ VPN (СОХРАНИ!) ====
IPv6     : ${IP}
Порт     : ${PORT}
UUID     : ${UUID}
PublicKey: ${PUB}
ShortID  : ${SHORT_ID}
SNI      : ${SERVER_NAME}
================================

ССЫЛКА ДЛЯ HAPP:
${LINK}
INFO

echo
grn "============================================"
grn "  ГОТОВО! Xray запущен на порту ${PORT}"
grn "============================================"
echo
ylw "Ссылка для Happ (скопируй целиком):"
echo
echo "${LINK}"
echo
ylw "Данные сохранены: /root/vpn-info.txt"
echo
ylw "ВАЖНО: ежемесячно заходи в панель EuServ и нажимай Renew Contract (бесплатно)"
