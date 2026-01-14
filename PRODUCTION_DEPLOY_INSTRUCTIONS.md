# Инструкция по деплою: Исправления тегов и видео

**ВАЖНО:** На production сервере папка проекта называется `Milena_CRM` (не MilenaCRM)

## Изменения в этом релизе

### 1. Исправлено автозаполнение тегов
- Теги теперь правильно извлекаются из ответа OpenAI
- Теги автоматически отмечаются при автозаполнении

### 2. Исправлено сохранение видео
- Видео теперь корректно сохраняются в базу данных
- Видео отображаются при просмотре и редактировании заявок
- Добавлен прогресс-бар загрузки видео

## Шаги деплоя на Production

### Шаг 1: Подключение к серверу

```bash
ssh ubuntu@<server-ip>
```

### Шаг 2: Переход в директорию проекта

```bash
cd ~/Milena_CRM
```

### Шаг 3: Получение изменений из Git

```bash
git pull origin main
```

### Шаг 4: Пересборка Frontend (ОБЯЗАТЕЛЬНО!)

```bash
cd frontend
npm ci
npm run build
cd ..
```

### Шаг 5: Перезапуск контейнеров

```bash
# Остановка контейнеров
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production down

# Пересборка backend (изменения в cases.py и openai_service.py)
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production build --no-cache backend

# Запуск всех контейнеров
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### Шаг 6: Применение миграции БД (КРИТИЧЕСКИ ВАЖНО!)

```bash
# Применить миграцию для добавления поля videos
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec backend alembic upgrade head

# Проверить текущую версию миграции
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec backend alembic current
```

**Ожидаемый результат:** Должно показать `007_add_videos (head)`

### Шаг 7: Проверка статуса контейнеров

```bash
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production ps
```

Все контейнеры должны быть в статусе "Up".

### Шаг 8: Проверка логов

```bash
# Проверка логов backend
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production logs backend --tail 50

# Проверка логов nginx
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production logs nginx --tail 20
```

Должны увидеть:
- Backend: "Application startup complete"
- Nginx: отсутствие ошибок

## Тестирование после деплоя

### 1. Проверка тегов
1. Откройте https://crm.przmilena.click
2. Создайте новую заявку
3. Заполните раздел "Первинна інформація" тестовыми данными с возрастом
4. Нажмите "Автозаполнение"
5. **Проверьте:** В разделе "Теги" должны автоматически отметиться чекбоксы (например, "Дорослий 18-60")

### 2. Проверка видео
1. Создайте новую заявку
2. Добавьте пропавшего
3. Загрузите тестовое видео (до 100 МБ)
4. **Проверьте:** Должен появиться прогресс-бар загрузки
5. Сохраните заявку
6. Откройте созданную заявку
7. **Проверьте:** Видео должно отображаться и проигрываться
8. Откройте редактирование заявки
9. **Проверьте:** Видео должно быть в списке

## Откат изменений (если что-то пошло не так)

```bash
cd ~/Milena_CRM

# Откат кода
git reset --hard HEAD~1

# Пересборка frontend
cd frontend
npm ci
npm run build
cd ..

# Перезапуск контейнеров
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production down
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production build --no-cache
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

## Важные замечания

1. **Миграция БД ОБЯЗАТЕЛЬНА** - необходимо применить миграцию `007_add_videos` для добавления поля videos в таблицу missing_persons
2. **Обратная совместимость** - старые заявки без видео будут работать корректно (пустой массив)
3. **Nginx конфигурация** - проверьте что `client_max_body_size 100M;` установлен в nginx
4. **Frontend build** - всегда пересобирайте frontend после pull изменений!
5. **Порядок важен** - сначала запустить контейнеры, потом применить миграцию

## Проверка Nginx лимита (если видео не загружается)

```bash
sudo nano /etc/nginx/sites-available/crm.przmilena.click

# Проверьте наличие:
server {
    ...
    client_max_body_size 100M;
    ...
}

# Перезагрузите nginx
sudo nginx -t
sudo systemctl reload nginx
```

## Troubleshooting

### Проблема: Теги не отмечаются при автозаполнении
**Решение:** Проверьте что backend перезапущен и в логах нет ошибок от OpenAI

### Проблема: Видео не сохраняется
**Решение:**
1. Откройте консоль браузера (F12) и проверьте наличие ошибок
2. Проверьте логи backend: `sudo docker-compose -f docker-compose.prod.yml --env-file .env.production logs backend --tail 100`
3. Убедитесь что nginx разрешает загрузку файлов до 100MB

### Проблема: 413 Request Entity Too Large
**Решение:** Увеличьте `client_max_body_size` в nginx и перезагрузите nginx

### Проблема: Migration failed или "column videos does not exist"
**Решение:**
1. Проверьте текущую версию миграции:
   ```bash
   sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec backend alembic current
   ```
2. Если миграция не применена, примените её:
   ```bash
   sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec backend alembic upgrade head
   ```
3. Если миграция показывает ошибку, проверьте что alembic/versions/ содержит файл `007_add_videos_to_missing_persons.py`

## Контакты для поддержки

- GitHub: https://github.com/OleksiiKrauze/Milena_CRM
- Commit: 7e02f43

---

**Дата создания:** 2026-01-14
**Автор:** Claude Code
