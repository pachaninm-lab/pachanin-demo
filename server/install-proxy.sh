#!/usr/bin/env bash
#
# install-proxy.sh — личный прокси для обхода DPI (РФ), под Happ на iPhone.
#
# Ставит sing-box и поднимает ДВА входа на одном сервере:
#   1) VLESS + Reality (TCP/443)  — максимальная стелс-устойчивость к DPI
#   2) Hysteria2       (UDP/8443) — QUIC, для YouTube/видео летает на мобильных
#
# Назначение: бесплатный VPS (например Oracle Cloud Always Free), Ubuntu 22.04/24.04.
# Запуск:  sudo bash install-proxy.sh
#
# По завершении выводит две ссылки (vless:// и hysteria2://) — импортируй обе в Happ.
#
set -euo pipefail

# ── Параметры (можно переопределить переменными окружения) ──────────────────
REALITY_PORT="${REALITY_PORT:-443}"        # порт VLESS+Reality (TCP)
HY2_PORT="${HY2_PORT:-8443}"               # порт Hysteria2 (UDP)
# Домен-маскировка для Reality: реальный чужой сайт с TLS 1.3, НЕ заблокированный в РФ.
DEST_SNI="${DEST_SNI:-www.microsoft.com}"
CONF_DIR="/etc/sing-box"

if [[ $EUID -ne 0 ]]; then
  echo "Запусти от root:  sudo bash $0" >&2
  exit 1
fi

echo "==> Обновляю систему и ставлю зависимости"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl openssl ca-certificates qrencode jq ufw

echo "==> Ставлю sing-box (официальный установщик)"
bash <(curl -fsSL https://sing-box.app/install.sh)

echo "==> Генерирую ключи и идентификаторы"
UUID="$(sing-box generate uuid)"
KEYS="$(sing-box generate reality-keypair)"
PRIV_KEY="$(echo "$KEYS" | awk '/PrivateKey/ {print $2}')"
PUB_KEY="$(echo "$KEYS"  | awk '/PublicKey/  {print $2}')"
SHORT_ID="$(openssl rand -hex 8)"
HY2_PASS="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"

# Внешний IPv4 сервера
SERVER_IP="$(curl -fsS4 --max-time 10 https://api.ipify.org || curl -fsS4 --max-time 10 ifconfig.me)"
if [[ -z "${SERVER_IP:-}" ]]; then
  echo "Не удалось определить внешний IP. Задай вручную: SERVER_IP=1.2.3.4 sudo bash $0" >&2
  exit 1
fi

echo "==> Готовлю самоподписанный сертификат для Hysteria2"
mkdir -p "$CONF_DIR"
openssl ecparam -genkey -name prime256v1 -out "$CONF_DIR/key.pem"
openssl req -new -x509 -days 3650 -key "$CONF_DIR/key.pem" \
  -out "$CONF_DIR/cert.pem" -subj "/CN=$DEST_SNI"
chmod 600 "$CONF_DIR/key.pem"

echo "==> Пишу конфиг sing-box"
cat > "$CONF_DIR/config.json" <<JSON
{
  "log": { "level": "warn", "timestamp": true },
  "inbounds": [
    {
      "type": "vless",
      "tag": "vless-reality",
      "listen": "::",
      "listen_port": $REALITY_PORT,
      "users": [ { "uuid": "$UUID", "flow": "xtls-rprx-vision" } ],
      "tls": {
        "enabled": true,
        "server_name": "$DEST_SNI",
        "reality": {
          "enabled": true,
          "handshake": { "server": "$DEST_SNI", "server_port": 443 },
          "private_key": "$PRIV_KEY",
          "short_id": [ "$SHORT_ID" ]
        }
      }
    },
    {
      "type": "hysteria2",
      "tag": "hy2",
      "listen": "::",
      "listen_port": $HY2_PORT,
      "users": [ { "password": "$HY2_PASS" } ],
      "tls": {
        "enabled": true,
        "alpn": [ "h3" ],
        "certificate_path": "$CONF_DIR/cert.pem",
        "key_path": "$CONF_DIR/key.pem"
      }
    }
  ],
  "outbounds": [ { "type": "direct", "tag": "direct" } ]
}
JSON

echo "==> Проверяю конфиг"
sing-box check -c "$CONF_DIR/config.json"

echo "==> Открываю порты в firewall (ufw)"
ufw allow 22/tcp || true
ufw allow "${REALITY_PORT}/tcp" || true
ufw allow "${HY2_PORT}/udp" || true
yes | ufw enable || true

echo "==> Запускаю сервис"
systemctl enable sing-box
systemctl restart sing-box
sleep 2
systemctl --no-pager --full status sing-box | head -n 8 || true

# ── Сборка клиентских ссылок ────────────────────────────────────────────────
VLESS_URL="vless://${UUID}@${SERVER_IP}:${REALITY_PORT}?encryption=none&flow=xtls-rprx-vision&security=reality&sni=${DEST_SNI}&fp=chrome&pbk=${PUB_KEY}&sid=${SHORT_ID}&type=tcp&headerType=none#MyReality"
HY2_URL="hysteria2://${HY2_PASS}@${SERVER_IP}:${HY2_PORT}?insecure=1&sni=${DEST_SNI}#MyHysteria2"

# Сохраняем для повторного просмотра
cat > "$CONF_DIR/client-links.txt" <<TXT
$VLESS_URL

$HY2_URL
TXT

cat <<BANNER

============================================================
  ГОТОВО. Импортируй в Happ ОБЕ ссылки (каждую как сервер):
============================================================

[1] VLESS + Reality (основной, стелс):

$VLESS_URL

[2] Hysteria2 (для YouTube/видео, QUIC):

$HY2_URL

------------------------------------------------------------
Эти ссылки также сохранены в: $CONF_DIR/client-links.txt
QR-коды:
BANNER

echo
echo ">>> QR для VLESS+Reality:"
qrencode -t ANSIUTF8 "$VLESS_URL"
echo
echo ">>> QR для Hysteria2:"
qrencode -t ANSIUTF8 "$HY2_URL"

cat <<TIPS

------------------------------------------------------------
Подсказки:
 - В Happ добавь оба сервера; основным держи Hysteria2 для скорости,
   а VLESS+Reality — как запасной, если QUIC где-то режут.
 - На сервере держи время автоматическим (Reality чувствителен к часам).
 - Логи:        journalctl -u sing-box -f
 - Перезапуск:  systemctl restart sing-box
 - Показать ссылки снова:  cat $CONF_DIR/client-links.txt
------------------------------------------------------------
TIPS
