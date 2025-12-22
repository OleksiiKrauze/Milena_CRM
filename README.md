# Missing Persons CRM API

Система управления процессом поиска пропавших людей на базе FastAPI + PostgreSQL.

## Описание

CRM система для организации работы поисковых отрядов:

- **Управление заявками** на поиск пропавших людей
- **Организация поисковых операций** с отслеживанием статуса
- **Полевые поиски** с координацией участников и картами местности
- **Рассылка ориентировок** через разные каналы
- **Прозвоны учреждений** (больницы, морги, полиция, приюты)
- **Управление пользователями** с ролевым доступом
- **Аналитика и статистика** по дашборду

## Технологии

- **Backend**: FastAPI 0.115.6
- **Database**: PostgreSQL 16
- **ORM**: SQLAlchemy 2.0.36
- **Authentication**: JWT (python-jose)
- **Password Hashing**: bcrypt
- **Deployment**: Docker + docker-compose
- **Testing**: pytest + httpx

## Быстрый старт

### Требования

- Docker и docker-compose
- Python 3.11+ (для локальной разработки)

### Запуск с Docker

1. Клонируйте репозиторий:
```bash
git clone <repository-url>
cd MilenaCRM
```

2. Настройте переменные окружения в `.env` (см. пример ниже)

3. Запустите приложение:
```bash
docker-compose up -d
```

4. API будет доступен по адресу: `http://localhost:8000`

5. Swagger документация: `http://localhost:8000/docs`

### Переменные окружения (.env)

```bash
# Database
POSTGRES_DB=crm
POSTGRES_USER=crm_user
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Application
APP_PORT=8000

# JWT Authentication (generate with: openssl rand -hex 32)
JWT_SECRET_KEY=your_secret_key_here

# CORS (comma-separated list)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Logging
LOG_LEVEL=INFO

# OpenAI API Key for case autofill functionality (optional)
# Get your key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=your-openai-api-key-here
```

### Локальная разработка

1. Создайте виртуальное окружение:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# или
venv\Scripts\activate  # Windows
```

2. Установите зависимости:
```bash
pip install -r requirements.txt
```

3. Запустите PostgreSQL (через Docker):
```bash
docker-compose up db -d
```

4. Запустите приложение:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Архитектура проекта

```
backend/
├── app/
│   ├── core/               # Конфигурация логирования
│   ├── middleware/         # Middleware (логирование, обработка ошибок)
│   ├── models/            # SQLAlchemy модели
│   ├── routers/           # API endpoints
│   ├── schemas/           # Pydantic схемы
│   ├── services/          # Бизнес-логика (auth, etc.)
│   ├── db.py             # Database setup
│   └── main.py           # FastAPI application
├── tests/                # Unit tests
├── logs/                 # Application logs
└── requirements.txt
```

## Структура базы данных

### Основные таблицы

1. **users** - Пользователи системы
2. **roles** - Роли (admin, direction_head, inforg, searcher, volunteer)
3. **directions** - Направления работы
4. **cases** - Заявки на поиск
5. **searches** - Поисковые операции
6. **flyers** - Ориентировки
7. **distributions** - Рассылки ориентировок
8. **field_searches** - Полевые поиски
9. **map_grids** - Карты местности с сеткой
10. **grid_cells** - Квадраты сетки
11. **institutions_calls** - Прозвоны учреждений

### Связи

- User ↔ Role (many-to-many)
- User ↔ Direction (many-to-many)
- Case → Search (one-to-many)
- Case → FieldSearch (one-to-many)
- Case → InstitutionsCall (one-to-many)
- Search → Flyer (one-to-many)
- Search → Distribution (one-to-many)
- Search → MapGrid (one-to-many)
- FieldSearch ↔ User (many-to-many participants)

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Регистрация пользователя |
| POST | `/auth/login` | Вход (получение JWT токена) |
| GET | `/auth/me` | Получение данных текущего пользователя |

### Cases (Заявки)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/cases/` | Создать заявку |
| GET | `/cases/` | Список заявок (с пагинацией и фильтрами) |
| GET | `/cases/{id}` | Получить заявку по ID |
| GET | `/cases/{id}/full` | Получить заявку со всеми связанными данными |
| PUT | `/cases/{id}` | Обновить заявку |
| DELETE | `/cases/{id}` | Удалить заявку |
| POST | `/cases/autofill` | Автозаполнение полей заявки через ChatGPT |

### Searches (Поиски)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/searches/` | Создать поиск |
| GET | `/searches/` | Список поисков |
| GET | `/searches/{id}` | Получить поиск по ID |
| GET | `/searches/{id}/full` | Получить поиск со всеми данными |
| PUT | `/searches/{id}` | Обновить поиск |
| DELETE | `/searches/{id}` | Удалить поиск |

### Field Searches (Полевые поиски)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/field_searches/` | Создать полевой поиск |
| GET | `/field_searches/` | Список полевых поисков |
| GET | `/field_searches/{id}` | Получить полевой поиск |
| PUT | `/field_searches/{id}` | Обновить полевой поиск |
| DELETE | `/field_searches/{id}` | Удалить полевой поиск |
| POST | `/field_searches/{id}/participants` | Добавить участников |
| DELETE | `/field_searches/{id}/participants/{user_id}` | Удалить участника |

### Map Grids (Карты и сетки)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/map_grids/` | Создать карту с сеткой |
| GET | `/map_grids/` | Список карт |
| GET | `/map_grids/{id}` | Получить карту |
| PUT | `/map_grids/{id}` | Обновить карту |
| DELETE | `/map_grids/{id}` | Удалить карту |
| POST | `/map_grids/{id}/cells` | Создать квадрат сетки |
| GET | `/map_grids/{id}/cells` | Список квадратов карты |
| PUT | `/map_grids/{grid_id}/cells/{cell_id}` | Обновить квадрат |
| DELETE | `/map_grids/{grid_id}/cells/{cell_id}` | Удалить квадрат |

### Flyers (Ориентировки)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/flyers/` | Создать ориентировку |
| GET | `/flyers/` | Список ориентировок |
| GET | `/flyers/{id}` | Получить ориентировку |
| PUT | `/flyers/{id}` | Обновить ориентировку |
| DELETE | `/flyers/{id}` | Удалить ориентировку |

### Distributions (Рассылки)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/distributions/` | Создать рассылку |
| GET | `/distributions/` | Список рассылок |
| GET | `/distributions/{id}` | Получить рассылку |
| PUT | `/distributions/{id}` | Обновить рассылку |
| DELETE | `/distributions/{id}` | Удалить рассылку |

### Institutions Calls (Прозвоны)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/institutions_calls/` | Создать запись о прозвоне |
| GET | `/institutions_calls/` | Список прозвонов |
| GET | `/institutions_calls/{id}` | Получить прозвон |
| PUT | `/institutions_calls/{id}` | Обновить прозвон |
| DELETE | `/institutions_calls/{id}` | Удалить прозвон |

### Users, Roles, Directions (Управление)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/` | Список пользователей |
| GET | `/users/{id}` | Получить пользователя |
| PUT | `/users/{id}` | Обновить пользователя |
| POST | `/users/{id}/roles` | Назначить роли |
| POST | `/users/{id}/directions` | Назначить направления |
| GET | `/roles/` | Список ролей |
| POST | `/roles/` | Создать роль |
| GET | `/directions/` | Список направлений |
| POST | `/directions/` | Создать направление |

### Dashboard (Статистика)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard/stats` | Агрегированная статистика |

### Health Checks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/db-check` | Database connection check |

## Аутентификация

API использует JWT (JSON Web Tokens) для аутентификации.

### Получение токена

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

Ответ:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

### Использование токена

Включите токен в заголовок Authorization:

```bash
curl -X GET http://localhost:8000/cases/ \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

## Примеры использования API

### 1. Регистрация и вход

```bash
# Регистрация
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Иван Петров",
    "phone": "+79991234567",
    "email": "ivan@example.com",
    "password": "securepassword",
    "city": "Москва"
  }'

# Вход
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ivan@example.com",
    "password": "securepassword"
  }'
```

### 2. Создание заявки на поиск

```bash
curl -X POST http://localhost:8000/cases/ \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "applicant_full_name": "Анна Иванова",
    "applicant_phone": "+79991234568",
    "applicant_relation": "Дочь",
    "missing_full_name": "Мария Петрова",
    "missing_gender": "Женский",
    "missing_birthdate": "1950-03-15",
    "missing_last_seen_place": "Москва, ул. Ленина, 10",
    "missing_description": "Рост 160 см, седые волосы",
    "tags": ["срочно", "москва"]
  }'
```

### 3. Создание поиска

```bash
curl -X POST http://localhost:8000/searches/ \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "case_id": 1,
    "start_date": "2025-01-15",
    "status": "planned",
    "notes": "Планируется выездной поиск"
  }'
```

### 4. Получение статистики

```bash
curl -X GET http://localhost:8000/dashboard/stats \
  -H "Authorization: Bearer <TOKEN>"
```

## Тестирование

### Запуск тестов

```bash
cd backend
pytest
```

### Запуск с coverage

```bash
pytest --cov=app --cov-report=html
```

Отчет coverage будет в `htmlcov/index.html`

## Логирование

Логи сохраняются в директории `logs/`:

- `logs/app.log` - все логи уровня INFO и выше
- `logs/error.log` - только ошибки (ERROR и CRITICAL)

Уровень логирования настраивается через переменную окружения `LOG_LEVEL`.

Каждый запрос логируется с деталями:
- Метод и URL
- Параметры запроса
- IP адрес клиента
- Время обработки
- Статус ответа

## Обработка ошибок

API использует централизованную обработку ошибок:

- **400** - Некорректные данные (validation, integrity constraints)
- **401** - Не авторизован (invalid/missing token)
- **403** - Доступ запрещен (missing authentication)
- **404** - Ресурс не найден
- **422** - Ошибка валидации данных
- **500** - Внутренняя ошибка сервера
- **503** - База данных недоступна

Все ошибки возвращаются в единообразном формате:

```json
{
  "error": {
    "status_code": 404,
    "message": "Case with id 999 not found",
    "path": "/cases/999"
  }
}
```

## CORS

CORS настроен для работы с фронтенд приложениями. По умолчанию разрешены запросы с:
- `http://localhost:3000` (React/Next.js)
- `http://localhost:5173` (Vite)

Настройка через переменную окружения `CORS_ORIGINS`.

## Производственное развертывание

### Рекомендации

1. **Безопасность**:
   - Используйте сложный JWT_SECRET_KEY (32+ байт)
   - Используйте HTTPS в production
   - Настройте firewall для PostgreSQL
   - Регулярно обновляйте зависимости

2. **База данных**:
   - Настройте регулярные бэкапы PostgreSQL
   - Используйте connection pooling (уже настроен в SQLAlchemy)
   - Мониторьте производительность запросов

3. **Логирование**:
   - Настройте ротацию логов
   - Используйте централизованное хранение логов (ELK, Loki, etc.)
   - Настройте алерты на критические ошибки

4. **Масштабирование**:
   - Используйте несколько worker'ов для uvicorn
   - Настройте load balancer (nginx, traefik)
   - Рассмотрите использование Redis для кэширования

## Swagger/OpenAPI документация

Интерактивная документация доступна по адресу:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- OpenAPI schema: `http://localhost:8000/openapi.json`

## Лицензия

Private

## Контакты

Для вопросов и поддержки: support@example.com
