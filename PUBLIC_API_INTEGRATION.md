# Интеграция формы сайта с CRM

## ✅ Что было реализовано

### 1. Публичный API Endpoint

**URL:** `POST /api/public/cases`

Создан публичный endpoint для приема заявок с сайта без необходимости аутентификации.

### 2. Схема данных

Создана схема `PublicCaseCreate`, которая точно соответствует полям формы на сайте milena.in.ua:

**Обязательные поля:**
- `applicant_full_name` - ПІБ заявника
- `applicant_phone` - Телефон заявника
- `missing_full_name` - ПІБ зниклого

**Опциональные поля:**
- `subject` - Тема
- `applicant_relation` - Ким доводиться зниклому
- `missing_gender` - Стать (Чоловіча/Жіноча)
- `missing_birthdate` - Дата народження
- `missing_region` - Область зникнення
- `additional_search_regions` - Додаткові області пошуку
- `missing_phone` - Номер телефону зниклого
- `missing_settlement` - Місцевість зникнення
- `missing_last_seen_date` - Дата зникнення
- `missing_last_seen_time` - Час зникнення
- `police_report_info` - Заява в поліцію
- `search_terrain_type` - Тип місцевості (Місто/Ліс)
- `disappearance_circumstances` - Обставини зникнення
- `missing_diseases` - Стан здоров'я
- `missing_clothing` - Одяг
- `missing_special_signs` - Особливі прикмети
- `missing_belongings` - Речі при собі
- `missing_photos` - Фото зниклого (масив URL)
- `additional_info` - Додаткова інформація

### 3. Автоматическая обработка

Заявки с сайта автоматически:
- Получают статус `decision_type = "Нова з сайту"`
- Отмечаются тегом `tags = ["Заявка з сайту"]`
- Имеют `basis = "Заявка з сайту milena.in.ua"`
- ФИО разделяется на фамилию, имя, отчество автоматически
- Дата и время последнего контакта объединяются в одно поле

### 4. Защита от спама

Реализовано несколько уровней защиты:

**Rate Limiting:**
- 5 запросов в 60 секунд с одного IP адреса
- При превышении возвращается HTTP 429

**CORS:**
- Разрешены запросы только с milena.in.ua и localhost
- Настроено в `backend/app/main.py`

**API Key (опционально):**
- Можно установить `PUBLIC_API_KEY` в `.env` для дополнительной проверки
- Ключ передается в заголовке `X-API-Key`

### 5. Логирование

Все публичные заявки логируются с IP адресом отправителя для мониторинга и анализа.

## 📁 Созданные файлы

1. **backend/app/schemas/public_case.py** - Схемы для публичного API
2. **backend/app/routers/public.py** - Публичный роутер с endpoint
3. **backend/app/middleware/rate_limit.py** - Middleware для rate limiting
4. **website_integration_example.html** - Пример интеграции с подробной документацией

## 🚀 Развертывание на Production

### Шаг 1: Обновить код на сервере

```bash
ssh ubuntu@server
cd ~/MilenaCRM
git pull origin main
```

### Шаг 2: Обновить .env.production (опционально)

Если хотите использовать API ключ для дополнительной безпеки:

```bash
nano .env.production
```

Добавьте строку:
```
PUBLIC_API_KEY=your-secret-api-key-here
```

### Шаг 3: Пересобрать и перезапустить backend

```bash
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production down
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production build backend --no-cache
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### Шаг 4: Проверить работу

```bash
curl -X GET https://crm.przmilena.click/api/public/health
```

Должен вернуться ответ:
```json
{"status":"ok","service":"public-api"}
```

## 🔌 Интеграция с сайтом

### Вариант 1: Contact Form 7 (WordPress)

Подробный пример находится в файле `website_integration_example.html`.

Основная идея:
```javascript
document.addEventListener('wpcf7mailsent', function(event) {
    // Получить данные из формы
    const formData = {
        applicant_full_name: event.detail.inputs.find(i => i.name === 'applicant-name')?.value,
        applicant_phone: event.detail.inputs.find(i => i.name === 'applicant-phone')?.value,
        missing_full_name: event.detail.inputs.find(i => i.name === 'missing-name')?.value,
        // ... остальные поля
    };

    // Отправить в CRM API
    fetch('https://crm.przmilena.click/api/public/cases', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'YOUR_API_KEY'  // Если используется
        },
        body: JSON.stringify(formData)
    });
}, false);
```

### Вариант 2: Прямая форма HTML

```html
<form id="case-form">
    <input name="applicant_full_name" required>
    <input name="applicant_phone" required>
    <input name="missing_full_name" required>
    <!-- ... другие поля ... -->
    <button type="submit">Отправить</button>
</form>

<script>
document.getElementById('case-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    const response = await fetch('https://crm.przmilena.click/api/public/cases', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.success) {
        alert(result.message);
    }
});
</script>
```

## 🧪 Тестирование

### Локальное тестирование

```bash
curl -X POST http://localhost:8000/public/cases \
  -H "Content-Type: application/json" \
  -d @test_public_api.json
```

Файл `test_public_api.json` уже создан в корне проекта с примером данных.

### Production тестирование

```bash
curl -X POST https://crm.przmilena.click/api/public/cases \
  -H "Content-Type: application/json" \
  -d '{
    "applicant_full_name": "Іванов Іван Іванович",
    "applicant_phone": "+380501234567",
    "missing_full_name": "Петров Петро Петрович",
    "applicant_relation": "Брат",
    "missing_gender": "Чоловіча",
    "missing_region": "Київська область"
  }'
```

## 📊 Мониторинг заявок

В CRM все заявки с сайта можно отфильтровать по:
- **Статусу:** "Нова з сайту"
- **Тегу:** "Заявка з сайту"

Заявки создаются без `created_by_user_id`, так как они не связаны с конкретным пользователем CRM.

## 🔐 Безопасность

✅ **Реализовано:**
- Rate limiting (5 запросов / 60 сек / IP)
- CORS ограничение (только milena.in.ua)
- Опциональный API ключ
- Валидация всех входных данных
- Логирование с IP адресами

⚠️ **Рекомендации:**
- Установите `PUBLIC_API_KEY` для production
- Мониторьте логи на предмет подозрительной активности
- Регулярно проверяйте заявки со статусом "Нова з сайту"

## 📝 API Спецификация

### Успешный ответ (201 Created)
```json
{
  "success": true,
  "message": "Заявку успішно створено. Наша команда зв'яжеться з вами найближчим часом.",
  "case_id": 156
}
```

### Ошибка валидации (400 Bad Request)
```json
{
  "detail": "Помилка валідації даних: ..."
}
```

### Rate limit exceeded (429 Too Many Requests)
```json
{
  "detail": {
    "error": "Rate limit exceeded",
    "message": "Too many requests. Please try again later.",
    "remaining": 0,
    "window_seconds": 60
  }
}
```

## 🆘 Troubleshooting

### Проблема: CORS ошибка при отправке с сайта

**Решение:** Убедитесь, что домен сайта добавлен в CORS origins в `backend/app/main.py`:
```python
default_origins = "http://localhost:3000,http://localhost:5173,https://milena.in.ua,http://milena.in.ua"
```

### Проблема: Rate limit срабатывает слишком часто

**Решение:** Настройте параметры в `backend/app/middleware/rate_limit.py`:
```python
public_rate_limiter = RateLimiter(requests_per_window=10, window_seconds=60)
```

### Проблема: Заявки не появляются в CRM

**Решение:**
1. Проверьте логи backend: `docker-compose -f docker-compose.prod.yml --env-file .env.production logs backend`
2. Убедитесь, что API endpoint доступен: `curl https://crm.przmilena.click/api/public/health`
3. Проверьте правильность JSON данных

## ✨ Следующие шаги

1. **Развернуть на production** (см. инструкции выше)
2. **Интегрировать с формой на сайте** milena.in.ua
3. **Настроить email уведомления** при создании новой заявки (опционально)
4. **Добавить reCAPTCHA** для дополнительной защиты (опционально)

---

**Дата создания:** 2026-01-04
**Версия API:** 1.0.0
**Endpoint:** `POST /api/public/cases`
