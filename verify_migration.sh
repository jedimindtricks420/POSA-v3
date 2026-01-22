#!/bin/bash

echo "=========================================="
echo "   MIGRATION VERIFICATION CHECKLIST"
echo "=========================================="
echo ""

# 1. Проверка Nginx
echo "[1] Checking Nginx Status..."
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx is RUNNING"
else
    echo "❌ Nginx is NOT running!"
fi

# 2. Проверка Docker Контейнеров
echo ""
echo "[2] Checking Docker Containers..."
CHECK_CONTAINERS=("activation-system" "activation-db" "keyspro_auto_sender_key-distributor_1" "activation-system")

for container in "${CHECK_CONTAINERS[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "$container"; then
        echo "✅ Container '$container' found and running"
    else
        echo "⚠️  Container '$container' NOT found (Check if name is correct)"
    fi
done

# 3. Проверка Локального Ответа (HTTP)
echo ""
echo "[3] Checking Local HTTP Response (curl localhost)..."

# Функция для проверки URL
check_url() {
    url=$1
    name=$2
    # Используем -H "Host: ..." чтобы проверить конкретный домен локально
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --resolve $name:80:127.0.0.1 http://$name)
    
    if [ "$http_code" == "200" ] || [ "$http_code" == "301" ] || [ "$http_code" == "302" ]; then
        echo "✅ $name responded with HTTP $http_code"
    else
        echo "❌ $name failed (HTTP $http_code)"
    fi
}

check_url "namo.uz" "POSA (namo.uz)"
check_url "api.namo.uz" "POSA API"
check_url "webhook.keyspro.uz" "KeysPro"
check_url "b2b.roomsget.com" "RoomsGet"

echo ""
echo "=========================================="
echo "   VERIFICATION COMPLETE"
echo "=========================================="
