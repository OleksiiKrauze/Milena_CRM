from sqlalchemy import Column, Integer, String, DateTime, Text, Enum as SQLEnum
from sqlalchemy.sql import func
from app.db import Base
import enum


class TemplateType(str, enum.Enum):
    """Template type enum"""
    main = "main"  # Основні шаблони
    additional = "additional"  # Додаткові шаблони
    logo = "logo"  # Логотипи


class FlyerTemplate(Base):
    """Flyer template for orientations"""
    __tablename__ = 'flyer_templates'

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    template_type = Column(SQLEnum(TemplateType), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)  # Original file name
    file_path = Column(String(500), nullable=False)  # Path to uploaded file
    description = Column(Text)  # Optional description
    gpt_prompt = Column(Text)  # GPT prompt for orientation text generation

    is_active = Column(Integer, default=1)  # 1 = active, 0 = inactive
