# Инструкция по деплою на Timeweb

## Подготовка к деплою

### 1. Подключение к серверу Timeweb

Если у вас VPS/VDS:
```bash
ssh root@ваш-ip-адрес
```

Если у вас облачный хостинг, используйте панель управления Timeweb для доступа к серверу.

### 2. Установка необходимого ПО на сервере

```bash
# Обновление системы
apt update && apt upgrade -y

# Установка Python 3.11+ и pip
apt install -y python3 python3-pip python3-venv nginx supervisor

# Проверка версии Python (должна быть 3.11+)
python3 --version
```

### 3. Подготовка проекта на сервере

```bash
# Создаем директорию для проекта
mkdir -p /var/www/consultations
cd /var/www/consultations

# Загружаем файлы проекта (через git, scp или через панель Timeweb)
# Если используете git:
git clone https://ваш-репозиторий.git .

# Или загрузите файлы через SFTP/SCP с вашего компьютера:
# scp -r /Users/tagirminnakhmetov/НК/* root@ваш-ip:/var/www/consultations/
```

### 4. Настройка виртуального окружения

```bash
cd /var/www/consultations

# Создаем виртуальное окружение
python3 -m venv .venv

# Активируем его
source .venv/bin/activate

# Устанавливаем зависимости
pip install --upgrade pip
pip install -r requirements.txt
```

### 5. Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```bash
nano /var/www/consultations/.env
```

Добавьте следующие переменные (измените значения на свои):

```env
DATABASE_URL=sqlite:///./data/consultations.db
ADMIN_TOKEN=ваш-секретный-пароль-админа
EXPERT_TOKEN=ваш-секретный-пароль-эксперта
CORS_ORIGINS=*
```

**Важно:** Используйте сложные пароли для `ADMIN_TOKEN` и `EXPERT_TOKEN` в продакшене!

### 6. Создание директории для базы данных

```bash
mkdir -p /var/www/consultations/data
chmod 755 /var/www/consultations/data
```

### 7. Настройка systemd service для запуска приложения

Создайте файл сервиса:

```bash
nano /etc/systemd/system/consultations.service
```

Добавьте следующее содержимое:

```ini
[Unit]
Description=Consultation Booking Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/consultations
Environment="PATH=/var/www/consultations/.venv/bin"
ExecStart=/var/www/consultations/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Примечание:** Если используете другой порт или хотите запускать через gunicorn, измените `ExecStart`.

Альтернатива с gunicorn (рекомендуется для продакшена):

```bash
# Установите gunicorn
pip install gunicorn

# Измените ExecStart в service файле:
ExecStart=/var/www/consultations/.venv/bin/gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### 8. Запуск сервиса

```bash
# Перезагружаем systemd
systemctl daemon-reload

# Включаем автозапуск
systemctl enable consultations

# Запускаем сервис
systemctl start consultations

# Проверяем статус
systemctl status consultations

# Просмотр логов
journalctl -u consultations -f
```

### 9. Настройка Nginx как reverse proxy

Создайте конфигурационный файл Nginx:

```bash
nano /etc/nginx/sites-available/consultations
```

Добавьте следующее:

```nginx
server {
    listen 80;
    server_name ваш-домен.ru www.ваш-домен.ru;

    # Логи
    access_log /var/log/nginx/consultations_access.log;
    error_log /var/log/nginx/consultations_error.log;

    # Максимальный размер загружаемых файлов
    client_max_body_size 10M;

    # Проксирование на FastAPI
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }

    # Кэширование статических файлов (опционально)
    location /static/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_cache_valid 200 1h;
        add_header Cache-Control "public, immutable";
    }
}
```

Активируйте конфигурацию:

```bash
# Создаем символическую ссылку
ln -s /etc/nginx/sites-available/consultations /etc/nginx/sites-enabled/

# Проверяем конфигурацию
nginx -t

# Перезагружаем Nginx
systemctl reload nginx
```

### 10. Настройка SSL (HTTPS) через Let's Encrypt

```bash
# Установка certbot
apt install -y certbot python3-certbot-nginx

# Получение SSL сертификата
certbot --nginx -d ваш-домен.ru -d www.ваш-домен.ru

# Автоматическое обновление сертификата
certbot renew --dry-run
```

После этого Nginx автоматически обновится с HTTPS конфигурацией.

### 11. Настройка файрвола (если используется)

```bash
# Разрешаем HTTP и HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Разрешаем SSH (если еще не разрешен)
ufw allow 22/tcp

# Включаем файрвол
ufw enable
```

### 12. Проверка работы

1. Откройте в браузере: `http://ваш-домен.ru` или `https://ваш-домен.ru`
2. Проверьте все страницы:
   - Главная страница
   - `/student` - страница студентов
   - `/expert/login` - вход эксперта
   - `/admin/login` - вход администратора

### 13. Полезные команды для управления

```bash
# Перезапуск приложения
systemctl restart consultations

# Просмотр логов приложения
journalctl -u consultations -n 50

# Просмотр логов Nginx
tail -f /var/log/nginx/consultations_error.log

# Проверка статуса сервисов
systemctl status consultations
systemctl status nginx

# Обновление кода (после загрузки новых файлов)
cd /var/www/consultations
source .venv/bin/activate
pip install -r requirements.txt
systemctl restart consultations
```

## Альтернативный вариант: Docker (если поддерживается)

Если Timeweb поддерживает Docker, можно использовать Dockerfile:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Резервное копирование

Настройте регулярное резервное копирование базы данных:

```bash
# Создайте скрипт для бэкапа
nano /usr/local/bin/backup-consultations.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/consultations"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
cp /var/www/consultations/data/consultations.db $BACKUP_DIR/consultations_$DATE.db
# Удаляем старые бэкапы (старше 30 дней)
find $BACKUP_DIR -name "consultations_*.db" -mtime +30 -delete
```

```bash
chmod +x /usr/local/bin/backup-consultations.sh

# Добавьте в crontab для ежедневного бэкапа
crontab -e
# Добавьте строку:
0 2 * * * /usr/local/bin/backup-consultations.sh
```

## Решение проблем

### Приложение не запускается
```bash
# Проверьте логи
journalctl -u consultations -n 100

# Проверьте права доступа
chown -R www-data:www-data /var/www/consultations
chmod -R 755 /var/www/consultations
```

### Nginx возвращает 502 Bad Gateway
- Проверьте, что приложение запущено: `systemctl status consultations`
- Проверьте порт в конфигурации Nginx и приложения
- Проверьте логи: `tail -f /var/log/nginx/consultations_error.log`

### Проблемы с базой данных
- Проверьте права на директорию `data/`
- Убедитесь, что путь к базе правильный в `.env`

## Контакты поддержки Timeweb

Если возникнут проблемы с сервером, обратитесь в поддержку Timeweb через панель управления или по телефону.

## Временный доступ к локальному серверу (для тестирования)

Если нужно временно поделиться `localhost:8000` с внешними пользователями для тестирования, можно использовать туннелинг:

### Вариант 1: Ngrok (самый простой)

1. Установите ngrok: https://ngrok.com/download
2. Запустите ваше приложение локально:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
3. В другом терминале запустите ngrok:
   ```bash
   ngrok http 8000
   ```
4. Ngrok выдаст вам публичный URL вида `https://xxxx-xx-xx-xx-xx.ngrok-free.app`
5. Поделитесь этим URL с другими людьми

**Важно:** 
- Бесплатная версия ngrok имеет ограничения (временные URL, лимиты трафика)
- URL меняется при каждом перезапуске (в платной версии можно зафиксировать)
- Не используйте для продакшена, только для тестирования

### Вариант 2: Cloudflare Tunnel (бесплатно, более стабильно)

1. Установите cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
2. Запустите туннель:
   ```bash
   cloudflared tunnel --url http://localhost:8000
   ```
3. Получите публичный URL и поделитесь им

### Вариант 3: LocalTunnel

```bash
npm install -g localtunnel
lt --port 8000
```

**Рекомендация:** Для постоянного доступа лучше задеплоить на сервер Timeweb по инструкции выше.

