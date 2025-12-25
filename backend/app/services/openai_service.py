import os
import json
from typing import Dict, Any, Optional
from openai import OpenAI
from datetime import datetime


class OpenAIService:
    """Service for working with OpenAI API"""

    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")

        self.client = OpenAI(api_key=api_key)
        self.model = "gpt-4o-mini"  # Using cost-effective model

    def parse_case_info(self, initial_info: str) -> Dict[str, Any]:
        """
        Parse initial case information and extract structured data using ChatGPT

        Args:
            initial_info: Raw text with case information

        Returns:
            Dictionary with extracted case fields
        """

        system_prompt = """Ти - асистент системи пошуку зниклих осіб. Твоє завдання - проаналізувати первинну інформацію про заявку та витягнути структуровані дані.

ВАЖЛИВО: Повертай тільки валідний JSON без будь-яких пояснень або додаткового тексту.

Поля для заповнення:
1. Дані заявника (applicant):
   - last_name: прізвище заявника
   - first_name: ім'я заявника
   - middle_name: по батькові заявника
   - phone: телефон заявника
   - relation: зв'язок з зниклим (мати, батько, дружина, син тощо)

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
   - police_report_filed: чи подано заяву в поліцію (true/false)
   - search_terrain_type: тип місцевості ("Місто", "Ліс", "Поле", "Вода", або "Інше")
   - disappearance_circumstances: обставини зникнення
   - tags: теги для категоризації (масив рядків, наприклад ["літня людина", "хвороба Альцгеймера"])

Якщо якесь поле не можна визначити з тексту, залиш його як null або порожній масив для списків.
"""

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

            # Transform the nested structure to flat structure expected by CaseUpdate schema
            flat_result = {}

            # Applicant data
            if "applicant" in result and result["applicant"]:
                for key, value in result["applicant"].items():
                    flat_result[f"applicant_{key}"] = value

            # Missing person location
            if "missing_location" in result and result["missing_location"]:
                for key, value in result["missing_location"].items():
                    flat_result[f"missing_{key}"] = value

            # Missing person data
            if "missing_person" in result and result["missing_person"]:
                for key, value in result["missing_person"].items():
                    flat_result[f"missing_{key}"] = value

            # Additional data
            if "additional" in result and result["additional"]:
                for key, value in result["additional"].items():
                    flat_result[key] = value

            # Convert date strings to datetime objects if needed
            date_fields = ["missing_birthdate", "missing_last_seen_datetime"]
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

    def generate_orientation_text(self, case_data: Dict[str, Any], gpt_prompt: str) -> Dict[str, Any]:
        """
        Generate orientation text using ChatGPT based on case data and custom prompt

        Args:
            case_data: Dictionary with case information
            gpt_prompt: Custom GPT prompt from template

        Returns:
            Dictionary with sections array containing formatted text
        """

        # Format case data into readable text for GPT
        case_text = f"""
ДАНІ ЗАЯВКИ:

Заявник:
- ПІБ: {case_data.get('applicant_last_name', '')} {case_data.get('applicant_first_name', '')} {case_data.get('applicant_middle_name', '')}
- Телефон: {case_data.get('applicant_phone', '')}
- Зв'язок: {case_data.get('applicant_relation', '')}

Зниклий:
- ПІБ: {case_data.get('missing_last_name', '')} {case_data.get('missing_first_name', '')} {case_data.get('missing_middle_name', '')}
- Дата народження: {case_data.get('missing_birthdate', '')}
- Стать: {case_data.get('missing_gender', '')}
- Телефон: {case_data.get('missing_phone', '')}

Місце зникнення:
- Населений пункт: {case_data.get('missing_settlement', '')}
- Область: {case_data.get('missing_region', '')}
- Адреса: {case_data.get('missing_address', '')}

Обставини:
- Коли бачили останній раз: {case_data.get('missing_last_seen_datetime', '')}
- Де бачили останній раз: {case_data.get('missing_last_seen_place', '')}
- Обставини зникнення: {case_data.get('disappearance_circumstances', '')}

Зовнішність:
- Опис: {case_data.get('missing_description', '')}
- Особливі прикмети: {case_data.get('missing_special_signs', '')}

Одяг та речі:
- Одяг: {case_data.get('missing_clothing', '')}
- Особисті речі: {case_data.get('missing_belongings', '')}

Медична інформація:
- Захворювання: {case_data.get('missing_diseases', '')}

Додаткова інформація:
- {case_data.get('additional_info', '')}
- {case_data.get('initial_info', '')}
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
