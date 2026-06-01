# Личный бесплатный прокси для обхода DPI (РФ) → Happ на iPhone

Полностью **бесплатный** и **только твой** сервер (никаких общих ключей).
Поднимает на одном VPS два протокола:

- **VLESS + Reality** (TCP/443) — максимальная стелс-устойчивость к DPI, маскируется под обычный HTTPS к реальному сайту.
- **Hysteria2** (UDP/8443) — на базе QUIC, поэтому **YouTube и видео работают плавно** даже на мобильном.

## Шаг 1. Бесплатный сервер навсегда — Oracle Cloud Always Free

1. Зарегистрируйся: <https://www.oracle.com/cloud/free/> (нужна карта только для верификации, деньги не списываются на Always Free).
2. При регистрации выбери **Home Region** поближе к РФ с хорошим пингом: **Frankfurt** или **Amsterdam**.
3. Создай инстанс **Compute → Instance**:
   - Image: **Ubuntu 24.04** (или 22.04)
   - Shape: **VM.Standard.A1.Flex** (ARM, Always Free: до 4 OCPU / 24 ГБ).
     Если «Out of capacity» — пробуй другой Availability Domain или возьми
     **VM.Standard.E2.1.Micro** (AMD, тоже Always Free, 1 ядро/1 ГБ — для прокси хватает).
   - Сохрани SSH-ключ (скачается приватный ключ).
4. **ВАЖНО — открой порты.** Oracle по умолчанию закрывает всё:
   - В разделе сети (VCN → Security List / Network Security Group) добавь **Ingress rules**:
     - TCP, порт **443** (для VLESS+Reality)
     - UDP, порт **8443** (для Hysteria2)
   - Source CIDR: `0.0.0.0/0`
   - (firewall на самом сервере скрипт настроит сам)

## Шаг 2. Установка одной командой

Подключись к серверу по SSH (IP виден в панели Oracle):

```bash
ssh -i путь/к/ключу ubuntu@ТВОЙ_IP
```

Скачай и запусти установщик:

```bash
curl -fsSLO https://raw.githubusercontent.com/pachaninm-lab/pachanin-demo/claude/xray-endpoint-happ-36Qc0/server/install-proxy.sh
sudo bash install-proxy.sh
```

Скрипт сам:
- поставит sing-box,
- сгенерит ключи Reality, UUID, пароль Hysteria2,
- настроит firewall,
- запустит сервис,
- **выведет 2 ссылки и QR-коды** для импорта в Happ.

## Шаг 3. Импорт в Happ

В Happ добавь **оба** сервера (по ссылке или QR):
- Основным держи **Hysteria2** — скорость и YouTube.
- **VLESS+Reality** — запасной, если где-то режут QUIC/UDP.

Проверь IP на <https://2ip.ru> — должен совпасть с IP сервера.

## Полезное

```bash
cat /etc/sing-box/client-links.txt   # показать ссылки снова
journalctl -u sing-box -f            # логи
systemctl restart sing-box           # перезапуск
```

### Настройка (необязательно)

Можно переопределить порты/домен-маскировку при установке:

```bash
sudo DEST_SNI=www.nvidia.com REALITY_PORT=443 HY2_PORT=8443 bash install-proxy.sh
```

`DEST_SNI` — реальный чужой сайт с TLS 1.3, **не заблокированный в РФ**
(подойдут `www.microsoft.com`, `www.nvidia.com`, `www.cloudflare.com`).
