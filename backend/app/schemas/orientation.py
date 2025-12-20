from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class OrientationCreate(BaseModel):
    """Schema for creating an orientation"""
    search_id: int = Field(..., description="ID of the search this orientation belongs to")
    template_id: Optional[int] = Field(None, description="ID of the selected flyer template")
    selected_photos: list[str] = Field(default_factory=list, description="URLs to selected photos")
    canvas_data: dict = Field(default_factory=dict, description="Canvas state (positions, sizes, layers)")
    text_content: Optional[str] = Field(None, description="Text content of the orientation")
    is_approved: bool = Field(default=False, description="Whether the orientation is approved")
    exported_files: list[str] = Field(default_factory=list, description="URLs to exported orientation files")


class OrientationUpdate(BaseModel):
    """Schema for updating an orientation"""
    template_id: Optional[int] = None
    selected_photos: Optional[list[str]] = None
    canvas_data: Optional[dict] = None
    text_content: Optional[str] = None
    is_approved: Optional[bool] = None
    exported_files: Optional[list[str]] = None


class OrientationResponse(BaseModel):
    """Schema for orientation response"""
    id: int
    search_id: int
    created_at: datetime
    updated_at: Optional[datetime]
    template_id: Optional[int]
    selected_photos: list[str]
    canvas_data: dict
    text_content: Optional[str]
    is_approved: bool
    exported_files: list[str]

    model_config = {"from_attributes": True}


class OrientationListResponse(BaseModel):
    """Schema for orientation list"""
    total: int
    orientations: list[OrientationResponse]
