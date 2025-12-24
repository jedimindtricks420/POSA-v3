# Frontend реализация

## Структура файлов

```
/home/admin1/posa/activation-system/views/pages/
├── admin-qr-links.ejs        # Админ: генерация QR
├── pay-product.ejs           # Клиент: страница товара
├── pay-checkout.ejs          # Клиент: форма оплаты
├── pay-result.ejs            # Клиент: чек
└── pay-error.ejs             # Клиент: ошибки
```

---

## 1. Админ-панель: Генерация QR

**Файл:** `views/pages/admin-qr-links.ejs`

```html
<!DOCTYPE html>
<html>
<head>
    <title>Генерация QR-кодов</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css" rel="stylesheet">
</head>
<body class="bg-gray-100">
    <%- include('../partials/admin-header') %>
    
    <div class="container mx-auto p-6">
        <h1 class="text-2xl font-bold mb-6">Генерация QR-кодов для оплаты</h1>
        
        <div class="bg-white rounded-lg shadow p-6">
            <!-- Выбор мерчанта -->
            <div class="mb-4">
                <label class="block text-sm font-medium mb-2">Мерчант</label>
                <select id="merchantSelect" class="w-full border rounded-lg p-3">
                    <option value="">Выберите мерчанта</option>
                    <% merchants.forEach(m => { %>
                        <option value="<%= m.id %>"><%= m.username %></option>
                    <% }); %>
                </select>
            </div>
            
            <!-- Выбор товара -->
            <div class="mb-4">
                <label class="block text-sm font-medium mb-2">Товар</label>
                <select id="productSelect" class="w-full border rounded-lg p-3">
                    <option value="">Выберите товар</option>
                    <% products.forEach(p => { %>
                        <option value="<%= p.id %>" data-price="<%= p.price %>" data-vendor="<%= p.vendor.name %>">
                            <%= p.name %> - <%= p.price.toLocaleString() %> сум
                        </option>
                    <% }); %>
                </select>
            </div>
            
            <button id="generateBtn" class="bg-blue-600 text-white px-6 py-3 rounded-lg disabled:opacity-50" disabled>
                Сгенерировать ссылку
            </button>
        </div>
        
        <!-- Результат -->
        <div id="result" class="bg-white rounded-lg shadow p-6 mt-6 hidden">
            <div class="flex items-start gap-6">
                <div>
                    <img id="qrImage" src="" alt="QR Code" class="w-48 h-48 border rounded">
                </div>
                <div class="flex-1">
                    <h3 id="productName" class="text-xl font-bold"></h3>
                    <p id="productPrice" class="text-2xl text-green-600 font-bold mb-2"></p>
                    <p id="merchantName" class="text-gray-600 mb-4"></p>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-1">Ссылка:</label>
                        <div class="flex gap-2">
                            <input id="linkUrl" type="text" readonly 
                                   class="flex-1 border rounded p-2 bg-gray-50">
                            <button onclick="copyLink()" class="bg-gray-200 px-4 py-2 rounded">
                                📋 Копировать
                            </button>
                        </div>
                    </div>
                    
                    <a id="downloadBtn" href="#" class="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">
                        ⬇️ Скачать QR (PNG)
                    </a>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        const merchantSelect = document.getElementById('merchantSelect');
        const productSelect = document.getElementById('productSelect');
        const generateBtn = document.getElementById('generateBtn');
        const resultDiv = document.getElementById('result');
        
        function updateGenerateBtn() {
            generateBtn.disabled = !merchantSelect.value || !productSelect.value;
        }
        
        merchantSelect.addEventListener('change', updateGenerateBtn);
        productSelect.addEventListener('change', updateGenerateBtn);
        
        generateBtn.addEventListener('click', async () => {
            generateBtn.disabled = true;
            generateBtn.textContent = 'Генерация...';
            
            try {
                const res = await fetch('/admin/qr-links/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        merchantId: merchantSelect.value,
                        productId: productSelect.value
                    })
                });
                
                const data = await res.json();
                
                if (data.success) {
                    document.getElementById('qrImage').src = data.link.qrCode;
                    document.getElementById('productName').textContent = data.link.product;
                    document.getElementById('productPrice').textContent = 
                        data.link.price.toLocaleString() + ' сум';
                    document.getElementById('merchantName').textContent = 
                        'Мерчант: ' + data.link.merchant;
                    document.getElementById('linkUrl').value = data.link.url;
                    document.getElementById('downloadBtn').href = 
                        '/admin/qr-links/' + data.link.id + '/download';
                    resultDiv.classList.remove('hidden');
                } else {
                    alert('Ошибка: ' + data.error);
                }
            } catch (e) {
                alert('Ошибка соединения');
            }
            
            generateBtn.disabled = false;
            generateBtn.textContent = 'Сгенерировать ссылку';
        });
        
        function copyLink() {
            const input = document.getElementById('linkUrl');
            input.select();
            document.execCommand('copy');
            alert('Ссылка скопирована!');
        }
    </script>
</body>
</html>
```

---

## 2. Страница товара

**Файл:** `views/pages/pay-product.ejs`

```html
<!DOCTYPE html>
<html>
<head>
    <title><%= product.name %></title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css" rel="stylesheet">
</head>
<body class="bg-gray-100 min-h-screen">
    <div class="max-w-md mx-auto p-4">
        <div class="bg-white rounded-2xl shadow-lg p-8 text-center">
            <!-- Логотип вендора -->
            <div class="w-24 h-24 mx-auto mb-6 bg-gray-200 rounded-full flex items-center justify-center">
                <span class="text-4xl">🎵</span>
            </div>
            
            <!-- Название товара -->
            <h1 class="text-2xl font-bold mb-2"><%= product.name %></h1>
            
            <hr class="my-4">
            
            <!-- Цена -->
            <p class="text-3xl font-bold text-green-600 mb-4">
                <%= product.price.toLocaleString() %> сум
            </p>
            
            <hr class="my-4">
            
            <!-- Кнопка -->
            <% if (hasVouchers) { %>
                <a href="/pay/<%= link.token %>/checkout" 
                   class="block w-full bg-blue-600 text-white py-4 rounded-xl text-xl font-bold hover:bg-blue-700">
                    КУПИТЬ
                </a>
            <% } else { %>
                <button disabled 
                        class="block w-full bg-gray-400 text-white py-4 rounded-xl text-xl font-bold cursor-not-allowed">
                    Товар временно недоступен
                </button>
            <% } %>
            
            <hr class="my-4">
            
            <!-- Продавец -->
            <p class="text-gray-500">
                Продавец: <strong><%= merchant.username %></strong>
            </p>
        </div>
    </div>
</body>
</html>
```

---

## 3. Страница checkout

**Файл:** `views/pages/pay-checkout.ejs`

```html
<!DOCTYPE html>
<html>
<head>
    <title>Оплата - <%= product.name %></title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css" rel="stylesheet">
</head>
<body class="bg-gray-100 min-h-screen">
    <div class="max-w-md mx-auto p-4">
        <div class="bg-white rounded-2xl shadow-lg p-6">
            <!-- Назад -->
            <a href="/pay/<%= token %>" class="text-blue-600 mb-4 inline-block">← Назад</a>
            
            <hr class="my-4">
            
            <!-- Товар -->
            <div class="text-center mb-4">
                <h2 class="text-xl font-bold"><%= product.name %></h2>
                <p class="text-2xl font-bold text-green-600">
                    <%= product.price.toLocaleString() %> сум
                </p>
            </div>
            
            <hr class="my-4">
            
            <!-- Форма -->
            <form id="checkoutForm">
                <!-- Телефон -->
                <div class="mb-4">
                    <label class="block text-sm font-medium mb-2">Номер телефона</label>
                    <div class="flex border rounded-lg overflow-hidden">
                        <span class="bg-gray-100 px-4 py-3 text-gray-600">+998</span>
                        <input type="tel" id="phone" 
                               placeholder="90 123 45 67"
                               class="flex-1 px-4 py-3 outline-none"
                               pattern="[0-9]{9}"
                               maxlength="9"
                               required>
                    </div>
                    <p class="text-sm text-gray-500 mt-1">На этот номер будет отправлен ваучер</p>
                </div>
                
                <hr class="my-4">
                
                <!-- Способ оплаты -->
                <div class="mb-4">
                    <label class="block text-sm font-medium mb-2">Способ оплаты</label>
                    <div class="grid grid-cols-2 gap-4">
                        <label class="border rounded-lg p-4 text-center cursor-pointer hover:border-blue-500">
                            <input type="radio" name="paymentMethod" value="click" class="sr-only" checked>
                            <div class="text-2xl mb-1">💳</div>
                            <div class="font-bold">Click</div>
                        </label>
                        <label class="border rounded-lg p-4 text-center cursor-pointer hover:border-blue-500">
                            <input type="radio" name="paymentMethod" value="payme" class="sr-only">
                            <div class="text-2xl mb-1">💳</div>
                            <div class="font-bold">Payme</div>
                        </label>
                    </div>
                </div>
                
                <hr class="my-4">
                
                <!-- Итого -->
                <div class="flex justify-between items-center mb-4">
                    <span class="text-gray-600">Итого к оплате:</span>
                    <span class="text-xl font-bold"><%= product.price.toLocaleString() %> сум</span>
                </div>
                
                <!-- Кнопка -->
                <button type="submit" id="submitBtn"
                        class="w-full bg-green-600 text-white py-4 rounded-xl text-xl font-bold hover:bg-green-700">
                    ОПЛАТИТЬ <%= product.price.toLocaleString() %> сум
                </button>
                
                <p class="text-xs text-gray-500 text-center mt-4">
                    Нажимая "Оплатить", вы соглашаетесь с условиями оферты
                </p>
            </form>
            
            <!-- Загрузка -->
            <div id="loading" class="hidden text-center py-8">
                <div class="text-4xl mb-4">⏳</div>
                <p class="text-xl">Обработка платежа...</p>
                <p class="text-gray-500">Пожалуйста, не закрывайте страницу</p>
            </div>
        </div>
    </div>
    
    <script>
        const form = document.getElementById('checkoutForm');
        const loading = document.getElementById('loading');
        const submitBtn = document.getElementById('submitBtn');
        
        // Подсветка выбранного способа оплаты
        document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
            radio.addEventListener('change', () => {
                document.querySelectorAll('input[name="paymentMethod"]').forEach(r => {
                    r.closest('label').classList.remove('border-blue-500', 'bg-blue-50');
                });
                radio.closest('label').classList.add('border-blue-500', 'bg-blue-50');
            });
        });
        // Активировать первый по умолчанию
        document.querySelector('input[name="paymentMethod"]:checked')
            .closest('label').classList.add('border-blue-500', 'bg-blue-50');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const phone = document.getElementById('phone').value.replace(/\s/g, '');
            if (phone.length !== 9) {
                alert('Введите 9 цифр номера телефона');
                return;
            }
            
            form.classList.add('hidden');
            loading.classList.remove('hidden');
            
            try {
                const res = await fetch('/pay/<%= token %>/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phoneNumber: '+998' + phone,
                        paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value
                    })
                });
                
                const data = await res.json();
                
                if (data.success && data.redirectUrl) {
                    window.location.href = data.redirectUrl;
                } else {
                    alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
                    form.classList.remove('hidden');
                    loading.classList.add('hidden');
                }
            } catch (e) {
                alert('Ошибка соединения');
                form.classList.remove('hidden');
                loading.classList.add('hidden');
            }
        });
    </script>
</body>
</html>
```

---

## 4. Страница результата (чек)

**Файл:** `views/pages/pay-result.ejs`

```html
<!DOCTYPE html>
<html>
<head>
    <title>Оплата успешна!</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css" rel="stylesheet">
</head>
<body class="bg-gray-100 min-h-screen py-4">
    <div class="max-w-md mx-auto p-4">
        <div class="bg-white rounded-2xl shadow-lg p-6">
            <!-- Успех -->
            <div class="text-center mb-4">
                <div class="text-6xl mb-2">✅</div>
                <h1 class="text-2xl font-bold text-green-600">Оплата успешна!</h1>
            </div>
            
            <!-- Чек -->
            <div class="border-2 border-dashed rounded-lg p-4">
                <h2 class="text-center font-bold text-lg mb-4">ЭЛЕКТРОННЫЙ ЧЕК</h2>
                
                <hr class="my-3">
                
                <!-- Продавец -->
                <div class="mb-3">
                    <p class="text-sm text-gray-500">Продавец</p>
                    <p class="font-bold"><%= merchant.username %></p>
                    <p class="text-sm text-gray-600"><%= merchant.legalInfo %></p>
                </div>
                
                <hr class="my-3">
                
                <!-- Товар -->
                <div class="flex justify-between mb-1">
                    <span>Товар</span>
                    <span class="font-medium"><%= product.name %></span>
                </div>
                <div class="flex justify-between mb-1">
                    <span>Количество</span>
                    <span>1 шт</span>
                </div>
                <div class="flex justify-between">
                    <span>Цена</span>
                    <span><%= product.price.toLocaleString() %> сум</span>
                </div>
                
                <hr class="my-3">
                
                <div class="flex justify-between text-lg font-bold">
                    <span>ИТОГО</span>
                    <span><%= product.price.toLocaleString() %> сум</span>
                </div>
                
                <hr class="my-3">
                
                <!-- Детали -->
                <div class="text-sm text-gray-600">
                    <div class="flex justify-between">
                        <span>Дата</span>
                        <span><%= new Date(attempt.paidAt).toLocaleDateString('ru-RU') %></span>
                    </div>
                    <div class="flex justify-between">
                        <span>Время</span>
                        <span><%= new Date(attempt.paidAt).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'}) %></span>
                    </div>
                    <div class="flex justify-between">
                        <span>Номер продажи</span>
                        <span>#<%= sale.id %></span>
                    </div>
                    <div class="flex justify-between">
                        <span>Покупатель</span>
                        <span><%= attempt.phoneNumber %></span>
                    </div>
                </div>
                
                <hr class="my-3">
                
                <!-- Код ваучера -->
                <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <p class="text-sm text-gray-600 mb-1">КОД ВАШЕГО ВАУЧЕРА</p>
                    <p class="text-2xl font-mono font-bold text-green-700 tracking-wider">
                        <%= voucherCode %>
                    </p>
                </div>
            </div>
            
            <!-- Кнопки -->
            <div class="mt-6 space-y-3">
                <a href="/pay/<%= token %>/receipt/<%= attempt.id %>" 
                   class="block w-full bg-blue-600 text-white py-3 rounded-xl text-center font-bold">
                    📥 СОХРАНИТЬ ЧЕК (PDF)
                </a>
                
                <a href="/client/dashboard" 
                   class="block w-full bg-gray-200 text-gray-800 py-3 rounded-xl text-center font-bold">
                    📱 ОТКРЫТЬ КОШЕЛЁК
                </a>
            </div>
            
            <!-- Инструкция -->
            <div class="mt-6 text-sm text-gray-600">
                <p class="font-medium mb-2">Как использовать ваучер?</p>
                <ol class="list-decimal list-inside space-y-1">
                    <li>Откройте кошелёк wallet.namo.uz</li>
                    <li>Войдите по номеру телефона</li>
                    <li>Найдите ваучер в списке</li>
                    <li>Нажмите "Активировать"</li>
                </ol>
            </div>
        </div>
    </div>
</body>
</html>
```

---

## 5. Страница ошибки

**Файл:** `views/pages/pay-error.ejs`

```html
<!DOCTYPE html>
<html>
<head>
    <title>Ошибка</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css" rel="stylesheet">
</head>
<body class="bg-gray-100 min-h-screen flex items-center justify-center p-4">
    <div class="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <% if (error === 'expired') { %>
            <div class="text-6xl mb-4">⏰</div>
            <h1 class="text-2xl font-bold text-orange-600 mb-2">Время оплаты истекло</h1>
            <p class="text-gray-600 mb-6">
                У вас было 2 минуты для завершения оплаты.<br>
                Пожалуйста, попробуйте снова.
            </p>
        <% } else if (error === 'failed') { %>
            <div class="text-6xl mb-4">❌</div>
            <h1 class="text-2xl font-bold text-red-600 mb-2">Оплата не прошла</h1>
            <p class="text-gray-600 mb-6">
                Платёж был отклонён. Проверьте баланс карты<br>
                или попробуйте другой способ оплаты.
            </p>
        <% } else if (error === 'no_vouchers') { %>
            <div class="text-6xl mb-4">😔</div>
            <h1 class="text-2xl font-bold text-gray-600 mb-2">Товар закончился</h1>
            <p class="text-gray-600 mb-6">
                К сожалению, пока вы оплачивали,<br>
                последний ваучер был куплен.<br><br>
                Ваши средства не были списаны.
            </p>
        <% } else { %>
            <div class="text-6xl mb-4">❌</div>
            <h1 class="text-2xl font-bold text-red-600 mb-2"><%= message %></h1>
        <% } %>
        
        <% if (typeof token !== 'undefined') { %>
            <a href="/pay/<%= token %>" 
               class="inline-block bg-blue-600 text-white px-8 py-3 rounded-xl font-bold">
                Попробовать снова
            </a>
        <% } %>
    </div>
</body>
</html>
```

---

## Чеклист

- [ ] admin-qr-links.ejs создан
- [ ] pay-product.ejs создан
- [ ] pay-checkout.ejs создан  
- [ ] pay-result.ejs создан
- [ ] pay-error.ejs создан
- [ ] Стили работают (TailwindCSS CDN)
- [ ] Мобильная адаптация проверена
