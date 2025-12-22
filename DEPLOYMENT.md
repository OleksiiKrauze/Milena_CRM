# Развертывание MilenaCRM на AWS EC2

Полная инструкция по развертыванию MilenaCRM на AWS EC2 с HTTPS, автоматическими бэкапами и SSL сертификатами.

## Содержание

1. [Архитектура Production окружения](#архитектура-production-окружения)
2. [Подготовка AWS инфраструктуры](#подготовка-aws-инфраструктуры)
3. [Первоначальное развертывание](#первоначальное-развертывание)
4. [Обновление приложения](#обновление-приложения)
5. [Важные нюансы и решения проблем](#важные-нюансы-и-решения-проблем)
6. [Мониторинг и обслуживание](#мониторинг-и-обслуживание)

---

## Архитектура Production окружения

### Компоненты

```
Internet → DNS (crm.przmilena.click) → Elastic IP → EC2 Instance
    └─ Docker Compose:
        ├─ Nginx (HTTPS termination, reverse proxy, static files)
        │   ├─ Port 80 → 443 redirect
        │   ├─ Port 443 → HTTPS
        │   ├─ /api/* → backend:8000
        │   ├─ /uploads/* → shared volume
        │   └─ /* → frontend static files
        │
        ├─ Backend (FastAPI)
        │   ├─ Internal port 8000
        │   ├─ No hot-reload
        │   └─ Production secrets from .env.production
        │
        └─ PostgreSQL 16
            ├─ Internal port 5432
            └─ Persistent volume

Cron Jobs:
    ├─ 02:00 daily → Database backup
    └─ 03:00 daily → SSL certificate renewal
```

### Ключевые файлы

- **docker-compose.prod.yml** - production конфигурация Docker Compose
- **.env.production** - production переменные окружения (НЕ коммитить в Git!)
- **frontend/.env.production** - переменные для сборки фронтенда
- **nginx/nginx.conf** - конфигурация Nginx с HTTPS и reverse proxy
- **backend/Dockerfile.prod** - production Dockerfile для backend
- **scripts/backup-db.sh** - скрипт автоматического бэкапа БД
- **scripts/generate-secrets.sh** - генерация секретов для production

---

## Подготовка AWS инфраструктуры

### 1. Создание EC2 Instance

**Параметры:**
- AMI: Ubuntu Server 22.04 LTS
- Instance type: t3.small (2 vCPU, 2 GB RAM)
- Region: eu-central-1 (Frankfurt)
- Storage: 30 GB gp3 root volume + 20 GB gp3 data volume

**Security Group:**
```
SSH (22): My IP only
HTTP (80): 0.0.0.0/0
HTTPS (443): 0.0.0.0/0
```

**User Data** (автоустановка Docker):
```bash
#!/bin/bash
apt-get update && apt-get upgrade -y
curl -fsSL https://get.docker.com | sh
usermod -aG docker ubuntu
curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
apt-get install -y git curl wget htop
```

### 2. Elastic IP

1. Allocate Elastic IP в регионе
2. Associate с EC2 instance
3. Записать IP адрес для DNS настройки

### 3. DNS настройка

Создать A-запись в DNS (Route 53, Cloudflare и т.д.):
```
Type: A
Name: crm.przmilena.click
Value: <Elastic IP>
TTL: 300
```

Проверить DNS:
```bash
nslookup crm.przmilena.click
dig crm.przmilena.click +short
```

### 4. Подключение к серверу

```bash
ssh -i your-key.pem ubuntu@<ELASTIC_IP>
```

Если ошибка прав на ключ:
- **Linux/Mac:** `chmod 400 your-key.pem`
- **Windows:** `icacls your-key.pem /inheritance:r /grant:r "%USERNAME%:R"`

---

## Первоначальное развертывание

### Шаг 1: Установка дополнительного ПО

```bash
# Node.js 20 для сборки фронтенда
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20

# Certbot для Let's Encrypt
sudo apt-get update
sudo apt-get install -y certbot
```

### Шаг 2: Клонирование проекта

```bash
cd ~
git clone https://github.com/your-org/MilenaCRM.git
cd MilenaCRM
```

### Шаг 3: Настройка .env.production

Сгенерировать секреты:
```bash
# JWT Secret (64 символа hex)
openssl rand -hex 32

# PostgreSQL Password (32 символа)
openssl rand -base64 24 | tr -d "=+/" | cut -c1-32
```

Создать `.env.production`:
```bash
nano .env.production
```

Содержимое:
```env
# PostgreSQL Configuration
POSTGRES_DB=crm_production
POSTGRES_USER=crm_user_prod
POSTGRES_PASSWORD=<СГЕНЕРИРОВАННЫЙ_ПАРОЛЬ>
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Application Configuration
APP_PORT=8000

# JWT Configuration
JWT_SECRET_KEY=<СГЕНЕРИРОВАННЫЙ_SECRET>

# CORS Configuration
CORS_ORIGINS=https://crm.przmilena.click

# Logging
LOG_LEVEL=INFO

# OpenAI API Key for case autofill functionality
# Get your key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-your-openai-api-key-here
```

Установить права:
```bash
chmod 600 .env.production
```

### Шаг 4: Обновление nginx.conf

Заменить домен в nginx.conf:
```bash
sed -i 's/server_name crm.example.com;/server_name crm.przmilena.click;/g' nginx/nginx.conf
```

### Шаг 5: Создание .env.production для фронтенда

```bash
echo "VITE_API_URL=/api" > frontend/.env.production
```

**КРИТИЧЕСКИ ВАЖНО:** Без этого файла фронтенд будет использовать `http://localhost:8000` для API запросов!

### Шаг 6: Сборка фронтенда

```bash
cd frontend
npm ci
npm run build
cd ..
```

### Шаг 7: Временные SSL сертификаты

```bash
mkdir -p nginx/ssl
openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem \
  -subj "/CN=localhost"
```

### Шаг 8: Запуск Docker Compose

**ВАЖНО:** Всегда используйте флаг `--env-file .env.production`!

```bash
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Проверка:
```bash
sudo docker-compose -f docker-compose.prod.yml ps
curl -k https://localhost/api/health
# Ожидается: {"status":"ok"}
```

### Шаг 9: Настройка Let's Encrypt

Остановить nginx для получения сертификата:
```bash
sudo docker-compose -f docker-compose.prod.yml stop nginx
```

Получить сертификат:
```bash
sudo certbot certonly --standalone \
  -d crm.przmilena.click \
  --email your-email@example.com \
  --agree-tos \
  --non-interactive
```

Скопировать сертификаты в проект:
```bash
sudo cp /etc/letsencrypt/live/crm.przmilena.click/fullchain.pem ~/MilenaCRM/nginx/ssl/
sudo cp /etc/letsencrypt/live/crm.przmilena.click/privkey.pem ~/MilenaCRM/nginx/ssl/
sudo chown ubuntu:ubuntu ~/MilenaCRM/nginx/ssl/*.pem
```

Запустить nginx:
```bash
cd ~/MilenaCRM
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d nginx
```

Проверка:
```bash
curl https://crm.przmilena.click/api/health
# Ожидается: {"status":"ok"}
```

### Шаг 10: Автообновление SSL сертификатов

Создать скрипт:
```bash
sudo nano /usr/local/bin/renew-ssl-cert.sh
```

Содержимое:
```bash
#!/bin/bash
cd /home/ubuntu/MilenaCRM
docker-compose -f docker-compose.prod.yml stop nginx
certbot renew --quiet
cp /etc/letsencrypt/live/crm.przmilena.click/fullchain.pem /home/ubuntu/MilenaCRM/nginx/ssl/
cp /etc/letsencrypt/live/crm.przmilena.click/privkey.pem /home/ubuntu/MilenaCRM/nginx/ssl/
chown ubuntu:ubuntu /home/ubuntu/MilenaCRM/nginx/ssl/*.pem
docker-compose -f docker-compose.prod.yml up -d nginx
```

Сделать исполняемым:
```bash
sudo chmod +x /usr/local/bin/renew-ssl-cert.sh
```

Добавить в crontab (root):
```bash
sudo crontab -e
# Добавить строку:
0 3 * * * /usr/local/bin/renew-ssl-cert.sh >> /var/log/ssl-renew.log 2>&1
```

### Шаг 11: Настройка автоматических бэкапов

Создать директорию:
```bash
sudo mkdir -p /data/backups/postgres
sudo chown ubuntu:ubuntu /data/backups/postgres
```

Обновить скрипт backup-db.sh (добавить sudo):
```bash
nano ~/MilenaCRM/scripts/backup-db.sh
```

Найти строку:
```bash
docker exec crm_db pg_dump -U crm_user_prod crm_production > $BACKUP_FILE
```

Заменить на:
```bash
sudo docker exec crm_db pg_dump -U crm_user_prod crm_production > $BACKUP_FILE
```

Сделать исполняемым:
```bash
chmod +x ~/MilenaCRM/scripts/backup-db.sh
```

Протестировать:
```bash
~/MilenaCRM/scripts/backup-db.sh
ls -lh /data/backups/postgres/
```

Добавить в crontab (пользователь ubuntu):
```bash
crontab -e
# Добавить строку:
0 2 * * * /home/ubuntu/MilenaCRM/scripts/backup-db.sh >> /var/log/db-backup.log 2>&1
```

### Шаг 12: Создание администратора

```bash
sudo docker cp ~/MilenaCRM/backend/create_admin.py crm_backend:/app/create_admin.py
sudo docker exec crm_backend python /app/create_admin.py
```

Учетные данные по умолчанию:
- Email: `admin@example.com`
- Пароль: `admin123`

**ВАЖНО:** Сменить пароль сразу после первого входа в /profile!

---

## Обновление приложения

### Процесс обновления

#### 1. Локальная разработка

Разрабатывайте как обычно:
```bash
# На локальной машине
cd "D:\1. Projects\MilenaCRM"
# Внести изменения в код
git add .
git commit -m "Описание изменений"
git push origin main
```

#### 2. Обновление на сервере

**КРИТИЧЕСКИ ВАЖНЫЕ ШАГИ:**

```bash
# SSH на сервер
ssh -i your-key.pem ubuntu@<ELASTIC_IP>

# Перейти в проект
cd ~/MilenaCRM

# Получить последние изменения
git pull origin main

# ОБЯЗАТЕЛЬНО: Пересобрать фронтенд
cd frontend
npm ci  # Установить зависимости если package.json изменился
npm run build  # Всегда пересобирать!
cd ..

# Пересобрать и перезапустить контейнеры
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production down
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production build --no-cache
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# Проверить статус
sudo docker-compose -f docker-compose.prod.yml ps

# Проверить логи
sudo docker-compose -f docker-compose.prod.yml logs -f
```

#### 3. Если изменился только фронтенд

```bash
cd ~/MilenaCRM
git pull origin main

cd frontend
npm ci
npm run build
cd ..

# Достаточно перезапустить только nginx
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production restart nginx
```

#### 4. Если изменился только backend

```bash
cd ~/MilenaCRM
git pull origin main

# Пересобрать backend контейнер
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production build backend
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d backend
```

---

## Важные нюансы и решения проблем

### 1. Проблема: Изображения не отображаются

**Симптомы:**
- В консоли браузера ошибка: `Mixed Content` или `CORS policy`
- Запросы идут на `http://localhost:8000/uploads/...`

**Причины:**
1. Фронтенд собран без `.env.production` файла
2. В коде есть жестко прописанные пути `http://localhost:8000`

**Решение:**
1. Убедиться что `frontend/.env.production` существует:
   ```bash
   cat ~/MilenaCRM/frontend/.env.production
   # Должно быть: VITE_API_URL=/api
   ```

2. Проверить что в коде используются относительные пути:
   ```typescript
   // ПРАВИЛЬНО:
   <img src={photoUrl} />  // photoUrl = "/uploads/file.png"

   // НЕПРАВИЛЬНО:
   <img src={`http://localhost:8000${photoUrl}`} />
   ```

3. Пересобрать фронтенд:
   ```bash
   cd ~/MilenaCRM/frontend
   npm run build
   cd ..
   sudo docker-compose -f docker-compose.prod.yml --env-file .env.production restart nginx
   ```

### 2. Проблема: Nginx не отдает загруженные файлы

**Симптомы:**
- Backend загружает файлы успешно
- При запросе `/uploads/file.png` возвращается 404

**Причина:**
Nginx контейнер не имеет доступа к volume с uploads.

**Решение:**
Убедиться что в `docker-compose.prod.yml` у nginx есть volume:
```yaml
nginx:
  volumes:
    - uploads_data:/app/uploads:ro  # ← Должно быть!
```

### 3. Проблема: Backend не подключается к БД

**Симптомы:**
- Backend контейнер постоянно перезапускается
- Ошибка: `password authentication failed`

**Причины:**
1. Docker Compose читает старый `.env` вместо `.env.production`
2. В `.env.production` есть лишние пробелы в начале строк
3. БД volume создан с старыми credentials

**Решение:**
1. Всегда использовать флаг `--env-file`:
   ```bash
   sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
   ```

2. Убрать лишние пробелы:
   ```bash
   sed -i 's/^  //' .env.production
   ```

3. Пересоздать volumes:
   ```bash
   sudo docker-compose -f docker-compose.prod.yml down -v
   sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
   ```

### 4. Проблема: Изменения в коде не применяются

**Причина:**
В production код собирается в Docker образ, а не монтируется как volume.

**Решение:**
Всегда пересобирать после изменений:
```bash
# Для backend
sudo docker-compose -f docker-compose.prod.yml build backend

# Для фронтенда
cd frontend && npm run build && cd ..
sudo docker-compose -f docker-compose.prod.yml restart nginx
```

### 5. Проблема: Dashboard статистика не обновляется

**Причина:**
Не инвалидируется кеш `dashboard-stats` в TanStack Query.

**Решение:**
В коде мутаций (Create/Edit/Delete) добавить:
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
}
```

---

## Мониторинг и обслуживание

### Полезные команды

#### Просмотр логов

```bash
# Все сервисы
sudo docker-compose -f docker-compose.prod.yml logs -f

# Только backend
sudo docker-compose -f docker-compose.prod.yml logs -f backend

# Последние 100 строк
sudo docker-compose -f docker-compose.prod.yml logs --tail=100 backend
```

#### Статус контейнеров

```bash
sudo docker-compose -f docker-compose.prod.yml ps
```

#### Перезапуск сервисов

```bash
# Все сервисы
sudo docker-compose -f docker-compose.prod.yml restart

# Только nginx
sudo docker-compose -f docker-compose.prod.yml restart nginx

# Только backend
sudo docker-compose -f docker-compose.prod.yml restart backend
```

#### Проверка здоровья

```bash
# Backend health
curl https://crm.przmilena.click/api/health

# Nginx доступность
curl -I https://crm.przmilena.click/

# Проверка SSL сертификата
openssl s_client -connect crm.przmilena.click:443 -servername crm.przmilena.click < /dev/null 2>/dev/null | openssl x509 -noout -dates
```

#### База данных

```bash
# Подключиться к PostgreSQL
sudo docker exec -it crm_db psql -U crm_user_prod -d crm_production

# Список таблиц
\dt

# Структура таблицы
\d users

# Выход
\q

# Ручной бэкап
sudo docker exec crm_db pg_dump -U crm_user_prod crm_production > backup_$(date +%Y%m%d).sql

# Восстановление из бэкапа
sudo docker exec -i crm_db psql -U crm_user_prod crm_production < backup_20241218.sql
```

#### Список бэкапов

```bash
ls -lh /data/backups/postgres/
```

#### Логи cron jobs

```bash
# SSL renewal
sudo tail -f /var/log/ssl-renew.log

# Database backup
tail -f /var/log/db-backup.log
```

### Мониторинг ресурсов

```bash
# Использование диска
df -h

# Docker volumes
sudo docker volume ls
sudo docker system df

# Память и CPU
htop

# Docker stats
sudo docker stats
```

### Очистка

```bash
# Удалить неиспользуемые образы
sudo docker image prune -a

# Удалить неиспользуемые volumes (ОСТОРОЖНО!)
sudo docker volume prune

# Полная очистка (ОПАСНО! Удалит все неиспользуемые ресурсы)
sudo docker system prune -a --volumes
```

---

## Безопасность

### Checklist безопасности

- [ ] `.env.production` НЕ коммитится в Git (добавлен в .gitignore)
- [ ] Пароль администратора изменен с дефолтного
- [ ] SSH доступ только по ключу (пароли отключены)
- [ ] Security Group разрешает SSH только с определенных IP
- [ ] SSL сертификат действителен и автообновляется
- [ ] Регулярные бэкапы БД работают (проверять /data/backups/postgres/)
- [ ] PostgreSQL доступна только внутри Docker network
- [ ] Backend доступен только через Nginx reverse proxy

### Обновление секретов

Если нужно поменять пароли или secrets:

1. Обновить `.env.production` на сервере
2. Пересоздать volumes БД:
   ```bash
   sudo docker-compose -f docker-compose.prod.yml down -v
   sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
   ```
3. Пересоздать администратора

---

## Troubleshooting

### Backend не запускается

```bash
# Проверить логи
sudo docker-compose -f docker-compose.prod.yml logs backend

# Проверить переменные окружения
sudo docker exec crm_backend env | grep POSTGRES

# Проверить подключение к БД
sudo docker exec crm_backend python -c "from app.db import engine; print(engine.connect())"
```

### Nginx 502 Bad Gateway

```bash
# Проверить что backend запущен
sudo docker-compose -f docker-compose.prod.yml ps backend

# Проверить логи nginx
sudo docker-compose -f docker-compose.prod.yml logs nginx

# Проверить что backend отвечает
sudo docker exec crm_backend curl http://localhost:8000/health
```

### SSL сертификат истек

```bash
# Проверить срок действия
openssl x509 -in ~/MilenaCRM/nginx/ssl/fullchain.pem -noout -dates

# Обновить вручную
sudo /usr/local/bin/renew-ssl-cert.sh

# Проверить cron job
sudo crontab -l | grep renew-ssl
```

### Не хватает места на диске

```bash
# Проверить использование
df -h

# Удалить старые бэкапы (старше 30 дней)
find /data/backups/postgres/ -name "*.sql.gz" -mtime +30 -delete

# Очистить Docker
sudo docker system prune -a
```

---

## Контакты и поддержка

Для вопросов по развертыванию: support@example.com

## Версии

- Docker: 24.0+
- Docker Compose: 2.24+
- PostgreSQL: 16
- Node.js: 20
- Nginx: 1.25
- Ubuntu: 22.04 LTS
