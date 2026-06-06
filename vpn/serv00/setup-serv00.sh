#!/bin/sh
#
# setup-serv00.sh — sing-box VLESS+Reality на Serv00 (FreeBSD)
#
# Запускать после SSH-входа на Serv00:
#   sh setup-serv00.sh PORT
#
# PORT — твой назначенный TCP-порт (смотри в панели Serv00:
#   Additional functions → Port Manager → TCP Ports)
#
set -e

PORT="${1:-}"
if [ -z "$PORT" ]; then
  echo "Использование: sh setup-serv00.sh ПОРТ"
  echo "Пример:        sh setup-serv00.sh 12345"
  echo ""
  echo "Порт смотри в панели Serv00:"
  echo "  Additional functions → Port Manager"
  exit 1
fi

SNI="www.microsoft.com"
DEST="www.microsoft.com:443"
LABEL="Serv00-Reality"

echo "==> Определяю архитектуру..."
ARCH=$(uname -m)
case "$ARCH" in
  amd64|x86_64) GOARCH=amd64 ;;
  arm64|aarch64) GOARCH=arm64 ;;
  *) echo "Неизвестная архитектура: $ARCH"; exit 1 ;;
esac

echo "==> Скачиваю sing-box (FreeBSD)..."
VER=$(curl -fsSL https://api.github.com/repos/SagerNet/sing-box/releases/latest \
  | grep '"tag_name"' | sed 's/.*"v\([^"]*\)".*/\1/')
URL="https://github.com/SagerNet/sing-box/releases/download/v${VER}/sing-box-${VER}-freebsd-${GOARCH}.tar.gz"
curl -fsSL "$URL" -o /tmp/sb.tar.gz
mkdir -p /tmp/sb_extract
tar -xzf /tmp/sb.tar.gz -C /tmp/sb_extract
mkdir -p "$HOME/bin"
cp /tmp/sb_extract/sing-box-*/sing-box "$HOME/bin/sing-box"
chmod +x "$HOME/bin/sing-box"
rm -rf /tmp/sb.tar.gz /tmp/sb_extract

echo "==> Генерирую UUID, ключи Reality и ShortID..."
UUID=$("$HOME/bin/sing-box" generate uuid)
KEYS=$("$HOME/bin/sing-box" generate reality-keypair)
PRIV=$(echo "$KEYS" | grep -i 'PrivateKey' | awk '{print $NF}')
PUB=$(echo  "$KEYS" | grep -i 'PublicKey'  | awk '{print $NF}')
SHORT_ID=$(dd if=/dev/urandom bs=8 count=1 2>/dev/null | xxd -p | head -c 16)

echo "==> Пишу конфиг ~/singbox/config.json ..."
mkdir -p "$HOME/singbox"
cat > "$HOME/singbox/config.json" <<JSON
{
  "log": { "level": "warn" },
  "inbounds": [
    {
      "type": "vless",
      "listen": "0.0.0.0",
      "listen_port": ${PORT},
      "users": [
        { "uuid": "${UUID}", "flow": "xtls-rprx-vision" }
      ],
      "tls": {
        "enabled": true,
        "server_name": "${SNI}",
        "reality": {
          "enabled": true,
          "handshake": { "server": "${SNI}", "server_port": 443 },
          "private_key": "${PRIV}",
          "short_id": ["${SHORT_ID}"]
        }
      }
    }
  ],
  "outbounds": [
    { "type": "direct" }
  ]
}
JSON

echo "==> Проверяю конфиг..."
"$HOME/bin/sing-box" check -c "$HOME/singbox/config.json" && echo "Конфиг ОК"

echo "==> Запускаю sing-box в фоне..."
# Останавливаем старый процесс если был
pkill -f "sing-box run" 2>/dev/null || true
sleep 1
nohup "$HOME/bin/sing-box" run -c "$HOME/singbox/config.json" \
  > "$HOME/singbox/sing-box.log" 2>&1 &
echo $! > "$HOME/singbox/sing-box.pid"
sleep 2

if ! kill -0 "$(cat "$HOME/singbox/sing-box.pid")" 2>/dev/null; then
  echo "ОШИБКА: sing-box не запустился. Лог:"
  cat "$HOME/singbox/sing-box.log"
  exit 1
fi

IP=$(curl -fsSL https://api.ipify.org 2>/dev/null || curl -fsSL https://ifconfig.me 2>/dev/null || echo "ТВОЙ_IP")

LINK="vless://${UUID}@${IP}:${PORT}?security=reality&encryption=none&flow=xtls-rprx-vision&type=tcp&sni=${SNI}&fp=chrome&pbk=${PUB}&sid=${SHORT_ID}&spx=%2F#${LABEL}"

cat > "$HOME/singbox/vpn-info.txt" <<INFO
==== ДАННЫЕ VPN (СОХРАНИ!) ====
IP       : ${IP}
Порт     : ${PORT}
UUID     : ${UUID}
PublicKey: ${PUB}
ShortID  : ${SHORT_ID}
SNI      : ${SNI}
================================

ССЫЛКА ДЛЯ HAPP:
${LINK}
INFO

echo ""
echo "============================================"
echo "  ГОТОВО! sing-box запущен на порту ${PORT}"
echo "============================================"
echo ""
echo "Ссылка для Happ:"
echo ""
echo "${LINK}"
echo ""
echo "Все данные сохранены: ~/singbox/vpn-info.txt"
echo ""
echo "ВАЖНО: добавь sing-box в автозапуск через панель Serv00:"
echo "  Additional functions → Autostart → Add process"
echo "  Command: ${HOME}/bin/sing-box run -c ${HOME}/singbox/config.json"
