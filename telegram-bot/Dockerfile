FROM python:3.12-slim

WORKDIR /app

# Копіюємо requirements
COPY requirements.txt .

# Встановлюємо залежності
RUN pip install --no-cache-dir -r requirements.txt

# Копіюємо код бота
COPY bot.py .

# Запускаємо бота
CMD ["python", "bot.py"]
