# Инструкция по обновлению MilenaCRM на сервере

Эта инструкция для обновления существующего проекта на сервере с новой системой орієнтувань.

## Что добавлено в этом обновлении

- **Система Орієнтувань (Orientations)**: полноценный редактор для создания флаеров о поиске
- Таблицы БД: `orientations` и `flyer_templates`
- Backend API: `/orientations/` и `/flyer-templates/`
- Frontend: страница редактора с canvas 720x1280px
- Функции: шаблоны, фото, текст, вертикальные тексты, логотипы, даты, размытие
- Auto-save JPEG при сохранении

---

## Шаг 1: Подключение к серверу

```bash
ssh -i your-key.pem ubuntu@<ELASTIC_IP_или_ДОМЕН>
```

---

## Шаг 2: Остановка контейнеров

```bash
cd ~/MilenaCRM
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production down
```

---

## Шаг 3: Получение обновлений

```bash
git pull origin main
```

Вы должны увидеть сообщение о скачивании новых файлов:
- `backend/app/models/orientation.py`
- `backend/app/models/flyer_template.py`
- `backend/app/routers/orientations.py`
- `backend/app/routers/flyer_templates.py`
- `frontend/src/pages/CreateOrientationPage.tsx`
- и другие...

---

## Шаг 4: Создание таблиц в БД

**ВАЖНО:** Нужно создать новые таблицы для системы ориентировок!

```bash
# Запустить только БД
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d db

# Дождаться пока БД запустится (10 секунд)
sleep 10

# Создать таблицы
sudo docker exec crm_db psql -U crm_user_prod -d crm_production << 'EOF'
-- Таблица для шаблонов флаеров
CREATE TABLE IF NOT EXISTS flyer_templates (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) UNIQUE NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_flyer_templates_file_type ON flyer_templates(file_type);

-- Таблица для ориентировок
CREATE TABLE IF NOT EXISTS orientations (
    id SERIAL PRIMARY KEY,
    search_id INTEGER NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES flyer_templates(id) ON DELETE SET NULL,
    selected_photos TEXT[],
    canvas_data JSONB,
    text_content TEXT,
    is_approved BOOLEAN DEFAULT false,
    exported_files TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orientations_search_id ON orientations(search_id);
CREATE INDEX IF NOT EXISTS idx_orientations_is_approved ON orientations(is_approved);
EOF
```

Проверить что таблицы созданы:
```bash
sudo docker exec crm_db psql -U crm_user_prod -d crm_production -c "\dt orientations"
sudo docker exec crm_db psql -U crm_user_prod -d crm_production -c "\dt flyer_templates"
```

Вы должны увидеть информацию о таблицах.

---

## Шаг 5: Проверка frontend/.env.production

**КРИТИЧЕСКИ ВАЖНО!** Убедитесь что файл существует:

```bash
cat ~/MilenaCRM/frontend/.env.production
```

Должно быть:
```
VITE_API_URL=/api
```

Если файла нет, создайте:
```bash
echo "VITE_API_URL=/api" > ~/MilenaCRM/frontend/.env.production
```

---

## Шаг 6: Пересборка фронтенда

```bash
cd ~/MilenaCRM/frontend

# Установить новые зависимости (react-rnd, html2canvas)
npm ci

# Собрать production build
npm run build

cd ..
```

Проверить что build создан:
```bash
ls -lh ~/MilenaCRM/frontend/dist/
```

Должны быть файлы index.html, assets/, и т.д.

---

## Шаг 7: Пересборка Docker контейнеров

```bash
cd ~/MilenaCRM

# Пересобрать backend с новыми моделями и роутерами
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production build --no-cache backend

# Запустить все сервисы
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

---

## Шаг 8: Проверка работоспособности

### 1. Проверить статус контейнеров
```bash
sudo docker-compose -f docker-compose.prod.yml ps
```

Все три контейнера (nginx, backend, db) должны быть в статусе `Up`.

### 2. Проверить логи backend
```bash
sudo docker-compose -f docker-compose.prod.yml logs -f backend
```

Нажмите Ctrl+C для выхода. Не должно быть ошибок типа "column does not exist" или "relation does not exist".

### 3. Проверить health endpoint
```bash
curl https://crm.przmilena.click/api/health
```

Ожидается: `{"status":"ok"}`

### 4. Проверить новые API endpoints
```bash
# Список шаблонов (пустой массив - это нормально, шаблоны еще не загружены)
curl https://crm.przmilena.click/api/flyer-templates/

# Ожидается: {"templates":[],"total":0}
```

### 5. Проверить в браузере

Откройте: https://crm.przmilena.click

1. Войдите в систему
2. Перейдите в Settings → Flyer Templates (новая страница)
3. Перейдите в любой поиск → раздел "Орієнтування" → кнопка "Створити орієнтування"
4. Должен открыться редактор с canvas

---

## Шаг 9: Загрузка тестовых шаблонов (опционально)

Чтобы протестировать систему ориентировок, загрузите шаблоны через UI:

1. Откройте https://crm.przmilena.click/settings/flyer-templates
2. Загрузите шаблоны (PNG/JPG изображения):
   - **Main Template**: основной фон (рекомендуемый размер: 720px ширина)
   - **Additional Template**: дополнительный элемент внизу
   - **Logo**: логотип организации

---

## Troubleshooting

### Проблема: Backend не запускается

**Симптомы:**
```bash
sudo docker-compose -f docker-compose.prod.yml ps
# crm_backend постоянно Restarting
```

**Решение:**
```bash
# Проверить логи
sudo docker-compose -f docker-compose.prod.yml logs backend | tail -50

# Если ошибка "relation orientations does not exist":
# Повторить Шаг 4 (создание таблиц)

# Если ошибка "password authentication failed":
# Проверить .env.production и перезапустить
sudo docker-compose -f docker-compose.prod.yml down -v
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### Проблема: Изображения не отображаются

**Симптомы:** В браузере ошибка Mixed Content или CORS

**Решение:**
1. Проверить что frontend/.env.production существует
2. Пересобрать фронтенд:
   ```bash
   cd ~/MilenaCRM/frontend
   npm run build
   cd ..
   sudo docker-compose -f docker-compose.prod.yml --env-file .env.production restart nginx
   ```

### Проблема: 404 на /api/orientations/

**Решение:** Backend контейнер не перезагрузился. Перезапустить:
```bash
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production restart backend
```

### Проблема: Canvas не рендерится в редакторе

**Симптомы:** Пустая страница CreateOrientationPage

**Решение:**
1. Открыть DevTools (F12) → Console
2. Проверить ошибки
3. Скорее всего фронтенд не пересобран. Повторить Шаг 6.

---

## Откат на предыдущую версию (если что-то пошло не так)

```bash
cd ~/MilenaCRM

# Откатить git
git checkout 1e7c5a0  # предыдущий коммит

# Пересобрать
cd frontend && npm run build && cd ..
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production down
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production build --no-cache
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# Удалить таблицы ориентировок (опционально)
sudo docker exec crm_db psql -U crm_user_prod -d crm_production -c "DROP TABLE IF EXISTS orientations CASCADE;"
sudo docker exec crm_db psql -U crm_user_prod -d crm_production -c "DROP TABLE IF EXISTS flyer_templates CASCADE;"
```

---

## Полезные команды

### Просмотр логов
```bash
# Все сервисы
sudo docker-compose -f docker-compose.prod.yml logs -f

# Только backend
sudo docker-compose -f docker-compose.prod.yml logs -f backend

# Последние 100 строк
sudo docker-compose -f docker-compose.prod.yml logs --tail=100 backend
```

### Перезапуск сервисов
```bash
# Только nginx (если изменился только фронтенд)
sudo docker-compose -f docker-compose.prod.yml restart nginx

# Только backend
sudo docker-compose -f docker-compose.prod.yml restart backend

# Все сервисы
sudo docker-compose -f docker-compose.prod.yml restart
```

### Проверка БД
```bash
# Подключиться к PostgreSQL
sudo docker exec -it crm_db psql -U crm_user_prod -d crm_production

# Список таблиц
\dt

# Структура таблицы orientations
\d orientations

# Количество ориентировок
SELECT COUNT(*) FROM orientations;

# Выход
\q
```

---

## Итоговый checklist

- [ ] Подключился к серверу
- [ ] Остановил контейнеры
- [ ] Сделал git pull
- [ ] Создал таблицы orientations и flyer_templates в БД
- [ ] Проверил наличие frontend/.env.production
- [ ] Пересобрал фронтенд (npm ci && npm run build)
- [ ] Пересобрал backend контейнер
- [ ] Запустил все сервисы
- [ ] Проверил статус контейнеров (все Up)
- [ ] Проверил /api/health (возвращает {"status":"ok"})
- [ ] Проверил /api/flyer-templates/ (возвращает JSON)
- [ ] Открыл сайт в браузере и проверил Settings → Flyer Templates
- [ ] Открыл редактор ориентировок из любого поиска

Если все пункты выполнены и работают - обновление успешно!

---

## Контакты

Если возникли проблемы, которые не решаются по этой инструкции, сохраните вывод команд:

```bash
sudo docker-compose -f docker-compose.prod.yml ps > status.txt
sudo docker-compose -f docker-compose.prod.yml logs backend > backend-logs.txt
sudo docker-compose -f docker-compose.prod.yml logs nginx > nginx-logs.txt
```

И отправьте эти логи для анализа.
