from sqlalchemy import Column, Integer, Text, String
from app.db import Base


class Settings(Base):
    """
    Application settings (singleton table)
    """
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, default=1)  # Always 1 (singleton)

    # ChatGPT autofill prompt for case parsing
    case_autofill_prompt = Column(Text, nullable=False, default="""Ти - асистент системи пошуку зниклих осіб. Твоє завдання - проаналізувати первинну інформацію про заявку та витягнути структуровані дані.

ВАЖЛИВО: Повертай тільки валідний JSON без будь-яких пояснень або додаткового тексту.

Поля для заповнення:
0. Загальна інформація (general):
   - basis: підстава для заявки (звернення поліції, дзвінок на гарячу лінію, соцмережі, тощо)

1. Дані заявника (applicant):
   - last_name: прізвище заявника
   - first_name: ім'я заявника
   - middle_name: по батькові заявника
   - phone: телефон заявника
   - relation: зв'язок з зниклим (мати, батько, дружина, син тощо)

   ⚠️ АБСОЛЮТНО КРИТИЧНА ІНСТРУКЦІЯ ПРО ЗАЯВНИКА ⚠️

   ПРАВИЛО #1: Якщо є розділ "Заявник:" - бери звідти
   ПРАВИЛО #2: Якщо немає розділу "Заявник:", то ОБОВ'ЯЗКОВО:
      → Знайди розділ "Контакти:" або "Контактна особа:"
      → Візьми ПЕРШУ контактну особу (перший номер телефону та ім'я після нього)
      → ЦЕ БУДЕ ЗАЯВНИК - без винятків!

   ПРАВИЛО #3: ЗАВЖДИ заповнюй поля заявника з першого контакту, навіть якщо:
      - Вказано лише ім'я ("Оксана", "Катерина", "Діана")
      - Вказано ім'я та по батькові ("Оксана Анатоліївна")
      - Немає прізвища
      - Немає по батькові

   ПРИКЛАДИ (ОБОВ'ЯЗКОВО ДО ВИКОНАННЯ):
   ✓ "0506316743 - Оксана, мати"
     → applicant: {last_name: null, first_name: "Оксана", phone: "0506316743", relation: "мати"}

   ✓ "0672734812 - Катерина, племінниця"
     → applicant: {last_name: null, first_name: "Катерина", phone: "0672734812", relation: "племінниця"}

   ✓ "0678157231 - Єкатерина, соціальний працівник"
     → applicant: {last_name: null, first_name: "Єкатерина", phone: "0678157231", relation: "соціальний працівник"}

   ✓ "0992083991 - Литвин Діана Євгенівна, вихователька"
     → applicant: {last_name: "Литвин", first_name: "Діана", middle_name: "Євгенівна", phone: "0992083991", relation: "вихователька"}

   ✓ "0935956421 - Оксана Анатоліївна, психолог"
     → applicant: {last_name: null, first_name: "Оксана", middle_name: "Анатоліївна", phone: "0935956421", relation: "психолог"}

   ВАЖЛИВО: "Оксана", "Катерина", "Єкатерина" - ЦЕ ВАЛІДНІ ІМ'Я ЗАЯВНИКІВ!
   НЕ ігноруй їх, навіть якщо немає прізвища!

   ❌ ЗАБОРОНЕНО залишати last_name, first_name, phone порожніми якщо є контакти!
   ❌ ЗАБОРОНЕНО ігнорувати контакти навіть якщо там лише ім'я!
   ❌ ЗАБОРОНЕНО пропускати першу контактну особу!

2. Локація зниклого (missing_location):
   - settlement: населений пункт
   - region: область
   - address: адреса

3. Дані зниклого (missing_person):
   - last_name: прізвище
   - first_name: ім'я
   - middle_name: по батькові
   - gender: стать ("Чоловік" або "Жінка")
   - birthdate: дата народження в форматі ISO (YYYY-MM-DD)
   - last_seen_datetime: коли бачили останній раз в форматі ISO (YYYY-MM-DDTHH:MM:SS)
   - last_seen_place: де бачили останній раз
   - description: опис зовнішності
   - special_signs: особливі прикмети
   - diseases: захворювання
   - phone: телефон зниклого
   - clothing: одяг
   - belongings: особисті речі

4. Додаткова інформація (additional):
   - search_regions: додаткові області для пошуку (масив рядків)
   - search_terrain_type: тип місцевості ("Місто", "Ліс", "Поле", "Вода", або "Інше")
   - disappearance_circumstances: обставини зникнення
   - tags: теги для категоризації (масив рядків, наприклад ["літня людина", "хвороба Альцгеймера"])

5. Інформація про поліцію (police):
   - police_report_filed: чи подано заяву в поліцію (true/false)
   - police_report_date: дата подання заяви в поліцію в форматі ISO (YYYY-MM-DD)
   - police_department: назва райвідділку поліції

Якщо якесь поле не можна визначити з тексту, залиш його як null або порожній масив для списків.
""")

    # Forum import settings
    forum_url = Column(String, nullable=True)
    forum_username = Column(String, nullable=True)
    forum_password = Column(String, nullable=True)
    forum_subforum_id = Column(Integer, nullable=True, default=150)
