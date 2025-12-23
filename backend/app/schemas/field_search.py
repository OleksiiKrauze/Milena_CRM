from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from app.schemas.auth import UserBrief, CaseBrief


class ParticipantInfo(BaseModel):
    """Schema for participant info"""
    user_id: int
    role_on_field: Optional[str] = Field(None, max_length=50, description="coordinator, navigator, searcher, driver")
    group_name: Optional[str] = Field(None, max_length=50, description="Group A, Group B, etc.")


class AddParticipantsRequest(BaseModel):
    """Schema for adding participants to field search"""
    participants: List[ParticipantInfo] = Field(..., min_length=1)


class SearchBrief(BaseModel):
    """Schema for brief search info"""
    id: int
    case_id: int
    case: Optional[CaseBrief]

    model_config = {"from_attributes": True}


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

    # Preparation section
    preparation_grid_file: Optional[str] = Field(None, max_length=500, description="URL to grid file (gpx/kml)")
    preparation_map_image: Optional[str] = Field(None, max_length=500, description="URL to map image")

    # Search progress section
    search_tracks: Optional[List[str]] = Field(default=[], description="URLs to track files (gpx/kml)")
    search_photos: Optional[List[str]] = Field(default=[], description="URLs to photos")


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

    # Preparation section
    preparation_grid_file: Optional[str] = Field(None, max_length=500)
    preparation_map_image: Optional[str] = Field(None, max_length=500)

    # Search progress section
    search_tracks: Optional[List[str]] = None
    search_photos: Optional[List[str]] = None


class FieldSearchResponse(BaseModel):
    """Schema for field search response"""
    id: int
    search_id: int
    search: Optional[SearchBrief]
    case_id: Optional[int]
    created_at: datetime
    initiator_inforg_id: Optional[int]
    initiator_inforg: Optional[UserBrief]
    start_date: Optional[date]
    flyer_id: Optional[int]
    meeting_datetime: Optional[datetime]
    meeting_place: Optional[str]
    coordinator_id: Optional[int]
    coordinator: Optional[UserBrief]
    status: str
    end_date: Optional[date]
    result: Optional[str]
    notes: Optional[str]

    # Preparation section
    preparation_grid_file: Optional[str]
    preparation_map_image: Optional[str]

    # Search progress section
    search_tracks: List[str]
    search_photos: List[str]

    model_config = {"from_attributes": True, "use_enum_values": True}


class FieldSearchListResponse(BaseModel):
    """Schema for paginated field search list"""
    total: int
    field_searches: List[FieldSearchResponse]
