# Голосовий бот — Інструкція з розгортання

## Архітектура

```
Телефонний дзвінок
      ↓
FreePBX IVR → "натисніть 2"
      ↓ SIP (UDP 5060)
LiveKit SIP сервіс (AWS, порт 5060)
      ↓ WebSocket (внутрішня мережа Docker)
LiveKit Server (AWS, порт 7880)
      ↓
Voice Bot Agent (Python, в Docker)
      ↓ WebSocket
OpenAI Realtime API
      ↓
Транскрипт → MilenaCRM (нова заявка-чернетка)
```

---

## Крок 1: AWS Security Group

Відкрий нові порти у Security Group інстансу:

| Порт | Протокол | Опис |
|------|----------|------|
| 5060 | UDP + TCP | SIP сигналізація (від FreePBX) |
| 7880 | TCP | LiveKit API (внутрішній, можна не відкривати зовні) |
| 7881 | TCP | WebRTC TCP fallback |
| 10000–10200 | UDP | RTP медіа (SIP аудіо) |
| 50000–50200 | UDP | WebRTC UDP медіа |

> Порти 7880 зовні відкривати не обов'язково — agent і SIP звертаються до нього через Docker мережу.

---

## Крок 2: Додати змінні в .env.production

```bash
# LiveKit
LIVEKIT_API_KEY=milena_livekit_key
LIVEKIT_API_SECRET=надійний_секрет_мінімум_32_символи
```

Генерація секрету:
```bash
openssl rand -hex 32
```

---

## Крок 3: Деплой на сервер

```bash
ssh ubuntu@crm.przmilena.click
cd ~/MilenaCRM
git pull origin main

# Зібрати і запустити нові сервіси
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production build voice-bot
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d livekit livekit-sip voice-bot

# Перевірити що запустились
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production ps
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production logs voice-bot -f
```

---

## Крок 4: Налаштування SIP (одноразово)

Після першого запуску потрібно створити SIP-транк і правило диспетчеризації через API LiveKit.

На сервері:
```bash
# Встанови залежності для скрипта (локально або в тимчасовому контейнері)
pip install livekit

# Запусти скрипт налаштування
export LIVEKIT_URL=http://localhost:7880
export LIVEKIT_API_KEY=milena_livekit_key
export LIVEKIT_API_SECRET=<твій секрет>
export FREEPBX_IP=<публічна IP FreePBX>

python voice-bot/setup_sip.py
```

Або через Docker:
```bash
sudo docker run --rm --network crm_crm_network \
  -e LIVEKIT_URL=http://crm_livekit:7880 \
  -e LIVEKIT_API_KEY=milena_livekit_key \
  -e LIVEKIT_API_SECRET=<секрет> \
  -e FREEPBX_IP=<IP FreePBX> \
  python:3.12-slim bash -c "pip install livekit && python /setup.py" # (треба змонтувати файл)
```

---

## Крок 5: Налаштування FreePBX

### Створення SIP транку

Admin → Connectivity → Trunks → Add Trunk → **SIP (chan_pjsip)**

**General:**
```
Trunk Name: MilenaCRM-VoiceBot
Outbound CallerID: (будь-який)
```

**pjsip Settings → General:**
```
Username:     (порожньо)
Secret:       (порожньо)
SIP Server:   <AWS_PUBLIC_IP>
SIP Server Port: 5060
Transport:    UDP
```

**pjsip Settings → Advanced:**
```
From Domain:  <AWS_PUBLIC_IP>
```

### Налаштування IVR

Admin → Applications → IVR → Edit (твій IVR)

Додай опцію:
```
Digit: 2
Destination: Trunk → MilenaCRM-VoiceBot
```

Або через Misc Destination → Trunk якщо IVR не підтримує прямий вихід на транк:

1. Admin → Connectivity → Outbound Routes → Add Route
2. Route Name: `VoiceBot`
3. Trunk Sequence: `MilenaCRM-VoiceBot`
4. Dial Patterns: `XXXXXXXXXXXX` (або будь-який)

Потім в IVR: опція 2 → Outbound Route → VoiceBot

---

## Як це працює після налаштування

1. Дзвінок приходить на FreePBX
2. IVR: "Натисніть 2 для оформлення заявки"
3. FreePBX надсилає SIP INVITE на `<AWS_IP>:5060`
4. LiveKit SIP приймає дзвінок, створює кімнату `milena-call-XXXX`
5. Voice Bot Agent автоматично підключається до кімнати
6. Бот вітається і ставить питання через OpenAI Realtime API
7. Після завершення дзвінка:
   - Транскрипт зберігається у `/recordings/transcripts/call_XXXX.txt`
   - Через CRM API створюється чернетка заявки (з полем `call_transcript`)

---

## Перевірка роботи

```bash
# Логи бота (в реальному часі)
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production logs voice-bot -f

# Логи SIP сервісу
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production logs livekit-sip -f

# Переглянути збережені транскрипти
sudo docker exec crm_voice_bot ls /recordings/transcripts/
sudo docker exec crm_voice_bot cat /recordings/transcripts/<filename>
```

---

## Можливі проблеми

**Бот не відповідає на дзвінок:**
- Перевір що порт 5060 UDP відкритий в Security Group
- Перевір логи `livekit-sip` на SIP INVITE/404
- Перевір що `setup_sip.py` відпрацював успішно

**Немає звуку:**
- Перевір порти RTP (10000-10200 UDP і 50000-50200 UDP)
- В FreePBX: перевір NAT налаштування транку

**Бот говорить але не розуміє:**
- Перевір `OPENAI_API_KEY` в `.env.production`
- Перевір логи `voice-bot` на помилки OpenAI
