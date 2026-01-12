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
   - region: область (ВАЖЛИВО: тільки назва області БЕЗ слова "область", наприклад: "Харківська", "Київська", "Дніпропетровська")
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

            # Missing person location
            if "missing_location" in result and result["missing_location"] and isinstance(result["missing_location"], dict):
                for key, value in result["missing_location"].items():
                    field_name = f"missing_{key}"
                    flat_result[field_name] = normalize_field_value(value, field_name)

            # Missing person data
            if "missing_person" in result and result["missing_person"] and isinstance(result["missing_person"], dict):
                for key, value in result["missing_person"].items():
                    field_name = f"missing_{key}"
                    flat_result[field_name] = normalize_field_value(value, field_name)

            # Additional data
            if "additional" in result and result["additional"] and isinstance(result["additional"], dict):
                for key, value in result["additional"].items():
                    flat_result[key] = normalize_field_value(value, key)

            # Police data
            if "police" in result and result["police"] and isinstance(result["police"], dict):
                for key, value in result["police"].items():
                    field_name = f"police_{key}"
                    flat_result[field_name] = normalize_field_value(value, field_name)

            # Convert date strings to datetime objects if needed
            date_fields = ["missing_birthdate", "missing_last_seen_datetime", "police_report_date"]
            for field in date_fields:
                if field in flat_result and flat_result[field]:
                    try:
                        # OpenAI returns ISO format strings
                        flat_result[field] = flat_result[field]
                    except Exception:
                        flat_result[field] = None

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
