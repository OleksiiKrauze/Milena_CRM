import os
import json
from typing import Dict, Any, Optional
from openai import OpenAI
from datetime import datetime
from sqlalchemy.orm import Session


class OpenAIService:
    """Service for working with OpenAI API"""

    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")

        self.client = OpenAI(api_key=api_key)
        self.model = "gpt-4o-mini"  # Using cost-effective model

    def _get_case_autofill_prompt(self, db: Session) -> str:
        """Get case autofill prompt from database settings"""
        from app.models.settings import Settings

        settings = db.query(Settings).filter(Settings.id == 1).first()
        if settings and settings.case_autofill_prompt:
            return settings.case_autofill_prompt

        # Return default prompt if settings not found
        return """Ти - асистент системи пошуку зниклих осіб. Твоє завдання - проаналізувати первинну інформацію про заявку та витягнути структуровані дані.

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
   - other_contacts: інші контакти людей, які шукають зниклого (родичі, друзі, колеги, сусіди тощо).
     Якщо в тексті є контакти ІНШИХ людей (окрім заявника), записуй їх сюди у вільній формі.

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
     → applicant: {last_name: null, first_name: "Оксана", middle_name: "Анатоліївна", phone: "0935956421", relation: "psycholog"}

   ВАЖЛИВО: "Оксана", "Катерина", "Єкатерина" - ЦЕ ВАЛІДНІ ІМ'Я ЗАЯВНИКІВ!
   НЕ ігноруй їх, навіть якщо немає прізвища!

   ❌ ЗАБОРОНЕНО залишати last_name, first_name, phone порожніми якщо є контакти!
   ❌ ЗАБОРОНЕНО ігнорувати контакти навіть якщо там лише ім'я!
   ❌ ЗАБОРОНЕНО пропускати першу контактну особу!

2. Локація зниклого (missing_location):
   - settlement: населений пункт (заповнюється з локації ПЕРШОГО зниклого)
   - region: область (ВАЖЛИВО: тільки назва області БЕЗ слова "область", наприклад: "Харківська", "Київська", "Дніпропетровська")
   - address: адреса (заповнюється з адреси ПЕРШОГО зниклого)

3. Дані зниклих (missing_persons) - МАСИВ об'єктів:
   ⚠️ КРИТИЧНО ВАЖЛИВО: У заявці може бути ОДИН або КІЛЬКА зниклих! ⚠️

   Якщо в тексті згадується більше однієї зниклої особи, поверни МАСИВ з усіма особами!
   Якщо згадується лише одна особа, поверни масив з одним елементом.

   Кожен об'єкт в масиві містить:
   - last_name: прізвище зниклого
   - first_name: ім'я зниклого
   - middle_name: по батькові зниклого
   - gender: стать ("чоловіча" або "жіноча")
   - birthdate: дата народження в форматі ISO (YYYY-MM-DD)
   - phone: телефон зниклого
   - settlement: населений пункт проживання цієї зниклої особи
   - region: область проживання цієї зниклої особи
   - address: адреса проживання цієї зниклої особи
   - last_seen_datetime: коли бачили останній раз в форматі ISO (YYYY-MM-DDTHH:MM:SS).
     ВАЖЛИВО: Якщо час НЕ вказано чітко в тексті, НЕ додавай автоматично "00:00:00"!
     Залиш поле як null або не включай його взагалі.
   - last_seen_place: де бачили останній раз
   - description: опис зовнішності
   - special_signs: особливі прикмети
   - diseases: захворювання
   - clothing: одяг
   - belongings: особисті речі

   ПРИКЛАДИ:
   ✓ Якщо згадується один зниклий "Іванов Петро":
     → missing_persons: [{last_name: "Іванов", first_name: "Петро", ...}]

   ✓ Якщо згадуються два зниклих "Іванов Петро та Іванова Марія":
     → missing_persons: [
         {last_name: "Іванов", first_name: "Петро", ...},
         {last_name: "Іванова", first_name: "Марія", ...}
       ]

4. Додаткова інформація (additional):
   - search_regions: додаткові області для пошуку (масив рядків)
   - search_terrain_type: тип місцевості ("Місто", "Ліс", "Поле", "Вода", або "Інше")
   - disappearance_circumstances: обставини зникнення

   - tags: теги для категоризації - ОБОВ'ЯЗКОВО вибирай ЛИШЕ з цього списку:

     ВІКОВІ КАТЕГОРІЇ (визначається ЗАВЖДИ на основі дати народження):
     * "Дитина до 14" - якщо вік < 14 років
     * "Підліток 14-18" - якщо вік 14-17 років
     * "Дорослий 18-60" - якщо вік 18-60 років
     * "Літня людина 60+" - якщо вік > 60 років

     ІНШІ ТЕГИ (тільки якщо ЧІТКО згадано в тексті):
     * "Проблеми з пам'яттю" - деменція, Альцгеймер, втрата пам'яті
     * "Потребує медичної допомоги" - серйозні захворювання, постійні ліки
     * "Дезорієнтація" - втрата орієнтації в просторі/часі
     * "Алкогольна залежність" - згадана залежність від алкоголю
     * "Наркотична залежність" - згадана наркозалежність
     * "Військовий" - є військовослужбовцем
     * "Рецидив" - зникав раніше
     * "Психічні розлади" - психічні захворювання
     * "Особа з інвалідністю" - згадана інвалідність
     * "Суїцидальні нахили" - суїцидальні думки/спроби
     * "Схильність до агресії" - агресивна поведінка

   ВАЖЛИВО: Повертай ТІЛЬКИ теги з цього списку (точний текст)!
   Приклад: tags: ["Дитина до 14", "Проблеми з пам'яттю"]

5. Інформація про поліцію (police):
   - police_report_filed: чи подано заяву в поліцію (true/false)
   - police_report_date: дата подання заяви в поліцію в форматі ISO (YYYY-MM-DD)
   - police_department: назва райвідділку поліції

Якщо якесь поле не можна визначити з тексту, залиш його як null або порожній масив для списків.
"""

    def parse_case_info(self, db: Session, initial_info: str) -> Dict[str, Any]:
        """
        Parse initial case information and extract structured data using ChatGPT

        Args:
            db: Database session
            initial_info: Raw text with case information

        Returns:
            Dictionary with extracted case fields
        """

        # Get autofill prompt from database settings
        system_prompt = self._get_case_autofill_prompt(db)

        user_prompt = f"""Проаналізуй наступну первинну інформацію про заявку та поверни структуровані дані у JSON форматі:

{initial_info}

Поточна дата для розуміння відносних дат: {datetime.now().strftime('%Y-%m-%d')}
"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,  # Lower temperature for more consistent extraction
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)

            # Helper function to normalize field values
            def normalize_field_value(value, field_name=None):
                """Convert complex types for API compatibility"""
                if value is None or value == "":
                    return None

                # Fields that should remain as lists
                list_fields = {'tags', 'additional_search_regions', 'missing_photos'}

                if field_name in list_fields:
                    # Keep or convert to list
                    if isinstance(value, list):
                        return value
                    if isinstance(value, str):
                        # Split comma-separated string into list
                        return [item.strip() for item in value.split(',') if item.strip()]
                    return [str(value)]

                # Special handling for description fields
                if field_name and 'description' in field_name and isinstance(value, dict):
                    # Convert structured description to readable text
                    parts = []
                    # Ukrainian labels for description fields
                    labels = {
                        'height': 'Зріст',
                        'build': 'Статура',
                        'hair': 'Волосся',
                        'eyes': 'Очі',
                        'other_signs': 'Особливі прикмети'
                    }
                    for key, label in labels.items():
                        if key in value and value[key] and value[key] not in ['-', '–', 'не вказано']:
                            parts.append(f"{label}: {value[key]}")
                    return ". ".join(parts) + "." if parts else None

                # Convert complex types to strings for other fields
                if isinstance(value, dict):
                    # Convert dict to formatted string (fallback)
                    parts = [f"{k}: {v}" for k, v in value.items() if v and v not in ['-', '–']]
                    return ", ".join(parts) if parts else None
                if isinstance(value, list):
                    # Convert list to comma-separated string
                    return ", ".join(str(item) for item in value if item) if value else None
                return value

            # Transform the nested structure to flat structure expected by CaseUpdate schema
            flat_result = {}

            # General data - поля верхнього рівня форми
            if "general" in result and result["general"] and isinstance(result["general"], dict):
                for key, value in result["general"].items():
                    # basis з промпту йде безпосередньо в basis в БД (поле "Підстава" зверху форми)
                    flat_result[key] = normalize_field_value(value, key)

            # Applicant data
            if "applicant" in result and result["applicant"] and isinstance(result["applicant"], dict):
                for key, value in result["applicant"].items():
                    field_name = f"applicant_{key}"
                    flat_result[field_name] = normalize_field_value(value, field_name)

            # Missing person location (backward compatibility - populated from first missing person)
            if "missing_location" in result and result["missing_location"] and isinstance(result["missing_location"], dict):
                for key, value in result["missing_location"].items():
                    field_name = f"missing_{key}"
                    flat_result[field_name] = normalize_field_value(value, field_name)

            # NEW: Missing persons array (replaces single missing_person)
            if "missing_persons" in result and result["missing_persons"] and isinstance(result["missing_persons"], list):
                missing_persons_array = []
                for idx, mp in enumerate(result["missing_persons"]):
                    if isinstance(mp, dict):
                        # Build missing person object matching MissingPersonCreate schema
                        mp_obj = {
                            "last_name": normalize_field_value(mp.get("last_name")),
                            "first_name": normalize_field_value(mp.get("first_name")),
                            "middle_name": normalize_field_value(mp.get("middle_name")),
                            "gender": normalize_field_value(mp.get("gender")),
                            "birthdate": normalize_field_value(mp.get("birthdate")),
                            "phone": normalize_field_value(mp.get("phone")),
                            "settlement": normalize_field_value(mp.get("settlement")),
                            "region": normalize_field_value(mp.get("region")),
                            "address": normalize_field_value(mp.get("address")),
                            "last_seen_datetime": normalize_field_value(mp.get("last_seen_datetime")),
                            "last_seen_place": normalize_field_value(mp.get("last_seen_place")),
                            "photos": normalize_field_value(mp.get("photos"), "missing_photos") or [],
                            "description": normalize_field_value(mp.get("description")),
                            "special_signs": normalize_field_value(mp.get("special_signs")),
                            "diseases": normalize_field_value(mp.get("diseases")),
                            "clothing": normalize_field_value(mp.get("clothing")),
                            "belongings": normalize_field_value(mp.get("belongings")),
                            "order_index": idx
                        }
                        missing_persons_array.append(mp_obj)

                flat_result["missing_persons"] = missing_persons_array

                # Auto-populate missing_location fields from first missing person if not already set
                if missing_persons_array and len(missing_persons_array) > 0:
                    first_person = missing_persons_array[0]
                    if "missing_settlement" not in flat_result and first_person.get("settlement"):
                        flat_result["missing_settlement"] = first_person["settlement"]
                    if "missing_region" not in flat_result and first_person.get("region"):
                        flat_result["missing_region"] = first_person["region"]
                    if "missing_address" not in flat_result and first_person.get("address"):
                        flat_result["missing_address"] = first_person["address"]

            # LEGACY: Support old single missing_person format for backward compatibility
            elif "missing_person" in result and result["missing_person"] and isinstance(result["missing_person"], dict):
                # Convert single person to array format
                mp = result["missing_person"]
                mp_obj = {
                    "last_name": normalize_field_value(mp.get("last_name")),
                    "first_name": normalize_field_value(mp.get("first_name")),
                    "middle_name": normalize_field_value(mp.get("middle_name")),
                    "gender": normalize_field_value(mp.get("gender")),
                    "birthdate": normalize_field_value(mp.get("birthdate")),
                    "phone": normalize_field_value(mp.get("phone")),
                    "settlement": normalize_field_value(mp.get("settlement")),
                    "region": normalize_field_value(mp.get("region")),
                    "address": normalize_field_value(mp.get("address")),
                    "last_seen_datetime": normalize_field_value(mp.get("last_seen_datetime")),
                    "last_seen_place": normalize_field_value(mp.get("last_seen_place")),
                    "photos": normalize_field_value(mp.get("photos"), "missing_photos") or [],
                    "description": normalize_field_value(mp.get("description")),
                    "special_signs": normalize_field_value(mp.get("special_signs")),
                    "diseases": normalize_field_value(mp.get("diseases")),
                    "clothing": normalize_field_value(mp.get("clothing")),
                    "belongings": normalize_field_value(mp.get("belongings")),
                    "order_index": 0
                }
                flat_result["missing_persons"] = [mp_obj]

            # Additional data
            if "additional" in result and result["additional"] and isinstance(result["additional"], dict):
                for key, value in result["additional"].items():
                    flat_result[key] = normalize_field_value(value, key)

            # Tags - can be at top level or inside additional
            if "tags" in result and result["tags"]:
                flat_result["tags"] = normalize_field_value(result["tags"], "tags")

            # Police data
            if "police" in result and result["police"] and isinstance(result["police"], dict):
                for key, value in result["police"].items():
                    field_name = f"police_{key}"
                    flat_result[field_name] = normalize_field_value(value, field_name)

            # Validate tags - only predefined tags allowed
            if "tags" in flat_result and flat_result["tags"]:
                PREDEFINED_TAGS = [
                    "Дитина до 14", "Підліток 14-18", "Дорослий 18-60", "Літня людина 60+",
                    "Проблеми з пам'яттю", "Потребує медичної допомоги", "Дезорієнтація",
                    "Алкогольна залежність", "Наркотична залежність", "Військовий",
                    "Рецидив", "Психічні розлади", "Особа з інвалідністю",
                    "Суїцидальні нахили", "Схильність до агресії"
                ]
                if isinstance(flat_result["tags"], list):
                    flat_result["tags"] = [tag for tag in flat_result["tags"] if tag in PREDEFINED_TAGS]

            return flat_result

        except Exception as e:
            raise Exception(f"Error parsing case info with OpenAI: {str(e)}")

    def generate_orientation_text(self, initial_info: str, gpt_prompt: str) -> Dict[str, Any]:
        """
        Generate orientation text using ChatGPT based on initial_info and custom prompt

        Args:
            initial_info: Raw text from "Первинна інформація" field
            gpt_prompt: Custom GPT prompt from template

        Returns:
            Dictionary with sections array containing formatted text
            Each section has: text, fontSize, color, bold, uppercase, align
        """

        # Use initial_info as the primary source
        case_text = f"""
ПЕРВИННА ІНФОРМАЦІЯ ПРО ЗАЯВКУ:

{initial_info}
"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": gpt_prompt},
                    {"role": "user", "content": case_text}
                ],
                temperature=0.3,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)
            return result

        except Exception as e:
            raise Exception(f"Error generating orientation text with OpenAI: {str(e)}")


# Singleton instance
_openai_service: Optional[OpenAIService] = None


def get_openai_service() -> OpenAIService:
    """Get or create OpenAI service instance"""
    global _openai_service
    if _openai_service is None:
        _openai_service = OpenAIService()
    return _openai_service
