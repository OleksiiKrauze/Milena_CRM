from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class FlyerTemplateCreate(BaseModel):
    """Schema for creating a flyer template"""
    template_type: str = Field(..., description="Template type: main, additional, or logo")
    file_name: str = Field(..., min_length=1, max_length=255)
    file_path: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None


class FlyerTemplateUpdate(BaseModel):
    """Schema for updating a flyer template"""
    description: Optional[str] = None
    is_active: Optional[int] = None


class FlyerTemplateResponse(BaseModel):
    """Schema for flyer template response"""
    id: int
    created_at: datetime
    template_type: str
    file_name: str
    file_path: str
    description: Optional[str]
    is_active: int

    model_config = {"from_attributes": True}


class FlyerTemplateListResponse(BaseModel):
    """Schema for flyer template list"""
    total: int
    templates: list[FlyerTemplateResponse]
