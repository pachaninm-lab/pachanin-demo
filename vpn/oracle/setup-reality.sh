#!/usr/bin/env bash
#
# setup-reality.sh — автоматическая установка VLESS + Reality + Vision (Xray-core)
# для личного VPN-сервера в России (клиент: Happ).
#
# Что делает:
#   1. Ставит официальный Xray-core
#   2. Генерирует UUID, пару ключей Reality (x25519), shortId
#   3. Пишет конфиг VLESS + TCP + Reality + xtls-rprx-vision (порт 443)
#   4. Маскируется под настоящий сайт (по умолчанию www.microsoft.com)
#   5. Открывает порт 443 в host-фаерволе (iptables)
#   6. Запускает Xray как systemd-сервис (автозапуск навсегда)
#   7. Печатает готовую ссылку vless:// для импорта в Happ
#
# Использование (на свежем Ubuntu 22.04/24.04 от root):
#   sudo bash setup-reality.sh
#
# Можно задать маскировочный сайт:
#   sudo DEST=dl.google.com bash setup-reality.sh
#
set -euo pipefail

# --- настройки ----------------------------------------------------------------
DEST="${DEST:-www.microsoft.com}"          # сайт-донор TLS-рукопожатия (TLS1.3 + H2)
SERVER_NAME="${SERVER_NAME:-$DEST}"        # SNI = тот же сайт
PORT="${PORT:-443}"
LABEL="${LABEL:-MY-VPN-FOREVER}"
# -----------------------------------------------------------------------------

red()  { printf '\033[31m%s\033[0m\n' "$*"; }
grn()  { printf '\033[32m%s\033[0m\n' "$*"; }
ylw()  { printf '\033[33m%s\033[0m\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then
  red "Запусти от root:  sudo bash setup-reality.sh"
  exit 1
fi

grn "==> 1/7  Обновляю пакеты и ставлю зависимости..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null 2>&1 || true
apt-get install -y curl unzip ca-certificates jq qrencode iptables >/dev/null 2>&1 || \
  apt-get install -y curl unzip ca-certificates jq iptables >/dev/null 2>&1

grn "==> 2/7  Ставлю Xray-core (официальный установщик)..."
bash -c "$(curl -fsSL https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install >/dev/null

XRAY_BIN="$(command -v xray || echo /usr/local/bin/xray)"
if [ ! -x "$XRAY_BIN" ]; then
  red "Xray не установился. Прерываю."
  exit 1
fi

grn "==> 3/7  Генерирую ключи и идентификаторы..."
UUID="$("$XRAY_BIN" uuid)"
KEYS="$("$XRAY_BIN" x25519)"
PRIV="$(echo "$KEYS" | awk '/Private/{print $NF}')"
PUB="$(echo  "$KEYS" | awk '/Public/{print $NF}')"
SHORT_ID="$(openssl rand -hex 8)"

grn "==> 4/7  Пишу конфиг /usr/local/etc/xray/config.json ..."
mkdir -p /usr/local/etc/xray
cat > /usr/local/etc/xray/config.json <<JSON
{
  "log": { "loglevel": "warning" },
  "inbounds": [
    {
      "listen": "0.0.0.0",
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

# Проверяем валидность конфига
if ! "$XRAY_BIN" run -test -config /usr/local/etc/xray/config.json >/dev/null 2>&1; then
  red "Конфиг не прошёл проверку Xray. Содержимое выше."
  "$XRAY_BIN" run -test -config /usr/local/etc/xray/config.json || true
  exit 1
fi

grn "==> 5/7  Открываю порт ${PORT} в host-фаерволе (iptables)..."
iptables -I INPUT -p tcp --dport "${PORT}" -j ACCEPT 2>/dev/null || true
# Сохраняем правила, если есть netfilter-persistent / iptables-save
if command -v netfilter-persistent >/dev/null 2>&1; then
  netfilter-persistent save >/dev/null 2>&1 || true
elif [ -d /etc/iptables ]; then
  iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
fi
# Если используется ufw — тоже открыть
if command -v ufw >/dev/null 2>&1; then
  ufw allow "${PORT}/tcp" >/dev/null 2>&1 || true
fi

grn "==> 6/7  Включаю автозапуск и стартую Xray..."
systemctl enable xray >/dev/null 2>&1 || true
systemctl restart xray
sleep 2
if ! systemctl is-active --quiet xray; then
  red "Xray не запустился. Логи:"
  journalctl -u xray --no-pager -n 30 || true
  exit 1
fi

grn "==> 7/7  Готово! Определяю внешний IP..."
IP="$(curl -fsSL --max-time 10 https://api.ipify.org || curl -fsSL --max-time 10 https://ifconfig.me || echo 'ВАШ_IP')"

LINK="vless://${UUID}@${IP}:${PORT}?security=reality&encryption=none&flow=xtls-rprx-vision&type=tcp&sni=${SERVER_NAME}&fp=chrome&pbk=${PUB}&sid=${SHORT_ID}&spx=%2F#${LABEL}"

# Сохраняем все данные на сервере для истории
cat > /root/vpn-reality-info.txt <<INFO
==== ДАННЫЕ ТВОЕГО VPN (СОХРАНИ!) ====
IP сервера : ${IP}
Порт       : ${PORT}
UUID       : ${UUID}
PublicKey  : ${PUB}
PrivateKey : ${PRIV}
ShortID    : ${SHORT_ID}
SNI / dest : ${SERVER_NAME}
Flow       : xtls-rprx-vision
======================================

ССЫЛКА ДЛЯ HAPP:
${LINK}
INFO

echo
grn "============================================================"
grn "  ГОТОВО. VPN РАБОТАЕТ. Сервер бесплатный навсегда."
grn "============================================================"
echo
ylw "Ссылка для импорта в Happ (скопируй целиком):"
echo
echo "${LINK}"
echo
if command -v qrencode >/dev/null 2>&1; then
  ylw "Или отсканируй QR-код камерой Happ:"
  qrencode -t ANSIUTF8 "${LINK}"
  echo
fi
ylw "Все данные сохранены в файле:  /root/vpn-reality-info.txt"
echo
grn "Дальше: открой Happ → '+' → вставь ссылку из буфера → подключись."
ylw "ВАЖНО: в облачной консоли Oracle открой Ingress-правило для порта ${PORT}/TCP"
ylw "(Networking → Virtual Cloud Network → твоя подсеть → Security List → Add Ingress)."
