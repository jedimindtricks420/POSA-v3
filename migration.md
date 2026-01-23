# Инструкция по миграции и запуску POSA Activation System на новом сервере

Данный документ описывает пошаговый процесс переноса, настройки и запуска проекта POSA и сопутствующих сервисов (KeysPro) на новый сервер.

## 1. Подготовка сервера

### 1.1. Обновление и установка зависимостей
Перед началом работы убедитесь, что сервер обновлен и установлены необходимые утилиты:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl unzip docker.io docker-compose ufw
```

### 1.2. Настройка фаервола и портов (Azure/Server)
Убедитесь, что в Security Groups (Azure) или в `ufw` открыты следующие порты:
- **SSH**: 22
- **HTTP**: 80
- **HTTPS**: 443
- **Posgres/DB** (опционально, если нужен внешний доступ): 5432
- **Telegram Bot Webhook** (если используется): 8443 или 80/443 через Nginx

## 2. Клонирование репозиториев

Перейдите в домашнюю директорию и склонируйте репозиторий проекта POSA.

```bash
cd /home/admin1
git clone git@github.com:jedimindtricks420/POSA-v3.git posa
```

*Примечание: Если требуется SSH ключ для GitHub, сгенерируйте его (`ssh-keygen`) и добавьте в настройки аккаунта GitHub.*

Также убедитесь, что соседний проект `keyspro_auto_sender` находится на месте, так как он проверяется скриптом верификации.

```bash
cd /home/admin1
# Если проект KeysPro в отдельном репо:
# git clone <repo_url> keyspro_auto_sender
```

## 3. Миграция базы данных

В папке `activation-system` находится дамп базы данных `posa.sql`.

1.  **Подготовка тома данных**: Убедитесь, что контейнер с базой данным (`activation-db`) запущен (см. раздел 4).
2.  **Импорт дампа**:
    Если база пустая, импортируйте дамп:
    ```bash
    cat /home/admin1/posa/activation-system/posa.sql | docker exec -i activation-db psql -U admin -d activation_db
    ```

## 4. Настройка и запуск Docker контейнеров

### 4.1. POSA Activation System
Перейдите в папку системы активации:
```bash
cd /home/admin1/posa/activation-system
```

1.  **Конфигурация окружения**:
    Убедитесь, что файл `.env` существует и настроен корректно (подключение к БД, API ключи и т.д.).
    ```bash
    cp .env.example .env # Если есть пример
    nano .env
    ```

2.  **Запуск через Docker Compose**:
    ```bash
    docker-compose up -d --build
    ```

### 4.2. KeysPro Auto Sender
Перейдите в папку KeysPro:
```bash
cd /home/admin1/keyspro_auto_sender
```

1.  Настройте `.env`.
2.  Запустите контейнеры:
    ```bash
    docker-compose up -d --build
    ```

## 5. Настройка Nginx (Reverse Proxy)

Nginx используется для маршрутизации доменов (`namo.uz`, `api.namo.uz`, `webhook.keyspro.uz` и др.) на соответствующие порты контейнеров.

1.  Отредактируйте конфигурацию Nginx (обычно в `/etc/nginx/sites-available` или аналогично):
    ```nginx
    # Примерный блок для POSA
    server {
        server_name namo.uz api.namo.uz;
        location / {
            proxy_pass http://localhost:3000; # Порт приложения POSA
            # ... proxy headers
        }
    }
    ```
2.  Проверьте конфиг и перезапустите Nginx:
    ```bash
    sudo nginx -t
    sudo systemctl restart nginx
    ```

## 6. Верификация миграции

В корне проекта подготовлен скрипт для автоматической проверки статуса всех сервисов.

1.  Запустите скрипт проверки:
    ```bash
    cd /home/admin1/posa
    chmod +x verify_migration.sh
    ./verify_migration.sh
    ```

2.  **Ожидаемый результат**:
    - **Nginx**: ✅ RUNNING
    - **Docker Containers**:
        - `activation-system`: ✅ Found
        - `activation-db`: ✅ Found
        - `keyspro_auto_sender_key-distributor_1`: ✅ Found
    - **HTTP Responses**:
        - `namo.uz`: 200/301/302
        - `api.namo.uz`: 200/301/302
        - `webhook.keyspro.uz`: 200/301/302

## Чек-лист завершения
- [ ] DNS записи обновлены на IP нового сервера.
- [ ] SSL сертификаты (Let's Encrypt) сгенерированы/обновлены.
- [ ] База данных актуальна (все данные перенесены).
- [ ] Скрипт `verify_migration.sh` проходит без ошибок.
