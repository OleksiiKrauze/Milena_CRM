from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.schemas.auth import UserBrief


class OrganizationCreate(BaseModel):
    """Schema for creating an organization"""
    name: str = Field(..., min_length=1, max_length=255, description="Organization name")
    type: str = Field(..., description="Organization type: police, medical, transport, religious, shelter")

    region: Optional[str] = Field(None, max_length=200, description="Region/Oblast")
    city: Optional[str] = Field(None, max_length=200, description="City/Settlement")
    address: Optional[str] = Field(None, max_length=500, description="Full address")

    contact_info: Optional[str] = Field(None, description="Contact information (phones, emails, working hours)")
    notes: Optional[str] = Field(None, description="Additional notes/comments")


class OrganizationUpdate(BaseModel):
    """Schema for updating an organization"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    type: Optional[str] = None

    region: Optional[str] = Field(None, max_length=200)
    city: Optional[str] = Field(None, max_length=200)
    address: Optional[str] = Field(None, max_length=500)

    contact_info: Optional[str] = None
    notes: Optional[str] = None


class OrganizationResponse(BaseModel):
    """Schema for organization response"""
    id: int
    created_at: datetime
    created_by_user_id: Optional[int]
    created_by: Optional[UserBrief]
    updated_at: Optional[datetime]
    updated_by_user_id: Optional[int]
    updated_by: Optional[UserBrief]

    name: str
    type: str

    region: Optional[str]
    city: Optional[str]
    address: Optional[str]

    contact_info: Optional[str]
    notes: Optional[str]

    model_config = {"from_attributes": True, "use_enum_values": True}


class OrganizationListResponse(BaseModel):
    """Schema for paginated organization list"""
    total: int
    organizations: List[OrganizationResponse]
