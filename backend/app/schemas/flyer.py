from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class FlyerCreate(BaseModel):
    """Schema for creating a flyer"""
    search_id: int = Field(..., description="Search ID this flyer belongs to")
    initiator_inforg_id: Optional[int] = Field(None, description="User ID of the inforg who created this flyer")
    title: str = Field(..., min_length=1, max_length=255)
    content: Optional[str] = None
    photo_url: Optional[str] = Field(None, max_length=500)
    file_url: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = True
    version: Optional[int] = 1


class FlyerUpdate(BaseModel):
    """Schema for updating a flyer"""
    initiator_inforg_id: Optional[int] = None
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = None
    photo_url: Optional[str] = Field(None, max_length=500)
    file_url: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None
    version: Optional[int] = None


class FlyerResponse(BaseModel):
    """Schema for flyer response"""
    id: int
    search_id: int
    created_at: datetime
    initiator_inforg_id: Optional[int]
    title: str
    content: Optional[str]
    photo_url: Optional[str]
    file_url: Optional[str]
    is_active: bool
    version: int

    model_config = {"from_attributes": True}


class FlyerListResponse(BaseModel):
    """Schema for paginated flyer list"""
    total: int
    flyers: List[FlyerResponse]
