#!/bin/bash
# Прозрачная Цена — одна команда деплой на Vercel
# Запускать с корня репо: bash deploy.sh

set -e

VERCEL_TOKEN="${VERCEL_TOKEN:-}"
if [ -z "$VERCEL_TOKEN" ]; then
  echo "❌ Укажите токен: VERCEL_TOKEN=vcp_... bash deploy.sh"
  exit 1
fi
PROJECT_NAME="pachanin-demo"

echo ""
echo "🚀 Прозрачная Цена — деплой на Vercel"
echo "======================================="

# Проверяем наличие Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js не установлен. Скачайте с https://nodejs.org"
  exit 1
fi

# Устанавливаем vercel CLI если нет
if ! command -v vercel &> /dev/null; then
  echo "📦 Устанавливаю Vercel CLI..."
  npm install -g vercel
fi

echo "📂 Переходим в apps/web..."
cd apps/web

echo "📦 Устанавливаем зависимости..."
npm install --legacy-peer-deps

echo "🔨 Билдим приложение..."
npm run build

echo ""
echo "🚀 Деплоим на Vercel..."
vercel deploy \
  --token="$VERCEL_TOKEN" \
  --name="$PROJECT_NAME" \
  --yes \
  --prod

echo ""
echo "✅ Готово! Ссылка выше — открывайте на iPhone."
echo "   Демо-страница: /demo"
