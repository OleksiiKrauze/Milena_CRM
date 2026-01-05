from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime, date, time


class PublicCaseCreate(BaseModel):
    """
    Schema for creating a case from public website form.
    Matches fields from https://milena.in.ua/application-for-a-person-search/
    """
    # Required fields (marked as required on website)
    applicant_full_name: str = Field(
        ...,
        min_length=1,
        max_length=300,
        description="Заявник: ПІБ, ким доводиться зниклому"
    )
    applicant_phone: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Контакти заявника: телефон"
    )
    missing_full_name: str = Field(
        ...,
        min_length=1,
        max_length=300,
        description="ПІБ зниклого"
    )

    # Optional fields
    subject: Optional[str] = Field(None, max_length=500, description="Тема")
    applicant_relation: Optional[str] = Field(None, max_length=100, description="Ким доводиться зниклому")
    missing_gender: Optional[str] = Field(None, max_length=20, description="Стать зниклого")
    missing_birthdate: Optional[date] = Field(None, description="Дата народження")
    missing_region: Optional[str] = Field(None, max_length=200, description="Область зникнення")
    additional_search_regions: Optional[str] = Field(None, max_length=500, description="Додаткові області пошуку")
    missing_phone: Optional[str] = Field(None, max_length=50, description="Номер телефону зниклого")
    missing_settlement: Optional[str] = Field(None, max_length=200, description="Місцевість зникнення")
    missing_last_seen_date: Optional[date] = Field(None, description="Дата зникнення")
    missing_last_seen_time: Optional[time] = Field(None, description="Час зникнення")
    police_report_info: Optional[str] = Field(None, max_length=500, description="Заява в поліцію")
    search_terrain_type: Optional[str] = Field(None, max_length=50, description="Тип місцевості (Місто/Ліс)")
    disappearance_circumstances: Optional[str] = Field(None, description="Обставини зникнення")
    missing_diseases: Optional[str] = Field(None, description="Стан здоров'я")
    missing_clothing: Optional[str] = Field(None, description="Одяг")
    missing_special_signs: Optional[str] = Field(None, description="Особливі прикмети")
    missing_belongings: Optional[str] = Field(None, description="Речі при собі")
    missing_photos: Optional[List[str]] = Field(default=[], description="Фото зниклого (URLs)")
    additional_info: Optional[str] = Field(None, description="Додаткова інформація")

    # Internal fields for processing
    recaptcha_token: Optional[str] = Field(None, description="reCAPTCHA token for spam protection")

    @field_validator('missing_gender')
    @classmethod
    def validate_gender(cls, v):
        """Validate gender field"""
        if v and v not in ['Чоловіча', 'Жіноча', 'Інше', 'male', 'female', 'other', None]:
            # Accept both Ukrainian and English values
            return v
        return v

    def to_case_create(self) -> dict:
        """
        Convert public case data to internal CaseCreate format.
        Splits full names into separate fields required by the database.
        """
        # Split applicant full name into parts (Last First Middle)
        applicant_parts = self.applicant_full_name.strip().split(maxsplit=2)
        applicant_last_name = applicant_parts[0] if len(applicant_parts) > 0 else "Невідомо"
        applicant_first_name = applicant_parts[1] if len(applicant_parts) > 1 else "Невідомо"
        applicant_middle_name = applicant_parts[2] if len(applicant_parts) > 2 else None

        # Split missing person full name into parts (Last First Middle)
        missing_parts = self.missing_full_name.strip().split(maxsplit=2)
        missing_last_name = missing_parts[0] if len(missing_parts) > 0 else "Невідомо"
        missing_first_name = missing_parts[1] if len(missing_parts) > 1 else "Невідомо"
        missing_middle_name = missing_parts[2] if len(missing_parts) > 2 else None

        # Combine date and time for last seen datetime
        missing_last_seen_datetime = None
        if self.missing_last_seen_date:
            if self.missing_last_seen_time:
                missing_last_seen_datetime = datetime.combine(
                    self.missing_last_seen_date,
                    self.missing_last_seen_time
                )
            else:
                # If only date provided, set time to midnight
                missing_last_seen_datetime = datetime.combine(
                    self.missing_last_seen_date,
                    time(0, 0)
                )

        # Parse additional search regions from comma-separated string to array
        additional_regions_list = []
        if self.additional_search_regions:
            additional_regions_list = [
                region.strip()
                for region in self.additional_search_regions.split(',')
                if region.strip()
            ]

        # Build initial_info from all provided data for reference
        initial_info_parts = []
        if self.subject:
            initial_info_parts.append(f"Тема: {self.subject}")
        if self.disappearance_circumstances:
            initial_info_parts.append(f"Обставини: {self.disappearance_circumstances}")
        if self.police_report_info:
            initial_info_parts.append(f"Поліція: {self.police_report_info}")

        initial_info = "\n".join(initial_info_parts) if initial_info_parts else None

        return {
            "basis": "Заявка з сайту milena.in.ua",
            # Applicant data
            "applicant_last_name": applicant_last_name,
            "applicant_first_name": applicant_first_name,
            "applicant_middle_name": applicant_middle_name,
            "applicant_phone": self.applicant_phone,
            "applicant_relation": self.applicant_relation,
            # Missing person data
            "missing_last_name": missing_last_name,
            "missing_first_name": missing_first_name,
            "missing_middle_name": missing_middle_name,
            "missing_gender": self.missing_gender,
            "missing_birthdate": datetime.combine(self.missing_birthdate, time(0, 0)) if self.missing_birthdate else None,
            "missing_photos": self.missing_photos or [],
            "missing_last_seen_datetime": missing_last_seen_datetime,
            "missing_last_seen_place": self.missing_settlement,
            "missing_special_signs": self.missing_special_signs,
            "missing_diseases": self.missing_diseases,
            "missing_phone": self.missing_phone,
            "missing_clothing": self.missing_clothing,
            "missing_belongings": self.missing_belongings,
            "missing_settlement": self.missing_settlement,
            "missing_region": self.missing_region,
            # Additional case information
            "additional_search_regions": additional_regions_list,
            "search_terrain_type": self.search_terrain_type,
            "disappearance_circumstances": self.disappearance_circumstances,
            "initial_info": initial_info,
            "additional_info": self.additional_info,
            # Set decision type for public submissions
            "decision_type": "На розгляді",
            "tags": ["Заявка з сайту"],
            "police_report_filed": bool(self.police_report_info),
        }


class PublicCaseResponse(BaseModel):
    """Response for public case submission"""
    success: bool
    message: str
    case_id: Optional[int] = None


class TelegramCaseCreate(BaseModel):
    """Schema for creating case from Telegram bot"""
    initial_info: str = Field(
        ...,
        min_length=10,
        max_length=10000,
        description="Текстова інформація про заявку від користувача Telegram"
    )


class TelegramCaseResponse(BaseModel):
    """Response for Telegram case creation"""
    success: bool
    message: str
    case_id: Optional[int] = None


class TelegramPhotosResponse(BaseModel):
    """Response for adding photos to Telegram case"""
    success: bool
    message: str
    photos_count: int
    photo_urls: List[str]
