"""
Event schemas for API requests/responses
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class UserBrief(BaseModel):
    """Brief user info for event responses"""
    id: int
    full_name: str

    class Config:
        from_attributes = True


class EventCreate(BaseModel):
    """Schema for creating a new event"""
    search_id: int = Field(..., description="ID of the search this event belongs to")
    event_datetime: datetime = Field(..., description="When the event occurred")
    event_type: str = Field(..., min_length=1, max_length=100, description="Type of event (показання свідка, фото, відео, etc.)")
    description: str = Field(..., min_length=1, description="Description of the event")
    media_files: list[str] = Field(default_factory=list, description="URLs to uploaded media files")


class EventUpdate(BaseModel):
    """Schema for updating an existing event"""
    event_datetime: Optional[datetime] = None
    event_type: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, min_length=1)
    media_files: Optional[list[str]] = None


class EventResponse(BaseModel):
    """Schema for event responses"""
    id: int
    search_id: int
    created_at: datetime
    created_by_user_id: Optional[int]
    created_by: Optional[UserBrief]
    event_datetime: datetime
    event_type: str
    description: str
    media_files: list[str]
    updated_at: Optional[datetime]
    updated_by_user_id: Optional[int]
    updated_by: Optional[UserBrief]

    class Config:
        from_attributes = True


class EventListResponse(BaseModel):
    """Schema for list of events"""
    total: int
    events: list[EventResponse]
