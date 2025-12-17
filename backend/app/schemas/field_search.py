from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date


class ParticipantInfo(BaseModel):
    """Schema for participant info"""
    user_id: int
    role_on_field: Optional[str] = Field(None, max_length=50, description="coordinator, navigator, searcher, driver")
    group_name: Optional[str] = Field(None, max_length=50, description="Group A, Group B, etc.")


class AddParticipantsRequest(BaseModel):
    """Schema for adding participants to field search"""
    participants: List[ParticipantInfo] = Field(..., min_length=1)


class FieldSearchCreate(BaseModel):
    """Schema for creating a field search"""
    search_id: int = Field(..., description="Search ID this field search belongs to")
    initiator_inforg_id: Optional[int] = None
    start_date: Optional[date] = None
    flyer_id: Optional[int] = None
    meeting_datetime: Optional[datetime] = None
    meeting_place: Optional[str] = Field(None, max_length=500)
    coordinator_id: Optional[int] = None
    status: Optional[str] = Field("planning", description="Field search status: planning, active, completed, cancelled")
    end_date: Optional[date] = None
    result: Optional[str] = None
    notes: Optional[str] = None


class FieldSearchUpdate(BaseModel):
    """Schema for updating a field search"""
    initiator_inforg_id: Optional[int] = None
    start_date: Optional[date] = None
    flyer_id: Optional[int] = None
    meeting_datetime: Optional[datetime] = None
    meeting_place: Optional[str] = Field(None, max_length=500)
    coordinator_id: Optional[int] = None
    status: Optional[str] = None
    end_date: Optional[date] = None
    result: Optional[str] = None
    notes: Optional[str] = None


class FieldSearchResponse(BaseModel):
    """Schema for field search response"""
    id: int
    search_id: int
    created_at: datetime
    initiator_inforg_id: Optional[int]
    start_date: Optional[date]
    flyer_id: Optional[int]
    meeting_datetime: Optional[datetime]
    meeting_place: Optional[str]
    coordinator_id: Optional[int]
    status: str
    end_date: Optional[date]
    result: Optional[str]
    notes: Optional[str]

    model_config = {"from_attributes": True, "use_enum_values": True}


class FieldSearchListResponse(BaseModel):
    """Schema for paginated field search list"""
    total: int
    field_searches: List[FieldSearchResponse]
