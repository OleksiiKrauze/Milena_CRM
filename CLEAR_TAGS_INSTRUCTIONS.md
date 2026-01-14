# Инструкция по очистке старых тегов

## Проблема
Старые заявки содержат теги в произвольном текстовом формате. Необходимо очистить все теги, чтобы вручную проставить новые предопределенные теги из системы чекбоксов.

## Решение
SQL скрипт `clear_old_tags.sql` устанавливает пустой массив для поля `tags` во всех заявках.

---

## Выполнение на localhost (для тестирования)

### Вариант 1: Через psql в контейнере

```bash
# Перейти в директорию проекта
cd D:\1. Projects\MilenaCRM

# Выполнить скрипт
docker-compose -f docker-compose.yml exec -T db psql -U crm_user -d crm < clear_old_tags.sql
```

### Вариант 2: Интерактивно через psql

```bash
# Войти в psql
docker-compose -f docker-compose.yml exec db psql -U crm_user -d crm

# Выполнить команду вручную
UPDATE cases SET tags = ARRAY[]::varchar[];

# Проверить результат
SELECT id, applicant_first_name, applicant_last_name, tags FROM cases LIMIT 10;

# Выйти
\q
```

### Проверка результата (localhost)

```bash
# Проверить что теги очищены
docker-compose -f docker-compose.yml exec db psql -U crm_user -d crm -c "SELECT COUNT(*) FROM cases WHERE tags != ARRAY[]::varchar[];"
```

Должно вернуть `0` если все теги очищены.

---

## Выполнение на Production

**⚠️ ВАЖНО: Создайте бэкап базы данных перед выполнением!**

### Шаг 1: Подключение к серверу

```bash
ssh ubuntu@<server-ip>
cd ~/Milena_CRM
```

### Шаг 2: Бэкап базы данных (ОБЯЗАТЕЛЬНО!)

```bash
# Создать бэкап
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec db pg_dump -U milena_user -d milenacrm > backup_before_clear_tags_$(date +%Y%m%d_%H%M%S).sql

# Проверить что бэкап создан
ls -lh backup_before_clear_tags_*.sql
```

### Шаг 3: Выполнение скрипта

```bash
# Выполнить скрипт очистки тегов
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec -T db psql -U milena_user -d milenacrm < clear_old_tags.sql
```

### Шаг 4: Проверка результата

```bash
# Проверить количество заявок с непустыми тегами (должно быть 0)
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec db psql -U milena_user -d milenacrm -c "SELECT COUNT(*) FROM cases WHERE tags != ARRAY[]::varchar[];"

# Посмотреть несколько заявок
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec db psql -U milena_user -d milenacrm -c "SELECT id, applicant_first_name, applicant_last_name, tags FROM cases LIMIT 5;"
```

---

## Откат изменений (если нужно)

### На localhost

```bash
# Если нужно восстановить, используйте бэкап из Docker volume
# Обычно не требуется на localhost - можно просто вручную заполнить теги
```

### На Production

```bash
# Восстановить из бэкапа
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec -T db psql -U milena_user -d milenacrm < backup_before_clear_tags_YYYYMMDD_HHMMSS.sql
```

---

## После очистки тегов

1. Откройте CRM в браузере
2. Перейдите к каждой заявке
3. Откройте редактирование
4. Выберите подходящие теги из чекбоксов
5. Сохраните заявку

Теги будут сохранены в новом формате (предопределенные чекбоксы).

---

## Альтернативный вариант: Очистить только "плохие" теги

Если нужно удалить только теги, которые не входят в список предопределенных:

```sql
-- Оставить только валидные теги из предопределенного списка
UPDATE cases
SET tags = (
  SELECT ARRAY_AGG(tag)
  FROM UNNEST(tags) AS tag
  WHERE tag IN (
    'Дитина до 14', 'Підліток 14-18', 'Дорослий 18-60', 'Літня людина 60+',
    'Проблеми з пам''яттю', 'Потребує медичної допомоги', 'Дезорієнтація',
    'Алкогольна залежність', 'Наркотична залежність', 'Військовий',
    'Рецидив', 'Психічні розлади', 'Особа з інвалідністю',
    'Суїцидальні нахили', 'Схильність до агресії'
  )
)
WHERE tags IS NOT NULL;

-- Заменить NULL на пустой массив
UPDATE cases SET tags = ARRAY[]::varchar[] WHERE tags IS NULL;
```

---

## Troubleshooting

### Ошибка: "permission denied for table cases"
**Решение:** Убедитесь что используете правильного пользователя БД (crm_user на localhost, milena_user на production)

### Ошибка: "column tags does not exist"
**Решение:** Убедитесь что структура таблицы содержит поле tags (было добавлено в более ранних миграциях)

### Бэкап не создается
**Решение:** Проверьте права на запись в текущей директории или укажите полный путь:
```bash
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec db pg_dump -U milena_user -d milenacrm > /home/ubuntu/backup.sql
```

---

**Дата создания:** 2026-01-14
**Автор:** Claude Code
