from pydantic import BaseModel


class SettingsResponse(BaseModel):
    """Schema for settings response"""
    id: int
    case_autofill_prompt: str

    class Config:
        from_attributes = True


class SettingsUpdate(BaseModel):
    """Schema for updating settings"""
    case_autofill_prompt: str
