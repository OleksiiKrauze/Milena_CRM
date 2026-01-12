# Множественные пропавшие в одной заявке - Техническая документация

## Обзор проекта

Большое обновление системы для поддержки нескольких пропавших в одной заявке.

**Причина:** Пользователи создают заявки где пропало несколько человек одновременно (например, семья). Текущая система поддерживает только одного пропавшего на заявку.

**Решение:** Вынести данные пропавших в отдельную таблицу `missing_persons` с отношением one-to-many к `cases`.

---

## Статус проекта

**ТЕКУЩИЙ СТАТУС:** 🚧 В РАЗРАБОТКЕ - НЕ ДЕПЛОИТЬ НА PROD

- ✅ **Фаза 1 завершена** - База данных и модели (Commit: 505c50b)
- 🔄 **Фаза 2 в процессе** - Backend API
- ⏳ **Фаза 3 ожидает** - Frontend UI
- ⏳ **Фаза 4 ожидает** - OpenAI промпты

---

## Архитектура изменений

### До (старая структура):

```
Table: cases
├── missing_last_name        (один пропавший)
├── missing_first_name
├── missing_photos[]
├── missing_description
└── ... (все поля пропавшего в таблице cases)
```

### После (новая структура):

```
Table: cases
├── id
├── applicant_* fields
├── police_* fields
├── missing_* fields (LEGACY - сохранены для обратной совместимости)
└── relationship → missing_persons[]

Table: missing_persons
├── id
├── case_id (FK → cases.id, CASCADE DELETE)
├── order_index (для сортировки)
├── last_name
├── first_name
├── photos[]
├── description
└── ... (все данные пропавшего)
```

---

## ФАЗА 1: База данных и модели ✅

**Commit:** `505c50b` - "WIP: Add support for multiple missing persons - Phase 1"

### Что сделано:

#### 1. Модель `MissingPerson` (`backend/app/models/missing_person.py`)
```python
class MissingPerson(Base):
    __tablename__ = 'missing_persons'

    id = Column(Integer, primary_key=True)
    case_id = Column(Integer, ForeignKey('cases.id', ondelete='CASCADE'))

    # Личные данные
    last_name, first_name, middle_name
    gender, birthdate, phone

    # Адрес
    settlement, region, address

    # Где видели последний раз
    last_seen_datetime, last_seen_place

    # Описание
    photos[], description, special_signs
    diseases, clothing, belongings

    # Порядок отображения
    order_index = Column(Integer, default=0)
```

#### 2. Миграция (`backend/alembic/versions/007_add_missing_persons_table.py`)

**Создаёт таблицу:**
```sql
CREATE TABLE missing_persons (
    id SERIAL PRIMARY KEY,
    case_id INT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    last_name VARCHAR(100) NOT NULL,
    -- ... все поля
    order_index INT NOT NULL DEFAULT 0
);

CREATE INDEX ix_missing_persons_case_id ON missing_persons(case_id);
```

**Мигрирует данные:**
```sql
INSERT INTO missing_persons (case_id, last_name, first_name, ...)
SELECT id, missing_last_name, missing_first_name, ...
FROM cases
WHERE missing_first_name IS NOT NULL AND missing_last_name IS NOT NULL;
```

**Делает поля nullable:**
```sql
ALTER TABLE cases
    ALTER COLUMN missing_last_name DROP NOT NULL,
    ALTER COLUMN missing_first_name DROP NOT NULL;
```

#### 3. Обновлена модель `Case`

```python
# LEGACY поля - помечены но НЕ удалены!
missing_last_name = Column(String(100), nullable=True)  # Теперь nullable
missing_first_name = Column(String(100), nullable=True)
# ... остальные missing_* поля

# Новый relationship
missing_persons = relationship(
    'MissingPerson',
    back_populates='case',
    cascade='all, delete-orphan',
    order_by='MissingPerson.order_index'
)
```

#### 4. API схемы (`backend/app/schemas/missing_person.py`)

```python
class MissingPersonCreate(BaseModel):
    last_name: str
    first_name: str
    # ... все поля
    order_index: Optional[int] = 0

class MissingPersonUpdate(BaseModel):
    # Все поля Optional для частичного обновления

class MissingPerson(MissingPersonCreate):
    id: int
    case_id: int
```

### Безопасность миграции:

✅ **Данные НЕ удаляются** - копируются в новую таблицу
✅ **Старые поля сохранены** - можно откатить код и всё работает
✅ **Транзакционная миграция** - если упадёт, откатится
✅ **Cascade delete** - при удалении case удаляются и missing_persons

---

## ФАЗА 2: Backend API 🔄

**Статус:** В ПРОЦЕССЕ

### План работ:

#### 1. Обновить схемы Case (`backend/app/schemas/case.py`)

**Было:**
```python
class CaseCreate(BaseModel):
    missing_last_name: str  # Один пропавший
    missing_first_name: str
    missing_photos: List[str]
    # ...
```

**Станет:**
```python
class CaseCreate(BaseModel):
    # LEGACY поля - для обратной совместимости (опциональные)
    missing_last_name: Optional[str] = None
    missing_first_name: Optional[str] = None
    # ...

    # НОВЫЕ поля
    missing_persons: List[MissingPersonCreate] = []  # Массив пропавших!
```

**CaseFull (response):**
```python
class CaseFull(BaseModel):
    id: int
    # ... все поля case
    missing_persons: List[MissingPerson] = []  # Массив пропавших
```

#### 2. Обновить роутер `cases.py` (`backend/app/routers/cases.py`)

**CREATE case:**
```python
@router.post("/")
def create_case(case_data: CaseCreate):
    # 1. Создать case
    db_case = Case(
        applicant_last_name=case_data.applicant_last_name,
        # ... поля case (БЕЗ missing_* полей)
    )
    db.add(db_case)
    db.flush()  # Получить case.id

    # 2. Создать missing_persons
    for i, mp_data in enumerate(case_data.missing_persons):
        missing_person = MissingPerson(
            case_id=db_case.id,
            order_index=i,
            **mp_data.dict()
        )
        db.add(missing_person)

    # 3. Для обратной совместимости: если есть legacy поля, создать из них
    if case_data.missing_first_name and not case_data.missing_persons:
        missing_person = MissingPerson(
            case_id=db_case.id,
            order_index=0,
            last_name=case_data.missing_last_name,
            # ... legacy поля
        )
        db.add(missing_person)

    db.commit()
```

**UPDATE case:**
```python
@router.put("/{id}")
def update_case(id: int, case_data: CaseUpdate):
    # 1. Обновить case поля

    # 2. Если передан missing_persons, пересоздать
    if case_data.missing_persons is not None:
        # Удалить старых
        db.query(MissingPerson).filter_by(case_id=id).delete()

        # Создать новых
        for i, mp_data in enumerate(case_data.missing_persons):
            missing_person = MissingPerson(
                case_id=id,
                order_index=i,
                **mp_data.dict()
            )
            db.add(missing_person)

    db.commit()
```

**GET case (full):**
```python
@router.get("/{id}/full")
def get_case_full(id: int):
    case = db.query(Case).options(
        joinedload(Case.missing_persons)  # Подгрузить пропавших
    ).get(id)

    return case  # Pydantic автоматически сериализует missing_persons
```

#### 3. Обновить автозаполнение (`backend/app/services/openai_service.py`)

Пока оставим как есть, обновим в Фазе 4.

---

## ФАЗА 3: Frontend UI ⏳

### План работ:

#### 1. Обновить TypeScript типы (`frontend/src/types/api.ts`)

```typescript
interface MissingPerson {
  id?: number;
  last_name: string;
  first_name: string;
  middle_name?: string;
  gender?: string;
  birthdate?: string;
  photos?: string[];
  last_seen_datetime?: string;
  last_seen_place?: string;
  description?: string;
  special_signs?: string;
  diseases?: string;
  phone?: string;
  clothing?: string;
  belongings?: string;
  order_index: number;
}

interface Case {
  id: number;
  // ... applicant и другие поля
  missing_persons: MissingPerson[];  // Массив!
}

interface CaseCreate {
  // ... applicant поля
  missing_persons: Omit<MissingPerson, 'id'>[];
}
```

#### 2. CreateCasePage - динамические блоки

**UI Structure:**
```tsx
<form>
  {/* Заявник */}
  <Card>...</Card>

  {/* Зниклі (множественные блоки) */}
  {missingPersons.map((person, index) => (
    <Card key={index}>
      <CardHeader>
        <CardTitle>Зниклий #{index + 1}</CardTitle>
        {index > 0 && (
          <Button onClick={() => removeMissingPerson(index)}>
            Видалити
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {/* Все поля пропавшего */}
        <Input name={`missing_persons.${index}.first_name`} />
        <Input name={`missing_persons.${index}.last_name`} />
        {/* ... */}
      </CardContent>
    </Card>
  ))}

  <Button onClick={addMissingPerson}>
    + Додати ще одного зниклого
  </Button>
</form>
```

**State Management:**
```typescript
const [missingPersons, setMissingPersons] = useState<MissingPerson[]>([
  { first_name: '', last_name: '', order_index: 0 }  // Один по умолчанию
]);

const addMissingPerson = () => {
  setMissingPersons([...missingPersons, {
    first_name: '',
    last_name: '',
    order_index: missingPersons.length
  }]);
};

const removeMissingPerson = (index: number) => {
  setMissingPersons(missingPersons.filter((_, i) => i !== index));
};
```

#### 3. EditCasePage - то же самое

Аналогично CreateCasePage, но с загрузкой существующих `missing_persons` из API.

#### 4. CaseDetailsPage - показ всех пропавших

```tsx
<Card>
  <CardHeader>
    <CardTitle>Зниклі ({caseData.missing_persons.length})</CardTitle>
  </CardHeader>
  <CardContent>
    {caseData.missing_persons.map((person, index) => (
      <div key={person.id} className="mb-6">
        <h3>Зниклий #{index + 1}: {person.first_name} {person.last_name}</h3>

        {/* Фото */}
        {person.photos?.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {person.photos.map(photo => (
              <img key={photo} src={photo} />
            ))}
          </div>
        )}

        {/* Данные */}
        <div>
          <p>Стать: {person.gender}</p>
          <p>Дата народження: {formatDate(person.birthdate)}</p>
          {/* ... */}
        </div>
      </div>
    ))}
  </CardContent>
</Card>
```

#### 5. CasesListPage - показ первого пропавшего

```tsx
{cases.map(case => (
  <Card>
    <h3>Заявка #{case.id}</h3>
    {case.missing_persons[0] && (
      <p>Зниклий: {case.missing_persons[0].first_name} {case.missing_persons[0].last_name}</p>
    )}
    {case.missing_persons.length > 1 && (
      <Badge>+{case.missing_persons.length - 1} інших</Badge>
    )}
  </Card>
))}
```

---

## ФАЗА 4: OpenAI промпты ⏳

### 1. Автозаполнение (`backend/app/services/openai_service.py`)

**Обновить system prompt:**
```python
system_prompt = """
...

3. Дані зниклих (missing_persons) - МАСИВ:
   Якщо в тексті декілька пропавших, поверни масив об'єктів.
   Якщо один пропавший - поверни масив з одним елементом.

   [
     {
       "last_name": "Іванов",
       "first_name": "Петро",
       ...
     },
     {
       "last_name": "Іванова",
       "first_name": "Марія",
       ...
     }
   ]
"""
```

**Обновить парсинг:**
```python
def parse_case_info(self, db: Session, initial_info: str):
    result = openai_api_call(...)

    # Парсим missing_persons как массив
    missing_persons_data = []
    if "missing_persons" in result and isinstance(result["missing_persons"], list):
        for mp in result["missing_persons"]:
            missing_persons_data.append({
                "last_name": mp.get("last_name"),
                "first_name": mp.get("first_name"),
                # ...
            })

    return {
        "applicant_first_name": ...,
        "missing_persons": missing_persons_data  # Массив!
    }
```

### 2. Ориентировки (`backend/app/routers/field_searches.py`)

**GET field_search/orientations - собрать все фото:**
```python
@router.get("/{id}/orientations")
def get_orientations(id: int):
    field_search = db.query(FieldSearch).get(id)
    case = field_search.search.case

    # Собрать все фото всех пропавших
    all_photos = []
    for missing_person in case.missing_persons:
        if missing_person.photos:
            all_photos.extend(missing_person.photos)

    return {
        "photos": all_photos,
        "missing_persons": case.missing_persons  # Для генерации текста
    }
```

**Генерация текста ориентировки:**
```python
system_prompt = """
Створи текст орієнтовки для пошуку зниклих.

ВАЖЛИВО: Якщо зниклих декілька, опиши кожного окремо!

Приклад для декількох:
"УВАГА! Зникли дві особи:

1. Іванов Петро Олександрович, 1975 р.н., ...
2. Іванова Марія Петрівна, 1978 р.н., ..."
"""
```

---

## Тестування

### 1. Локальне тестування (після завершення всіх фаз)

```bash
# 1. Применить миграцию
cd backend
docker-compose exec backend alembic upgrade head

# 2. Проверить таблицу
docker-compose exec backend psql -U user -d db
\d missing_persons
SELECT * FROM missing_persons;

# 3. Создать тестовую заявку с 2 пропавшими
curl -X POST http://localhost:8000/cases/ \
  -H "Content-Type: application/json" \
  -d '{
    "applicant_first_name": "Тест",
    "applicant_last_name": "Тестович",
    "missing_persons": [
      {
        "first_name": "Перший",
        "last_name": "Пропавший",
        "order_index": 0
      },
      {
        "first_name": "Другий",
        "last_name": "Пропавший",
        "order_index": 1
      }
    ]
  }'

# 4. Проверить в UI
- Открыть http://localhost:5173/cases/[id]
- Должны быть видны оба пропавших
```

### 2. Production deployment

**ВАЖНО:** Делать только после ПОЛНОГО тестирования на localhost!

```bash
# 1. Бэкап БД перед обновлением
sudo docker exec crm_db pg_dump -U crm_user_prod crm_production > backup_before_multiple_missing_$(date +%Y%m%d).sql

# 2. Deploy кода
cd ~/MilenaCRM
git pull origin main

# 3. Пересобрать frontend
cd frontend
npm ci
npm run build
cd ..

# 4. Пересобрать и перезапустить контейнеры
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production down
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production build --no-cache
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# 5. КРИТИЧНО: Применить миграцию
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec backend alembic upgrade head

# 6. Проверить логи
sudo docker-compose -f docker-compose.prod.yml logs -f backend

# 7. Проверить работу
curl https://crm.przmilena.click/api/health
curl https://crm.przmilena.click/api/cases/1/full
```

### 3. Откат (если что-то пошло не так)

```bash
# 1. Откатить миграцию БД
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec backend alembic downgrade -1

# 2. ИЛИ полный откат БД из бэкапа
sudo docker exec -i crm_db psql -U crm_user_prod crm_production < backup_before_multiple_missing_20260112.sql

# 3. Откатить код на предыдущий commit
git revert HEAD
git push origin main
# Пересобрать и задеплоить
```

---

## Чеклист перед Production

- [ ] ✅ Фаза 1 завершена - БД и модели
- [ ] ⏳ Фаза 2 завершена - Backend API
- [ ] ⏳ Фаза 3 завершена - Frontend UI
- [ ] ⏳ Фаза 4 завершена - OpenAI промпты
- [ ] ⏳ Все протестировано на localhost
- [ ] ⏳ Создан бэкап production БД
- [ ] ⏳ Протестировано создание case с 1 пропавшим
- [ ] ⏳ Протестировано создание case с 2+ пропавшими
- [ ] ⏳ Протестировано редактирование case
- [ ] ⏳ Протестировано автозаполнение с несколькими пропавшими
- [ ] ⏳ Протестирована генерация ориентировок
- [ ] ⏳ Протестирован откат миграции

---

## Контакты и вопросы

Для вопросов по этому обновлению обращаться к документации или коммитам:
- Фаза 1: Commit `505c50b`
- Фаза 2: TBD
- Фаза 3: TBD
- Фаза 4: TBD

**Дата начала:** 2026-01-12
**Статус:** 🚧 В РАЗРАБОТКЕ
