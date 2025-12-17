from pydantic import BaseModel, Field
from typing import Optional


class DirectionCreate(BaseModel):
    """Schema for creating a direction"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=255)


class DirectionUpdate(BaseModel):
    """Schema for updating a direction"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=255)


class DirectionResponse(BaseModel):
    """Schema for direction response"""
    id: int
    name: str
    description: Optional[str]

    model_config = {"from_attributes": True}
