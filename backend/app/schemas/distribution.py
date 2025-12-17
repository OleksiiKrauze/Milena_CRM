from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class DistributionCreate(BaseModel):
    """Schema for creating a distribution"""
    search_id: int = Field(..., description="Search ID this distribution belongs to")
    flyer_id: Optional[int] = Field(None, description="Flyer ID to distribute")
    initiator_inforg_id: Optional[int] = Field(None, description="User ID of the inforg who initiated this distribution")
    settlements_text: Optional[str] = None
    channels: Optional[List[str]] = Field(default_factory=list, description="Distribution channels: telegram, whatsapp, vk, email, sms, etc.")
    status: Optional[str] = Field("planned", description="Distribution status: planned, in_progress, completed, failed")
    result_comment: Optional[str] = None


class DistributionUpdate(BaseModel):
    """Schema for updating a distribution"""
    flyer_id: Optional[int] = None
    initiator_inforg_id: Optional[int] = None
    settlements_text: Optional[str] = None
    channels: Optional[List[str]] = None
    status: Optional[str] = None
    result_comment: Optional[str] = None


class DistributionResponse(BaseModel):
    """Schema for distribution response"""
    id: int
    search_id: int
    flyer_id: Optional[int]
    created_at: datetime
    initiator_inforg_id: Optional[int]
    settlements_text: Optional[str]
    channels: List[str]
    status: str
    result_comment: Optional[str]

    model_config = {"from_attributes": True}


class DistributionListResponse(BaseModel):
    """Schema for paginated distribution list"""
    total: int
    distributions: List[DistributionResponse]
