# Инструкция по деплою Push-уведомлений на Production

## Подготовка на localhost (ВЫПОЛНЕНО ✅)

### 1. Backend
- ✅ Добавлены зависимости `py-vapid` и `pywebpush` в requirements.txt
- ✅ Созданы модели и миграции
- ✅ Реализован сервис отправки Web Push
- ✅ Созданы API эндпоинты
- ✅ Интегрированы уведомления в код

### 2. Frontend
- ✅ Добавлены Workbox зависимости
- ✅ Создан custom service worker
- ✅ Реализован React hook для управления подписками
- ✅ Создан UI компонент настроек

### 3. VAPID ключи для localhost
```env
VAPID_PUBLIC_KEY=BPulc4l5wxGdGpbSRDcmoWdGPGLGRB9ojUOom5mBW3c3gJY1DSPugSNEZSC2JX4eeXbkyataI0-5eYseHm8lX2c
VAPID_PRIVATE_KEY=vFFDRfZ3mh6AIWvQEbDe-ohHV1NDTtzGlshzY6UZtiQ
VAPID_SUBJECT=mailto:support@przmilena.click
```

---

## Деплой на Production

### ШАГ 1: Сгенерировать VAPID ключи для Production

**⚠️ ВАЖНО:** Для production нужно сгенерировать НОВЫЕ ключи (не использовать localhost ключи!)

Подключитесь к серверу:
```bash
ssh ubuntu@<ваш_сервер>
cd ~/MilenaCRM
```

Сгенерируйте новые VAPID ключи:
```bash
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec backend python -c "
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
import base64

# Generate private key
private_key = ec.generate_private_key(ec.SECP256R1())

# Get public key
public_key = private_key.public_key()

# Serialize public key (uncompressed format for VAPID)
public_bytes = public_key.public_bytes(
    encoding=serialization.Encoding.X962,
    format=serialization.PublicFormat.UncompressedPoint
)

# Convert to URL-safe base64 (remove padding)
public_key_b64 = base64.urlsafe_b64encode(public_bytes).decode('utf-8').rstrip('=')

# For private key, extract raw bytes
private_numbers = private_key.private_numbers()
private_value = private_numbers.private_value
private_bytes_raw = private_value.to_bytes(32, byteorder='big')
private_key_b64 = base64.urlsafe_b64encode(private_bytes_raw).decode('utf-8').rstrip('=')

print('VAPID_PUBLIC_KEY=' + public_key_b64)
print('VAPID_PRIVATE_KEY=' + private_key_b64)
"
```

Скопируйте вывод ключей и сохраните их надежно!

---

### ШАГ 2: Обновить `.env.production` на сервере

```bash
nano ~/MilenaCRM/.env.production
```

Добавьте в конец файла:
```env
# VAPID keys for Web Push notifications
VAPID_PUBLIC_KEY=<сгенерированный_public_key>
VAPID_PRIVATE_KEY=<сгенерированный_private_key>
VAPID_SUBJECT=mailto:support@przmilena.click
```

**⚠️ Сохраните файл:** `Ctrl+O`, Enter, `Ctrl+X`

---

### ШАГ 3: Деплой кода на сервер

#### 3.1. Закоммитить изменения локально

На вашем локальном компьютере:
```bash
cd /d/1.\ Projects/MilenaCRM

git add .
git commit -m "Add Web Push notifications with RBAC integration

- Backend: Push subscription models, service, API endpoints
- Frontend: Service worker, React hooks, UI components
- Integration: Notifications for new cases and field search assignments
- RBAC: Notification types filtered by user permissions"

git push origin main
```

#### 3.2. Подтянуть изменения на сервере

На сервере:
```bash
ssh ubuntu@<ваш_сервер>
cd ~/MilenaCRM
git pull origin main
```

---

### ШАГ 4: Пересобрать и запустить Backend

```bash
# Пересобрать backend с новыми зависимостями
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production build --no-cache backend

# Остановить старый контейнер
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production down

# Запустить с новыми настройками
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# Проверить логи
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production logs -f backend
```

Дождитесь сообщения: `INFO: Application startup complete`

Затем **Ctrl+C** для выхода из логов.

---

### ШАГ 5: Применить миграцию базы данных

```bash
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec backend alembic upgrade head
```

**Ожидаемый вывод:**
```
INFO  [alembic.runtime.migration] Running upgrade 04fa3b14ce43 -> 3266d974b129, Add push notifications tables
```

---

### ШАГ 6: Пересобрать Frontend

```bash
cd ~/MilenaCRM/frontend

# Установить новые зависимости
npm ci

# Сбилдить production версию
npm run build
```

**⚠️ Важно:** Убедитесь, что файл `frontend/.env.production` содержит:
```env
VITE_API_URL=/api
```

Проверить:
```bash
cat ~/MilenaCRM/frontend/.env.production
```

Если файла нет, создайте:
```bash
echo "VITE_API_URL=/api" > ~/MilenaCRM/frontend/.env.production
npm run build
```

---

### ШАГ 7: Перезапустить Nginx

```bash
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production restart nginx

# Проверить статус
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production ps
```

Все контейнеры должны быть в статусе `Up`.

---

### ШАГ 8: Проверка работоспособности

#### 8.1. Проверить API
```bash
curl -k https://crm.przmilena.click/api/push-notifications/vapid-public-key
```

**Ожидаемый ответ:**
```json
{"public_key":"<ваш_VAPID_PUBLIC_KEY>"}
```

#### 8.2. Проверить в браузере

1. Откройте https://crm.przmilena.click
2. Войдите под пользователем с ролью, имеющей permission `cases:read` или `field_searches:read`
3. Перейдите в **Профіль** (иконка пользователя → Профіль)
4. Прокрутите вниз до секции **Push-сповіщення**
5. Нажмите **"Увімкнути сповіщення"**
6. Браузер попросит разрешение - **разрешите**
7. Должен появиться список доступных типов уведомлений

---

### ШАГ 9: Протестировать уведомления

#### Тест 1: Новая заявка с сайта

1. Откройте публичную форму: https://milena.in.ua
2. Заполните и отправьте заявку
3. Пользователи с разрешенными уведомлениями должны получить push

#### Тест 2: Назначение на выезд

1. В CRM создайте выезд
2. Добавьте участника к выезду
3. Этот участник должен получить push-уведомление (если он включил уведомления)

---

## Troubleshooting

### Проблема 1: VAPID keys not configured

**Симптом:** В логах backend ошибка `VAPID keys not configured`

**Решение:**
```bash
# Проверить переменные окружения
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec backend env | grep VAPID

# Если пустые - проверить .env.production
cat ~/MilenaCRM/.env.production | grep VAPID

# Перезапустить backend
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production restart backend
```

---

### Проблема 2: Frontend не подключается к API

**Симптом:** Ошибка в консоли браузера при получении VAPID public key

**Решение:**
```bash
# Проверить frontend/.env.production
cat ~/MilenaCRM/frontend/.env.production

# Должно быть:
# VITE_API_URL=/api

# Пересобрать frontend
cd ~/MilenaCRM/frontend
npm run build
cd ..
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production restart nginx
```

---

### Проблема 3: Service Worker не регистрируется

**Симптом:** В DevTools → Application → Service Workers ничего нет

**Решение:**
1. Очистить кеш браузера (Ctrl+Shift+Delete)
2. Перезагрузить страницу
3. HTTPS обязателен для Service Workers (кроме localhost)

---

### Проблема 4: Уведомления не приходят

**Симптом:** Подписка прошла успешно, но уведомления не приходят

**Проверки:**
```bash
# 1. Проверить логи backend при создании заявки
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production logs -f backend

# Должно быть:
# INFO: Push sent to user <user_id>, subscription <subscription_id>

# 2. Проверить подписки в БД
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec backend python -c "
from app.db import SessionLocal
from app.models.push_subscription import PushSubscription
db = SessionLocal()
subs = db.query(PushSubscription).all()
for sub in subs:
    print(f'User {sub.user_id}: {sub.endpoint[:50]}...')
"

# 3. Проверить настройки уведомлений пользователя
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec backend python -c "
from app.db import SessionLocal
from app.models.notification_setting import NotificationSetting
db = SessionLocal()
settings = db.query(NotificationSetting).all()
for s in settings:
    print(f'User {s.user_id}: {s.notification_type} = {s.enabled}')
"
```

---

### Проблема 5: Migration уже применена

**Симптом:** `relation "push_subscriptions" already exists`

**Решение:**
```bash
# Пометить миграцию как выполненную
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec backend alembic stamp 3266d974b129

# Проверить текущую версию
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec backend alembic current
```

---

## Мониторинг

### Проверить количество активных подписок
```bash
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec backend python -c "
from app.db import SessionLocal
from app.models.push_subscription import PushSubscription
from sqlalchemy import func
db = SessionLocal()
count = db.query(func.count(PushSubscription.id)).scalar()
print(f'Active subscriptions: {count}')
"
```

### Посмотреть последние отправленные уведомления
```bash
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production logs backend | grep "Push sent"
```

---

## Важные замечания

### Безопасность
- ✅ VAPID_PRIVATE_KEY хранится в `.env.production` (не в Git!)
- ✅ Все push-операции в try/catch - не ломают основной функционал
- ✅ Expired subscriptions автоматически удаляются (HTTP 410)

### RBAC интеграция
- ✅ Типы уведомлений фильтруются по permissions пользователя
- ✅ Пользователь без `cases:read` не увидит уведомления о новых заявках
- ✅ API `/push-notifications/settings` автоматически фильтрует доступные типы

### iOS Support
- ⚠️ Требуется iOS 16.4+ и Safari
- ⚠️ Push работает только для PWA установленных через "Add to Home Screen"
- ⚠️ Запрос разрешения ДОЛЖЕН быть по клику кнопки (не автоматически)

### Поддерживаемые браузеры
- ✅ Chrome Desktop/Mobile
- ✅ Firefox Desktop/Mobile
- ✅ Edge
- ✅ Safari 16.4+ (iOS/macOS) - только для PWA
- ❌ Safari < 16.4

---

## Контрольный чеклист деплоя

- [ ] Сгенерированы VAPID ключи для production
- [ ] Добавлены ключи в `.env.production`
- [ ] Закоммичен и запушен код
- [ ] Подтянут код на сервере (`git pull`)
- [ ] Пересобран backend (`docker-compose build backend`)
- [ ] Перезапущены контейнеры (`docker-compose up -d`)
- [ ] Применена миграция (`alembic upgrade head`)
- [ ] Установлены frontend зависимости (`npm ci`)
- [ ] Сбилден frontend (`npm run build`)
- [ ] Перезапущен nginx
- [ ] Проверен VAPID public key через API
- [ ] Протестирована подписка в браузере
- [ ] Протестирована отправка уведомления

---

## Откат изменений (если что-то пошло не так)

```bash
# На сервере
cd ~/MilenaCRM

# Откатить код
git checkout <предыдущий_коммит>

# Откатить миграцию
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec backend alembic downgrade 04fa3b14ce43

# Пересобрать
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production down
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production build
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

cd frontend
npm run build
cd ..
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production restart nginx
```

---

## Полезные ссылки

- [Web Push Protocol (RFC 8030)](https://datatracker.ietf.org/doc/html/rfc8030)
- [VAPID Specification](https://datatracker.ietf.org/doc/html/draft-thomson-webpush-vapid)
- [Service Worker API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Notifications API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)

---

**Дата создания:** 2026-01-05
**Версия:** 1.0
**Автор:** Claude Code Assistant
