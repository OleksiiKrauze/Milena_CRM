from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class InstitutionsCallCreate(BaseModel):
    """Schema for creating an institutions call"""
    case_id: int = Field(..., description="Case ID this call belongs to")
    user_id: Optional[int] = Field(None, description="User ID who made the call")
    organization_name: str = Field(..., min_length=1, max_length=255, description="Name of the organization")
    organization_type: Optional[str] = Field(None, max_length=100, description="Type: hospital, morgue, police, shelter, etc.")
    phone: Optional[str] = Field(None, max_length=50)
    result: Optional[str] = Field(None, description="Result of the call")
    notes: Optional[str] = None


class InstitutionsCallUpdate(BaseModel):
    """Schema for updating an institutions call"""
    user_id: Optional[int] = None
    organization_name: Optional[str] = Field(None, min_length=1, max_length=255)
    organization_type: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    result: Optional[str] = None
    notes: Optional[str] = None


class InstitutionsCallResponse(BaseModel):
    """Schema for institutions call response"""
    id: int
    case_id: int
    created_at: datetime
    user_id: Optional[int]
    organization_name: str
    organization_type: Optional[str]
    phone: Optional[str]
    result: Optional[str]
    notes: Optional[str]

    model_config = {"from_attributes": True}


class InstitutionsCallListResponse(BaseModel):
    """Schema for paginated institutions call list"""
    total: int
    institutions_calls: List[InstitutionsCallResponse]
