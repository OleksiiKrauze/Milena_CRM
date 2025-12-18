# Документация разработки MilenaCRM

Документация проделанной работы и изменений в системе для поиска пропавших людей.

## Содержание

1. [Обзор системы](#обзор-системы)
2. [Структура базы данных](#структура-базы-данных)
3. [Backend API](#backend-api)
4. [Frontend PWA](#frontend-pwa)
5. [Реализованный функционал](#реализованный-функционал)
6. [Планируемый функционал](#планируемый-функционал)
7. [Ключевые паттерны и решения](#ключевые-паттерны-и-решения)
8. [Запуск и развертывание](#запуск-и-развертывание)

---

## Обзор системы

MilenaCRM - это Progressive Web Application (PWA) для управления процессом поиска пропавших людей (зниклих людей).

### Цель проекта

Система предназначена для:
- Регистрации заявок на поиск
- Организации поисковых операций
- Координации выездов на местность
- Управления волонтерами и поисковиками
- Создания и рассылки ориентировок
- Ведения карт местности с сеткой поиска
- Прозвонов учреждений

### Технологический стек

**Backend:**
- FastAPI 0.115.6 - веб-фреймворк
- SQLAlchemy 2.0.36 - ORM
- PostgreSQL 16 - база данных
- Pydantic 2.10.5 - валидация данных
- JWT (python-jose) - аутентификация
- bcrypt - хеширование паролей
- Docker - контейнеризация

**Frontend:**
- React 18 + TypeScript
- Vite - сборщик
- TanStack Query (React Query) - управление серверным состоянием
- Zustand - управление клиентским состоянием
- React Hook Form + Zod - формы и валидация
- TailwindCSS - стилизация
- Axios - HTTP клиент
- Lucide React - иконки
- PWA (Service Workers) - оффлайн работа

**Особенности архитектуры:**
- Код фронтенда и бэкенда собирается в Docker образ (не монтируется как volume)
- При изменении кода нужно пересобирать контейнер: `docker-compose build milenacrm`
- База данных в отдельном контейнере с персистентным хранением
- Загруженные файлы хранятся в Docker volume `uploads_data`

---

## Структура базы данных

### Схема взаимосвязей

```
users (сотрудники/волонтеры)
├── user_roles (many-to-many) ─→ roles
├── user_directions (many-to-many) ─→ directions
├── создает → cases
├── редактирует → cases
└── инициирует → searches

cases (заявки на поиск)
├── created_by → users
├── updated_by → users
└── searches (one-to-many) → searches

searches (поисковые операции)
├── case_id → cases
├── initiator_inforg → users
├── current_flyer → flyers
├── flyers (one-to-many) → flyers
├── distributions (one-to-many) → distributions
├── map_grids (one-to-many) → map_grids
└── field_searches (one-to-many) → field_searches

field_searches (выезды на местность)
├── search_id → searches (НЕ case_id!)
├── initiator_inforg → users
├── coordinator → users
├── flyer → flyers
└── participants (many-to-many) → users через field_search_participants

flyers (ориентировки)
├── search_id → searches
└── initiator_inforg → users

distributions (рассылки ориентировок)
├── search_id → searches
├── flyer → flyers
└── initiator_inforg → users

map_grids (карты местности)
├── search_id → searches
├── initiator_inforg → users
└── cells (one-to-many) → grid_cells

institutions_calls (прозвоны учреждений)
├── case_id → cases
└── user_id → users
```

### Важные особенности структуры

1. **Field Searches привязаны к Search, а не к Case**
   - Это принципиально важно! Один поиск может иметь несколько выездов
   - У FieldSearch есть computed property `case_id` через relationship с Search

2. **Создание Search автоматически меняет decision_type Case на "Пошук"**
   - Реализовано в `backend/app/routers/searches.py:create_search()`

3. **Автоматическое завершение поиска при установке результата**
   - Когда результат поиска = 'alive', 'dead' или 'location_known', статус автоматически меняется на 'completed'
   - Реализовано в `backend/app/routers/searches.py:update_search()`

4. **Разделение полей ФИО**
   - Все поля ФИО разделены на last_name, first_name, middle_name
   - Есть computed properties для полного имени: applicant_full_name, missing_full_name

5. **Множественные фотографии**
   - В Case используется ARRAY(String) для хранения URL фотографий
   - Фотографии загружаются через `/upload/images` endpoint

### Таблицы

#### 1. users (Пользователи/Сотрудники)

```sql
id: Integer (PK)
last_name: String(100) - фамилия
first_name: String(100) - имя
middle_name: String(100) - отчество (опционально)
full_name: computed property - полное имя
phone: String(50) UNIQUE - телефон
email: String(255) UNIQUE - email
city: String(100) - город
status: Enum(active, inactive, pending) - статус учетной записи
comment: Text - комментарий
password_hash: String(255) - хеш пароля
```

**Связи:**
- Many-to-many с `roles` через `user_roles`
- Many-to-many с `directions` через `user_directions`

**Индексы:** email, phone, status

#### 2. roles (Роли)

```sql
id: Integer (PK)
name: String(50) UNIQUE - название
description: String(255) - описание
parent_role_id: Integer FK(roles.id) - иерархия ролей
```

**Стандартные роли:**
- `admin` - администратор системы
- `direction_head` - руководитель направления
- `inforg` - информационный организатор (создает поиски, ориентировки)
- `searcher` - поисковик (участвует в полевых поисках)
- `volunteer` - волонтер

#### 3. directions (Направления работы)

```sql
id: Integer (PK)
name: String(100) UNIQUE - название направления
description: String(255) - описание
responsible_user_id: Integer FK(users.id) - ответственный
```

#### 4. cases (Заявки на поиск)

```sql
id: Integer (PK)
created_at: DateTime(TZ) - дата создания
created_by_user_id: Integer FK(users.id) SET NULL - кто создал
updated_at: DateTime(TZ) - дата последнего редактирования
updated_by_user_id: Integer FK(users.id) SET NULL - кто редактировал

# Данные заявителя (раздельные поля)
applicant_last_name: String(100) - фамилия заявителя
applicant_first_name: String(100) - имя заявителя
applicant_middle_name: String(100) - отчество заявителя
applicant_full_name: computed property - полное имя
applicant_phone: String(50) - телефон заявителя
applicant_relation: String(100) - кем приходится пропавший

# Данные зниклого - местоположение
missing_settlement: String(200) - населенный пункт
missing_region: String(200) - область
missing_address: String(500) - адрес проживания

# Данные зниклого (раздельные поля)
missing_last_name: String(100) - фамилия
missing_first_name: String(100) - имя
missing_middle_name: String(100) - отчество
missing_full_name: computed property - полное имя
missing_gender: String(20) - пол
missing_birthdate: Date - дата рождения
missing_photos: ARRAY(String) - массив URL фотографий
missing_last_seen_datetime: DateTime(TZ) - когда видели последний раз
missing_last_seen_place: String(500) - где видели последний раз
missing_description: Text - описание внешности
missing_special_signs: Text - особые приметы
missing_diseases: Text - заболевания
missing_phone: String(50) - телефон зниклого
missing_clothing: Text - одежда
missing_belongings: Text - что было с собой

# Дополнительная информация о поиске
additional_search_regions: ARRAY(String) - дополнительные области поиска
police_report_filed: Boolean - заява до поліції подана (обязательно для начала поиска)
search_terrain_type: String(50) - тип місцевості пошуку (Місто, Ліс, Поле, Вода, Інше)
disappearance_circumstances: Text - обставини зникнення
additional_info: Text - додаткова інформація

# Метаданные заявки
case_status: Enum(new, in_review, in_search, suspended, closed_*) - статус
decision_type: String(50) - тип решения ("На розгляді", "Пошук", "Відмова")
decision_comment: Text - комментарий к решению
tags: ARRAY(String) - теги для категоризации
```

**Статусы заявки (case_status):**
- `new` - новая
- `in_review` - на рассмотрении
- `in_search` - в поиске
- `suspended` - приостановлена
- `closed_found_alive` - закрыта (найден живым)
- `closed_found_dead` - закрыта (найден мертвым)
- `closed_location_known_no_search` - закрыта (место известно, поиск не нужен)
- `closed_other` - закрыта (другая причина)

**Важно:** При создании Search для Case автоматически устанавливается decision_type = "Пошук"

**Индексы:** created_by_user_id, updated_by_user_id, case_status, decision_type

#### 5. searches (Поисковые операции)

```sql
id: Integer (PK)
case_id: Integer FK(cases.id) CASCADE - заявка
created_at: DateTime(TZ) - дата создания записи
initiator_inforg_id: Integer FK(users.id) SET NULL - инфорг-инициатор

start_date: Date - дата начала поиска
end_date: Date - дата окончания
result: String - результат поиска (alive, dead, location_known, not_found)
result_comment: Text - комментарий к результату

current_flyer_id: Integer FK(flyers.id) SET NULL - актуальная ориентировка
status: Enum(planned, active, completed, cancelled) - статус
notes: Text - примечания
```

**Результаты поиска (result):**
- `alive` - найден живым (Живий)
- `dead` - найден мертвым (Мертвий)
- `location_known` - местонахождение установлено (Місцезнаходження відомо)
- `not_found` - не найден (Не знайдений)

**Статусы поиска (status):**
- `planned` - запланирован (Запланований)
- `active` - активный (Активний)
- `completed` - завершен (Завершений)
- `cancelled` - отменен (Скасований)

**Автоматика:**
- При установке result = 'alive', 'dead' или 'location_known' статус автоматически меняется на 'completed'
- Реализовано в `backend/app/routers/searches.py:update_search()`

**Индексы:** case_id, initiator_inforg_id, result, status

#### 6. field_searches (Выезды на местность)

```sql
id: Integer (PK)
search_id: Integer FK(searches.id) CASCADE - поисковая операция (НЕ case_id!)
created_at: DateTime(TZ) - дата создания
initiator_inforg_id: Integer FK(users.id) SET NULL - кто создал

start_date: Date - дата начала
flyer_id: Integer FK(flyers.id) SET NULL - ориентировка для раздачи
meeting_datetime: DateTime(TZ) - дата/время сбора
meeting_place: String(500) - место сбора
coordinator_id: Integer FK(users.id) SET NULL - координатор выезда

status: Enum(planning, prepared, active, completed, cancelled) - статус
end_date: Date - дата окончания
result: String - результат (alive, dead, location_known, not_found)
notes: Text - примечания
```

**Статусы:**
- `planning` - планируется (Планування)
- `prepared` - подготовлен (Підготовлено)
- `active` - активный (Активний)
- `completed` - завершен (Завершений)
- `cancelled` - отменен (Скасований)

**Computed property:**
- `case_id` - вычисляется через relationship с Search: `return self.search.case_id if self.search else None`

**Связи:**
- Many-to-many с `users` через `field_search_participants` (участники)

**Индексы:** search_id, coordinator_id, status

**Важно:** FieldSearch создается только в контексте конкретного Search, маршрут `/searches/{id}/create-field-search`

#### 7. field_search_participants (Участники выезда)

```sql
id: Integer (PK)
field_search_id: Integer FK(field_searches.id) CASCADE
user_id: Integer FK(users.id) CASCADE
role_on_field: String(50) - роль (coordinator, navigator, searcher, driver)
group_name: String(50) - название группы (Group A, Group B, etc.)
```

#### 8-12. Остальные таблицы (НЕ РЕАЛИЗОВАНЫ)

- **flyers** (ориентировки) - НЕ РЕАЛИЗОВАНО
- **distributions** (рассылки) - НЕ РЕАЛИЗОВАНО
- **map_grids** (карты местности) - НЕ РЕАЛИЗОВАНО
- **grid_cells** (квадраты сетки) - НЕ РЕАЛИЗОВАНО
- **institutions_calls** (прозвоны учреждений) - НЕ РЕАЛИЗОВАНО

---

## Backend API

### Структура проекта

```
backend/
├── app/
│   ├── core/
│   │   └── logging_config.py      # Настройка логирования
│   ├── middleware/
│   │   ├── error_handler.py       # Обработка ошибок
│   │   └── logging_middleware.py  # Логирование запросов
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py                # User, Role, Direction, user_roles, user_directions
│   │   ├── case.py                # Case, CaseStatus
│   │   ├── search.py              # Search, SearchStatus
│   │   ├── field_search.py        # FieldSearch, FieldSearchStatus, field_search_participants
│   │   ├── flyer.py               # Flyer (НЕ РЕАЛИЗОВАНО)
│   │   ├── distribution.py        # Distribution (НЕ РЕАЛИЗОВАНО)
│   │   ├── map_grid.py            # MapGrid, GridCell (НЕ РЕАЛИЗОВАНО)
│   │   └── institutions_call.py   # InstitutionsCall (НЕ РЕАЛИЗОВАНО)
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py                # POST /auth/register, /login, GET /me
│   │   ├── cases.py               # CRUD для заявок ✅
│   │   ├── searches.py            # CRUD для поисков ✅
│   │   ├── field_searches.py      # CRUD для выездов ✅
│   │   ├── users.py               # Управление пользователями ✅
│   │   ├── roles.py               # Управление ролями ✅
│   │   ├── directions.py          # Управление направлениями ✅
│   │   ├── dashboard.py           # GET /dashboard/stats ✅
│   │   ├── upload.py              # POST /upload/images, DELETE /upload/images/{filename} ✅
│   │   ├── flyers.py              # CRUD для ориентировок (НЕ РЕАЛИЗОВАНО)
│   │   ├── distributions.py       # CRUD для рассылок (НЕ РЕАЛИЗОВАНО)
│   │   ├── map_grids.py           # CRUD для карт (НЕ РЕАЛИЗОВАНО)
│   │   └── institutions_calls.py  # CRUD для прозвонов (НЕ РЕАЛИЗОВАНО)
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py                # UserCreate, UserLogin, Token, UserResponse, UserBrief, CaseBrief
│   │   ├── case.py                # CaseCreate, CaseUpdate, CaseResponse, CaseFullResponse
│   │   ├── search.py              # SearchCreate, SearchUpdate, SearchResponse, SearchFullResponse
│   │   ├── field_search.py        # FieldSearchCreate, FieldSearchUpdate, FieldSearchResponse, SearchBrief
│   │   └── остальные (НЕ РЕАЛИЗОВАНЫ)
│   ├── services/
│   │   ├── __init__.py
│   │   └── auth_service.py        # JWT, хеширование паролей
│   ├── db.py                      # Настройка БД, SessionLocal, Base, get_db()
│   └── main.py                    # FastAPI приложение, startup event, CORS, routes
├── tests/                         # Тесты (НЕ РЕАЛИЗОВАНЫ)
├── logs/                          # Логи
├── create_admin.py                # Скрипт создания админа
└── requirements.txt
```

### API Endpoints (РЕАЛИЗОВАНО)

#### Аутентификация ✅

- `POST /auth/register` - регистрация пользователя (создается со статусом 'pending')
- `POST /auth/login` - вход (получение JWT токена)
- `GET /auth/me` - получение данных текущего пользователя с ролями и направлениями
- `PUT /auth/change-password` - смена пароля

#### Заявки (Cases) ✅

- `POST /cases/` - создать заявку (инвалидирует dashboard-stats)
- `GET /cases/` - список заявок (пагинация, фильтр по decision_type)
- `GET /cases/{id}` - получить заявку
- `GET /cases/{id}/full` - получить заявку со связанными searches
- `PUT /cases/{id}` - обновить заявку (инвалидирует dashboard-stats)
- `DELETE /cases/{id}` - удалить заявку

#### Поиски (Searches) ✅

- `POST /searches/` - создать поиск (автоматически меняет decision_type Case на "Пошук", инвалидирует dashboard-stats)
- `GET /searches/` - список поисков (пагинация, фильтры по status, result, case_id)
- `GET /searches/{id}` - получить поиск с eager loading (case, initiator_inforg)
- `GET /searches/{id}/full` - получить поиск со всеми field_searches
- `PUT /searches/{id}` - обновить поиск (автоматически меняет статус на 'completed' при result='alive/dead/location_known', инвалидирует dashboard-stats)
- `DELETE /searches/{id}` - удалить поиск

#### Выезды на местность (Field Searches) ✅

- `POST /field_searches/` - создать выезд (требует search_id, инвалидирует dashboard-stats)
- `GET /field_searches/` - список выездов (пагинация, фильтры по status, case_id с join через search)
- `GET /field_searches/{id}` - получить выезд с eager loading (search.case, initiator_inforg, coordinator)
- `PUT /field_searches/{id}` - обновить выезд (инвалидирует dashboard-stats)
- `DELETE /field_searches/{id}` - удалить выезд
- `POST /field_searches/{id}/participants` - добавить участников
- `GET /field_searches/{id}/participants` - получить список участников
- `DELETE /field_searches/{id}/participants/{user_id}` - удалить участника

#### Загрузка файлов (Upload) ✅

- `POST /upload/images` - загрузить изображения (до 10 файлов, макс 10 МБ каждый)
  - Разрешенные форматы: jpg, jpeg, png, gif, webp
  - Генерирует UUID имена файлов
  - Возвращает массив URL: `["/uploads/uuid1.jpg", ...]`
- `DELETE /upload/images/{filename}` - удалить изображение
- `GET /uploads/{filename}` - получить загруженный файл (StaticFiles middleware)

#### Пользователи, роли, направления ✅

- `GET /users/` - список пользователей (пагинация, фильтр по status)
- `GET /users/{id}` - получить пользователя с ролями и направлениями
- `PUT /users/{id}` - обновить пользователя (status, comment, role_ids, direction_ids)
- `GET /roles/` - список ролей
- `POST /roles/` - создать роль
- `PUT /roles/{id}` - обновить роль
- `DELETE /roles/{id}` - удалить роль
- `GET /directions/` - список направлений
- `POST /directions/` - создать направление
- `PUT /directions/{id}` - обновить направление
- `DELETE /directions/{id}` - удалить направление

#### Статистика ✅

- `GET /dashboard/stats` - агрегированная статистика:
  - Количество заявок по статусам
  - Количество поисков по статусам
  - Количество выездов по статусам
  - Количество рассылок по статусам (пока 0)
  - Количество пользователей
  - Количество прозвонов (пока 0)

#### Health Checks ✅

- `GET /health` - health check
- `GET /db-check` - проверка подключения к БД

### Важные паттерны Backend

#### 1. Eager Loading для предотвращения N+1 запросов

```python
# В searches.py
query = db.query(Search).options(
    joinedload(Search.case),
    joinedload(Search.initiator_inforg)
)

# В field_searches.py
query = db.query(FieldSearch).options(
    joinedload(FieldSearch.search).joinedload(Search.case),
    joinedload(FieldSearch.initiator_inforg),
    joinedload(FieldSearch.coordinator)
)
```

#### 2. Избежание циклических импортов

Общие схемы (UserBrief, CaseBrief) вынесены в `auth.py`:

```python
# backend/app/schemas/auth.py
class UserBrief(BaseModel):
    id: int
    full_name: str

class CaseBrief(BaseModel):
    id: int
    missing_full_name: str
```

#### 3. Автоматические действия в роутерах

```python
# При создании Search автоматически меняем decision_type Case
if case.decision_type != "Пошук":
    db.query(Case).filter(Case.id == case_id).update(
        {"decision_type": "Пошук", "updated_by_user_id": current_user.id}
    )

# При обновлении Search автоматически меняем статус на completed
if "result" in update_data and update_data["result"] in ["alive", "dead", "location_known"]:
    update_data["status"] = SearchStatus.completed
```

#### 4. Enum statuses

Используем Python Enum → SQLAlchemy Enum:

```python
class SearchStatus(str, enum.Enum):
    planned = "planned"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"
```

Конвертация в роутерах:

```python
# Parse string to enum
if search_data.status:
    try:
        status_enum = SearchStatus[search_data.status]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Invalid status")
```

#### 5. Обновление updated_by и updated_at

При обновлении Case автоматически устанавливается:

```python
case.updated_at = datetime.utcnow()
case.updated_by_user_id = current_user.id
```

---

## Frontend PWA

### Структура проекта

```
frontend/
├── public/
│   ├── manifest.json              # PWA манифест
│   └── icons/                     # Иконки PWA (различные размеры)
├── src/
│   ├── api/
│   │   ├── client.ts              # Axios instance с JWT interceptors
│   │   ├── auth.ts                # API для аутентификации ✅
│   │   ├── cases.ts               # API для заявок ✅
│   │   ├── searches.ts            # API для поисков ✅
│   │   ├── field-searches.ts      # API для выездов ✅
│   │   ├── users.ts               # API для пользователей ✅
│   │   ├── roles.ts               # API для ролей ✅
│   │   ├── directions.ts          # API для направлений ✅
│   │   ├── dashboard.ts           # API для статистики ✅
│   │   └── upload.ts              # API для загрузки файлов ✅
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx         # Шапка с кнопкой "назад" и заголовком
│   │   │   └── BottomNav.tsx      # Нижняя навигация (Главная, Заявки, Пошуки, Виїзди, Профіль)
│   │   └── ui/                    # UI компоненты
│   │       ├── Button.tsx         # Кнопки с вариантами (primary, outline, ghost)
│   │       ├── Input.tsx          # Поля ввода с валидацией и ошибками
│   │       ├── Card.tsx           # Card, CardHeader, CardTitle, CardContent
│   │       ├── Badge.tsx          # Цветные бейджи для статусов
│   │       ├── Loading.tsx        # Индикатор загрузки
│   │       └── Container.tsx      # Контейнер с padding
│   ├── pages/
│   │   ├── LoginPage.tsx          # Вход в систему ✅
│   │   ├── RegisterPage.tsx       # Регистрация ✅
│   │   ├── DashboardPage.tsx      # Главная страница со статистикой ✅
│   │   ├── ProfilePage.tsx        # Профиль пользователя ✅
│   │   ├── SettingsPage.tsx       # Настройки ✅
│   │   ├── RolesManagementPage.tsx         # Управление ролями ✅
│   │   ├── DirectionsManagementPage.tsx    # Управление направлениями ✅
│   │   │
│   │   ├── CasesListPage.tsx      # Список заявок с фильтрами ✅
│   │   ├── CaseDetailsPage.tsx    # Детали заявки со связанными поисками ✅
│   │   ├── CreateCasePage.tsx     # Создание заявки с загрузкой фото ✅
│   │   ├── EditCasePage.tsx       # Редактирование заявки ✅
│   │   │
│   │   ├── SearchListPage.tsx     # Список поисков с фильтрами (status, result) ✅
│   │   ├── SearchDetailsPage.tsx  # Детали поиска со связанными выездами ✅
│   │   ├── CreateSearchPage.tsx   # Создание поиска (из заявки) ✅
│   │   ├── EditSearchPage.tsx     # Редактирование поиска ✅
│   │   │
│   │   ├── FieldSearchListPage.tsx        # Список выездов с фильтрами ✅
│   │   ├── FieldSearchDetailsPage.tsx     # Детали выезда ✅
│   │   ├── CreateFieldSearchPage.tsx      # Создание выезда (из поиска) ✅
│   │   ├── EditFieldSearchPage.tsx        # Редактирование выезда ✅
│   │   │
│   │   ├── UsersListPage.tsx      # Список пользователей ✅
│   │   └── UserDetailsPage.tsx    # Детали пользователя ✅
│   ├── store/
│   │   └── authStore.ts           # Zustand store для auth (token, user, persistence в localStorage)
│   ├── types/
│   │   └── api.ts                 # TypeScript типы для всех API ответов
│   ├── utils/
│   │   └── formatters.ts          # formatDate, formatDateTime
│   ├── App.tsx                    # Главный компонент с routing
│   ├── main.tsx                   # Точка входа с TanStack Query provider
│   └── index.css                  # Глобальные стили + Tailwind directives
├── package.json
├── tsconfig.json
├── vite.config.ts                 # Vite с PWA plugin
└── tailwind.config.js             # TailwindCSS с кастомной темой
```

### Навигационная структура

```
/ (Dashboard) - главная со статистикой
├── /cases - список заявок
│   ├── /cases/new - создание заявки
│   ├── /cases/:id - детали заявки
│   │   └── /cases/:caseId/create-search - создать поиск для заявки
│   └── /cases/:id/edit - редактирование заявки
│
├── /searches - список поисков
│   ├── /searches/:id - детали поиска
│   │   └── /searches/:id/create-field-search - создать выезд для поиска
│   └── /searches/:id/edit - редактирование поиска
│
├── /field-searches - список выездов
│   ├── /field-searches/:id - детали выезда
│   └── /field-searches/:id/edit - редактирование выезда
│
├── /profile - профиль пользователя
├── /users - список пользователей
│   └── /users/:id - детали пользователя
│
└── /settings - настройки
    ├── /settings/roles - управление ролями
    └── /settings/directions - управление направлениями
```

### Важные паттерны Frontend

#### 1. Инвалидация кеша dashboard-stats

При любых изменениях, влияющих на статистику, нужно инвалидировать кеш:

```typescript
onSuccess: (data) => {
  queryClient.invalidateQueries({ queryKey: ['cases'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }); // ← ВАЖНО!
  navigate(`/cases/${data.id}`);
},
```

Это реализовано в:
- `CreateCasePage.tsx`
- `EditCasePage.tsx`
- `CreateSearchPage.tsx`
- `EditSearchPage.tsx`
- `CreateFieldSearchPage.tsx`
- `EditFieldSearchPage.tsx`

#### 2. Eager loading данных через relationships

В API клиенте используются правильные типы со вложенными объектами:

```typescript
// frontend/src/types/api.ts
export interface Search {
  id: number;
  case_id: number;
  case: {
    id: number;
    missing_full_name: string;
  } | null;
  initiator_inforg: UserBrief | null;
  // ...
}

export interface FieldSearch {
  search: {
    id: number;
    case_id: number;
    case: {
      id: number;
      missing_full_name: string;
    } | null;
  } | null;
  // ...
}
```

#### 3. Терминология "Зниклий" вместо "Пропавший"

Везде в UI используется украинская терминология:
- "Зниклий" (не "Пропавший")
- Все UI элементы на украинском языке

#### 4. Цветовая кодировка статусов и результатов

Используется функция `getStatusBadgeVariant()`:

```typescript
// В UI компонентах
<Badge variant={getStatusBadgeVariant(status)}>
  {statusLabel}
</Badge>
```

Для выездов на местность применяется цветовое кодирование фона карточек:
- `result === 'alive'` → зеленый фон (bg-green-100)
- `result === 'dead'` → серый фон (bg-gray-300)
- `result === 'not_found'` → белый фон (bg-white)

#### 5. Разделение queryKey для кеширования

```typescript
// Для списка
queryKey: ['cases']
queryKey: ['searches']
queryKey: ['field-searches']

// Для деталей (brief)
queryKey: ['case', id]
queryKey: ['search', id]
queryKey: ['field-search', id]

// Для полных данных (с relationships)
queryKey: ['case-full', id]
queryKey: ['search-full', id]

// Для статистики
queryKey: ['dashboard-stats']
```

#### 6. Формы с предзаполнением данных

Для Edit страниц используется `values` в useForm:

```typescript
const { register, handleSubmit } = useForm<EditForm>({
  values: searchData ? {
    // Предзаполняем форму данными с сервера
    initiator_inforg_id: searchData.initiator_inforg_id?.toString() || '',
    // ...
  } : undefined,
});
```

#### 7. Конвертация пустых строк в undefined

Перед отправкой на сервер:

```typescript
const cleanedData: any = {};
for (const [key, value] of Object.entries(data)) {
  if (value === '') {
    cleanedData[key] = undefined; // Пустые строки → undefined
  } else {
    cleanedData[key] = value;
  }
}
```

#### 8. Защищенные и публичные маршруты

```typescript
// Защищенные маршруты - требуют авторизации
function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}<BottomNav /></>;
}

// Публичные маршруты - перенаправляют авторизованных на главную
function PublicRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
```

---

## Реализованный функционал

### ✅ Полностью реализовано

#### 1. Аутентификация и авторизация
- Регистрация пользователей (статус 'pending' по умолчанию)
- Вход с JWT токенами
- Защита endpoints через `get_current_user()`
- Проверка ролей через `require_role()`
- Хранение токена в localStorage
- Автоматическое добавление токена в заголовки запросов (Axios interceptor)
- Профиль пользователя с ролями и направлениями

#### 2. Заявки (Cases)
- ✅ Создание заявки с множественными фото
- ✅ Редактирование заявки
- ✅ Список заявок с пагинацией
- ✅ Фильтрация по decision_type ("На розгляді", "Пошук", "Відмова")
- ✅ Детали заявки со связанными searches
- ✅ Удаление заявки
- ✅ Отслеживание создателя и редактора
- ✅ Разделенные поля ФИО (last_name, first_name, middle_name)
- ✅ Поля локации (settlement, region, address)
- ✅ Дополнительные поля (телефон зниклого, одежда, что с собой, области поиска, тип местности, обстоятельства, заява до поліції)
- ✅ Загрузка и управление множественными фотографиями

#### 3. Поиски (Searches)
- ✅ Создание поиска из заявки (маршрут `/cases/:caseId/create-search`)
- ✅ Автоматическое изменение decision_type заявки на "Пошук" при создании поиска
- ✅ Редактирование поиска
- ✅ Список поисков с пагинацией
- ✅ Фильтрация по статусу (planned, active, completed, cancelled)
- ✅ Фильтрация по результату (alive, dead, location_known, not_found)
- ✅ Автоматическое изменение статуса на 'completed' при установке result='alive'/'dead'/'location_known'
- ✅ Детали поиска со связанными field_searches
- ✅ Удаление поиска
- ✅ Отображение зниклого (missing_full_name) в карточках

#### 4. Выезды на местность (Field Searches)
- ✅ Создание выезда из поиска (маршрут `/searches/:id/create-field-search`)
- ✅ Привязка к Search (не к Case!)
- ✅ Вычисляемое свойство case_id через relationship
- ✅ Редактирование выезда
- ✅ Список выездов с пагинацией
- ✅ Фильтрация по статусу (planning, prepared, active, completed, cancelled)
- ✅ Фильтрация по case_id (через join с searches)
- ✅ Детали выезда
- ✅ Удаление выезда
- ✅ Управление участниками (add/remove через API endpoints)
- ✅ Цветовое кодирование карточек по результату (зеленый/серый/белый)
- ✅ Отображение зниклого (missing_full_name) в карточках

#### 5. Пользователи и роли
- ✅ Список пользователей с пагинацией и фильтрацией по статусу
- ✅ Детали пользователя с ролями и направлениями
- ✅ Редактирование пользователя (статус, комментарий, роли, направления)
- ✅ Управление ролями (создание, редактирование, удаление, иерархия)
- ✅ Управление направлениями (создание, редактирование, удаление, ответственный)

#### 6. Статистика Dashboard
- ✅ Агрегированная статистика по заявкам, поискам, выездам
- ✅ Автоматическое обновление при изменениях (инвалидация кеша)
- ✅ Навигация на списки по клику на карточки статистики

#### 7. Загрузка файлов
- ✅ Загрузка до 10 изображений за раз
- ✅ Валидация типа (jpg, jpeg, png, gif, webp)
- ✅ Валидация размера (макс 10 МБ)
- ✅ Генерация UUID имен
- ✅ Хранение в Docker volume `uploads_data`
- ✅ Отображение загруженных фото в UI
- ✅ Удаление фото

#### 8. PWA Features
- ✅ Манифест с иконками
- ✅ Service Worker для offline работы
- ✅ Responsive design (mobile-first)
- ✅ Нижняя навигация для мобильных
- ✅ Touch-friendly интерфейс

---

## Планируемый функционал

### ❌ НЕ реализовано (требуется разработка)

#### 1. Ориентировки (Flyers)
- Создание ориентировок для поиска
- Загрузка фото и PDF файлов
- Версионирование ориентировок
- Установка текущей (актуальной) ориентировки для поиска
- Связь с выездами (какую ориентировку раздавать)

**Требуется:**
- Backend: `backend/app/routers/flyers.py`
- Backend: `backend/app/schemas/flyer.py`
- Frontend: `FlyersListPage.tsx`, `FlyerDetailsPage.tsx`, `CreateFlyerPage.tsx`, `EditFlyerPage.tsx`
- Frontend: `frontend/src/api/flyers.ts`

#### 2. Рассылки ориентировок (Distributions)
- Создание рассылки для поиска
- Выбор ориентировки для рассылки
- Указание населенных пунктов (текст)
- Выбор каналов рассылки (telegram, viber, facebook, instagram, email)
- Отслеживание статуса рассылки
- Добавление комментария о результате

**Требуется:**
- Backend: `backend/app/routers/distributions.py`
- Backend: `backend/app/schemas/distribution.py`
- Frontend: `DistributionsListPage.tsx`, `DistributionDetailsPage.tsx`, `CreateDistributionPage.tsx`, `EditDistributionPage.tsx`
- Frontend: `frontend/src/api/distributions.ts`

#### 3. Карты местности с сеткой (Map Grids)
- Создание карты местности для поиска
- Загрузка файла карты
- Указание координат штаба и центра
- Указание размера ячеек сетки
- Создание ячеек сетки с кодами (A1, B2, etc.)
- Назначение ячеек на выезды
- Отслеживание статуса обследования ячеек
- Визуализация сетки на карте

**Требуется:**
- Backend: `backend/app/routers/map_grids.py`
- Backend: `backend/app/schemas/map_grid.py`
- Frontend: `MapGridsListPage.tsx`, `MapGridDetailsPage.tsx`, `CreateMapGridPage.tsx`, `EditMapGridPage.tsx`
- Frontend: `frontend/src/api/map-grids.ts`
- Frontend: Компонент визуализации карты (возможно с Leaflet/OpenLayers)

#### 4. Прозвоны учреждений (Institutions Calls)
- Создание записи о звонке в учреждение для заявки
- Указание названия организации и типа
- Указание телефона
- Фиксация результата звонка
- История прозвонов по заявке

**Требуется:**
- Backend: `backend/app/routers/institutions_calls.py`
- Backend: `backend/app/schemas/institutions_call.py`
- Frontend: `InstitutionsCallsListPage.tsx`, `InstitutionsCallDetailsPage.tsx`, `CreateInstitutionsCallPage.tsx`, `EditInstitutionsCallPage.tsx`
- Frontend: `frontend/src/api/institutions-calls.ts`
- Frontend: Раздел в CaseDetailsPage для отображения прозвонов

#### 5. Дополнительные функции

##### 5.1. Система уведомлений
- Push-уведомления для важных событий
- Email-уведомления
- Telegram-уведомления
- Настройка предпочтений уведомлений

##### 5.2. Экспорт данных
- Экспорт заявок в Excel/PDF
- Экспорт отчетов по поискам
- Статистика за период

##### 5.3. Расширенная статистика
- Графики по результатам поисков
- Карта с геолокацией заявок
- Аналитика по эффективности поисков
- Отчеты по волонтерам

##### 5.4. Комментарии и чат
- Комментарии к заявкам
- Комментарии к поискам и выездам
- Внутренний чат для координации

##### 5.5. Календарь событий
- Календарь выездов на местность
- Напоминания о предстоящих выездах
- Синхронизация с Google Calendar

##### 5.6. Продвинутый поиск
- Полнотекстовый поиск по заявкам
- Поиск по множественным критериям
- Сохраненные фильтры

##### 5.7. Аудит и история изменений
- Логирование всех изменений в БД
- История редактирования записей
- Просмотр кто и когда изменил данные

##### 5.8. Шаблоны ориентировок
- Конструктор ориентировок
- Сохраненные шаблоны
- Автозаполнение данными из заявки

##### 5.9. Интеграции
- Интеграция с Telegram Bot API
- Интеграция с email сервисами
- Интеграция с картографическими сервисами

---

## Ключевые паттерны и решения

### 1. Архитектура и сборка

**Проблема:** Как организовать development и production окружения?

**Решение:**
- Код фронтенда и бэкенда **собирается в Docker образ** (НЕ монтируется как volume)
- При любых изменениях в коде нужно пересобирать: `docker-compose build milenacrm && docker-compose up -d`
- База данных в отдельном контейнере с volume для персистентности
- Загруженные файлы в Docker volume `uploads_data:/app/uploads`

### 2. Связь Field Searches с Searches, а не с Cases

**Проблема:** Изначально field_searches были привязаны к cases напрямую, но это неправильно логически.

**Решение:**
- FieldSearch.search_id → Search
- Добавлено computed property `case_id` в модели FieldSearch
- Маршрут создания: `/searches/:id/create-field-search` (НЕ `/field-searches/new`)
- При запросе списка выездов с фильтром по case_id используется join через searches

**Почему это важно:** Один search может иметь несколько field_searches. Это позволяет организовать несколько выездов в рамках одной поисковой операции.

### 3. Автоматические действия при создании/обновлении

**3.1. При создании Search**
- Автоматически устанавливается `decision_type = "Пошук"` для связанной заявки
- Обновляется `updated_by_user_id` заявки
- Реализовано в `backend/app/routers/searches.py:create_search()`

**3.2. При обновлении Search**
- Если result устанавливается в 'alive', 'dead' или 'location_known', статус автоматически меняется на 'completed'
- Реализовано в `backend/app/routers/searches.py:update_search()`

### 4. Инвалидация кеша TanStack Query

**Проблема:** После мутаций данные не обновляются на других страницах без перезагрузки.

**Решение:** Инвалидировать все связанные кеши после успешной мутации:

```typescript
onSuccess: (data) => {
  // Инвалидируем список
  queryClient.invalidateQueries({ queryKey: ['searches'] });

  // Инвалидируем конкретную запись
  queryClient.invalidateQueries({ queryKey: ['search', id] });
  queryClient.invalidateQueries({ queryKey: ['search-full', id] });

  // Инвалидируем связанные данные
  queryClient.invalidateQueries({ queryKey: ['case-full', caseId] });

  // КРИТИЧЕСКИ ВАЖНО: инвалидируем dashboard
  queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

  navigate(`/searches/${data.id}`);
},
```

**Где реализовано:**
- CreateCasePage, EditCasePage
- CreateSearchPage, EditSearchPage
- CreateFieldSearchPage, EditFieldSearchPage

### 5. Eager loading для предотвращения N+1 запросов

**Проблема:** При загрузке списка searches делается N дополнительных запросов для case и initiator_inforg.

**Решение:** Использовать joinedload в SQLAlchemy:

```python
query = db.query(Search).options(
    joinedload(Search.case),
    joinedload(Search.initiator_inforg)
)
```

**Для вложенных relationships:**

```python
query = db.query(FieldSearch).options(
    joinedload(FieldSearch.search).joinedload(Search.case),  # Вложенный join
    joinedload(FieldSearch.initiator_inforg),
    joinedload(FieldSearch.coordinator)
)
```

### 6. Избежание циклических импортов

**Проблема:** CaseBrief нужен в search.py, но case.py импортирует из search.py → циклический импорт.

**Решение:** Общие brief схемы вынести в `auth.py`:

```python
# backend/app/schemas/auth.py
class UserBrief(BaseModel):
    """Краткая информация о пользователе (для relationships)"""
    id: int
    full_name: str

class CaseBrief(BaseModel):
    """Краткая информация о заявке (для relationships)"""
    id: int
    missing_full_name: str
```

Теперь все модули могут импортировать из auth.py без циклов.

### 7. Enum статусы: конвертация string ↔ Enum

**Backend:**

```python
# Модель использует Enum
class Search(Base):
    status = Column(SQLEnum(SearchStatus), default=SearchStatus.planned)

# Схема использует string
class SearchCreate(BaseModel):
    status: Optional[str] = "planned"

# Роутер конвертирует string → Enum
if search_data.status:
    try:
        status_enum = SearchStatus[search_data.status]
    except KeyError:
        raise HTTPException(status_code=400, detail="Invalid status")
```

**Frontend:**

```typescript
// Отправляем как string
const data = { status: "completed" };

// Получаем как string (благодаря use_enum_values=True в Pydantic)
interface Search {
  status: string; // "planned" | "active" | "completed" | "cancelled"
}
```

### 8. Конвертация пустых строк в undefined/null

**Проблема:** React Hook Form возвращает пустые строки для необязательных полей, а API ожидает null или отсутствие поля.

**Решение:** Очистка данных перед отправкой:

```typescript
const cleanedData: any = {};
for (const [key, value] of Object.entries(formData)) {
  if (value === '') {
    cleanedData[key] = undefined; // Пустые строки → undefined
  } else {
    cleanedData[key] = value;
  }
}
```

### 9. Computed properties для полных имен

**Backend:**

```python
class Case(Base):
    applicant_last_name = Column(String(100))
    applicant_first_name = Column(String(100))
    applicant_middle_name = Column(String(100))

    @property
    def applicant_full_name(self) -> str:
        parts = [self.applicant_last_name, self.applicant_first_name]
        if self.applicant_middle_name:
            parts.append(self.applicant_middle_name)
        return ' '.join(parts)
```

**Frontend:**

```typescript
// API автоматически возвращает computed property
interface Case {
  applicant_last_name: string;
  applicant_first_name: string;
  applicant_middle_name: string | null;
  applicant_full_name: string; // Computed
  missing_full_name: string; // Computed
}
```

### 10. Разделение queryKey для разных типов запросов

```typescript
// Список (без relationships)
queryKey: ['searches']

// Одна запись (brief с основными relationships)
queryKey: ['search', id]

// Полная запись (со всеми relationships)
queryKey: ['search-full', id]

// Статистика
queryKey: ['dashboard-stats']
```

Это позволяет инвалидировать только нужные части кеша.

### 11. Терминология на украинском языке

**Важно:** Везде в UI используется:
- "Зниклий" (НЕ "Пропавший")
- "Виїзди на місцевість"
- "Пошуки"
- "Заявки"

### 12. Цветовое кодирование результатов

В списках выездов карточки окрашиваются по результату:

```typescript
let bgColor = 'bg-white';
if (fieldSearch.result === 'alive') {
  bgColor = 'bg-green-100'; // Зеленый = найден живым
} else if (fieldSearch.result === 'dead') {
  bgColor = 'bg-gray-300'; // Серый = найден мертвым
}
```

### 13. База данных без миграций

**Важно:** Проект НЕ использует Alembic или другие инструменты миграций.

**При добавлении новых полей в модели:**

```bash
# 1. Обновить модель в backend/app/models/
# 2. Выполнить ALTER TABLE вручную
docker exec milenacrm-db-1 psql -U crm_user -d crm -c "
  ALTER TABLE searches
  ADD COLUMN IF NOT EXISTS new_field VARCHAR(100);
"

# 3. Пересобрать контейнер
docker-compose build milenacrm && docker-compose up -d
```

**При добавлении новых Enum значений:**

```bash
docker exec milenacrm-db-1 psql -U crm_user -d crm -c "
  ALTER TYPE fieldsearchstatus ADD VALUE IF NOT EXISTS 'prepared' BEFORE 'active';
"
```

---

## Запуск и развертывание

### Первый запуск

#### 1. Клонирование и настройка

```bash
git clone <repository-url>
cd MilenaCRM

# Скопировать и настроить .env
cp .env.example .env
# Отредактировать .env (установить пароли, secret keys)
```

#### 2. Генерация JWT Secret

```bash
# Linux/Mac
openssl rand -hex 32

# Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Добавить в `.env`:
```
JWT_SECRET_KEY=<сгенерированный_ключ>
DATABASE_URL=postgresql://crm_user:your_password@db:5432/crm
POSTGRES_PASSWORD=your_password
POSTGRES_USER=crm_user
POSTGRES_DB=crm
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:5174
```

#### 3. Запуск с Docker

```bash
# Запустить все сервисы
docker-compose up -d --build

# Проверить логи
docker-compose logs -f

# Проверить статус
docker-compose ps
```

#### 4. Создание администратора

```bash
docker exec milenacrm-milenacrm-1 python create_admin.py
```

Учетные данные по умолчанию:
- Email: `admin@example.com`
- Пароль: `admin123`

⚠️ **ВАЖНО:** Сменить пароль после первого входа!

#### 5. Проверка работоспособности

```bash
# Health check
curl http://localhost:8000/health

# Database check
curl http://localhost:8000/db-check

# Swagger UI
# Открыть в браузере: http://localhost:8000/docs

# Frontend
# Открыть в браузере: http://localhost:5174
```

### Разработка

**ВАЖНО:** Код собирается в Docker образ, а не монтируется как volume!

#### При изменении Backend кода:

```bash
# Пересобрать и перезапустить контейнер
docker-compose build milenacrm && docker-compose up -d

# Проверить логи
docker logs milenacrm-milenacrm-1 --tail 50
```

#### При изменении Frontend кода:

```bash
# Пересобрать и перезапустить контейнер
docker-compose build milenacrm && docker-compose up -d
```

#### Разработка вне Docker (опционально):

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
pip install -r requirements.txt

# Запустить только БД в Docker
docker-compose up db -d

# Запустить сервер
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Обновление схемы БД

**При добавлении нового поля:**

```bash
# 1. Добавить поле в модель (backend/app/models/)
# 2. Добавить в схемы (backend/app/schemas/)
# 3. Выполнить ALTER TABLE
docker exec milenacrm-db-1 psql -U crm_user -d crm -c "
  ALTER TABLE table_name
  ADD COLUMN IF NOT EXISTS field_name TYPE;
"

# 4. Пересобрать контейнер
docker-compose build milenacrm && docker-compose up -d
```

**При добавлении значения в Enum:**

```bash
docker exec milenacrm-db-1 psql -U crm_user -d crm -c "
  ALTER TYPE enum_name ADD VALUE IF NOT EXISTS 'new_value' BEFORE 'existing_value';
"
```

### Полезные команды

#### Docker

```bash
# Остановить все контейнеры
docker-compose down

# Остановить и удалить volumes (ОСТОРОЖНО!)
docker-compose down -v

# Пересобрать без кэша
docker-compose build --no-cache

# Посмотреть volumes
docker volume ls

# Логи конкретного контейнера
docker logs milenacrm-milenacrm-1 --tail 100 -f
```

#### База данных

```bash
# Подключиться к PostgreSQL
docker exec -it milenacrm-db-1 psql -U crm_user -d crm

# SQL команды
\dt                    # Список таблиц
\d table_name          # Структура таблицы
\d+ table_name         # Подробная структура
SELECT * FROM users;   # Запрос
\q                     # Выход

# Бэкап БД
docker exec milenacrm-db-1 pg_dump -U crm_user crm > backup_$(date +%Y%m%d).sql

# Восстановление БД
docker exec -i milenacrm-db-1 psql -U crm_user crm < backup_20241218.sql
```

### Troubleshooting

#### Изменения в коде не применяются

**Причина:** Код собирается в Docker образ, а не монтируется как volume.

**Решение:**
```bash
docker-compose build milenacrm && docker-compose up -d
```

#### Dashboard не обновляется после изменений

**Причина:** Не инвалидируется кеш `dashboard-stats`.

**Решение:** Добавить в onSuccess мутаций:
```typescript
queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
```

#### Ошибка "column does not exist"

**Причина:** Схема БД не синхронизирована с моделями.

**Решение:** Выполнить ALTER TABLE для добавления недостающих полей.

#### Ошибка "Invalid status/enum value"

**Причина:** Новое значение Enum не добавлено в БД.

**Решение:** Выполнить ALTER TYPE для добавления значения в enum.

#### Backend не запускается

```bash
# Проверить логи
docker-compose logs milenacrm

# Проверить переменные окружения
docker exec milenacrm-milenacrm-1 env | grep JWT

# Перезапустить
docker-compose restart milenacrm
```

---

## Контакты и поддержка

Для вопросов и предложений: support@example.com

## Лицензия

Private
