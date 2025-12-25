#!/bin/bash

# Тестовая транзакция Payme
# Следуем стандартному flow: CheckPerform → Create → Perform

set -e

PAYME_URL="https://wallet.namo.uz/api/payments/payme"
PAYME_KEY="dqVzYxH?NRx9k64&IphRcpUbur1VS25czMQN"
AUTH_HEADER="Authorization: Basic $(echo -n "Paycom:${PAYME_KEY}" | base64)"

ORDER_ID="12"
AMOUNT="500000"  # 5000 сум в тийинах
TRANSACTION_ID="test-$(date +%s)"

echo "=== ТЕСТ PAYME MERCHANT API ==="
echo "Order ID: $ORDER_ID"
echo "Amount: $AMOUNT тийин (5000 сум)"
echo "Transaction ID: $TRANSACTION_ID"
echo ""

# ============================================
# ШАГ 1: CheckPerformTransaction
# ============================================
echo "=== ШАГ 1: CheckPerformTransaction ==="
echo "Проверяем можно ли выполнить транзакцию..."
echo ""

RESPONSE_1=$(curl -s -X POST "$PAYME_URL" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d "{
    \"method\": \"CheckPerformTransaction\",
    \"params\": {
      \"amount\": $AMOUNT,
      \"account\": {
        \"order_id\": \"$ORDER_ID\"
      }
    },
    \"id\": 1
  }")

echo "Request:"
echo "{\"method\": \"CheckPerformTransaction\", \"params\": {\"amount\": $AMOUNT, \"account\": {\"order_id\": \"$ORDER_ID\"}}}"
echo ""
echo "Response:"
echo "$RESPONSE_1" | jq '.'
echo ""

# Проверка на ошибку
if echo "$RESPONSE_1" | jq -e '.error' > /dev/null; then
  echo "❌ ОШИБКА на шаге 1!"
  echo "$RESPONSE_1" | jq '.error'
  exit 1
fi

if echo "$RESPONSE_1" | jq -e '.result.allow == true' > /dev/null; then
  echo "✅ CheckPerformTransaction: allow = true"
else
  echo "❌ CheckPerformTransaction: allow НЕ true!"
  exit 1
fi

echo ""
sleep 2

# ============================================
# ШАГ 2: CreateTransaction
# ============================================
echo "=== ШАГ 2: CreateTransaction ==="
echo "Создаём транзакцию..."
echo ""

CURRENT_TIME=$(($(date +%s) * 1000))

RESPONSE_2=$(curl -s -X POST "$PAYME_URL" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d "{
    \"method\": \"CreateTransaction\",
    \"params\": {
      \"id\": \"$TRANSACTION_ID\",
      \"time\": $CURRENT_TIME,
      \"amount\": $AMOUNT,
      \"account\": {
        \"order_id\": \"$ORDER_ID\"
      }
    },
    \"id\": 2
  }")

echo "Request:"
echo "{\"method\": \"CreateTransaction\", \"params\": {\"id\": \"$TRANSACTION_ID\", \"amount\": $AMOUNT}}"
echo ""
echo "Response:"
echo "$RESPONSE_2" | jq '.'
echo ""

# Проверка на ошибку
if echo "$RESPONSE_2" | jq -e '.error' > /dev/null; then
  echo "❌ ОШИБКА на шаге 2!"
  echo "$RESPONSE_2" | jq '.error'
  exit 1
fi

if echo "$RESPONSE_2" | jq -e '.result.state == 1' > /dev/null; then
  echo "✅ CreateTransaction: state = 1 (создана)"
else
  echo "❌ CreateTransaction: state НЕ 1!"
  exit 1
fi

TRANSACTION_INTERNAL=$(echo "$RESPONSE_2" | jq -r '.result.transaction')
echo "Internal transaction ID: $TRANSACTION_INTERNAL"

echo ""
sleep 2

# ============================================
# ШАГ 3: PerformTransaction
# ============================================
echo "=== ШАГ 3: PerformTransaction ==="
echo "Выполняем транзакцию (списание)..."
echo ""

RESPONSE_3=$(curl -s -X POST "$PAYME_URL" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d "{
    \"method\": \"PerformTransaction\",
    \"params\": {
      \"id\": \"$TRANSACTION_ID\"
    },
    \"id\": 3
  }")

echo "Request:"
echo "{\"method\": \"PerformTransaction\", \"params\": {\"id\": \"$TRANSACTION_ID\"}}"
echo ""
echo "Response:"
echo "$RESPONSE_3" | jq '.'
echo ""

# Проверка на ошибку
if echo "$RESPONSE_3" | jq -e '.error' > /dev/null; then
  echo "❌ ОШИБКА на шаге 3!"
  echo "$RESPONSE_3" | jq '.error'
  exit 1
fi

if echo "$RESPONSE_3" | jq -e '.result.state == 2' > /dev/null; then
  echo "✅ PerformTransaction: state = 2 (оплачена)"
else
  echo "❌ PerformTransaction: state НЕ 2!"
  exit 1
fi

echo ""
echo "=== ТЕСТ УСПЕШНО ЗАВЕРШЁН! ==="
echo ""
echo "📊 Проверьте в базе данных:"
echo "docker exec -it activation-db psql -U tguser -d activation_system -c \"SELECT id, status, externalPaymentId FROM \\\"QrPaymentAttempt\\\" WHERE id = $ORDER_ID;\""
echo ""
echo "📊 Проверьте создалась ли продажа:"
echo "docker exec -it activation-db psql -U tguser -d activation_system -c \"SELECT * FROM \\\"Sale\\\" WHERE id = (SELECT saleId FROM \\\"QrPaymentAttempt\\\" WHERE id = $ORDER_ID);\""
