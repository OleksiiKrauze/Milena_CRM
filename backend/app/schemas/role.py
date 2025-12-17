from pydantic import BaseModel, Field
from typing import Optional


class RoleCreate(BaseModel):
    """Schema for creating a role"""
    name: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=255)


class RoleUpdate(BaseModel):
    """Schema for updating a role"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=255)


class RoleResponse(BaseModel):
    """Schema for role response"""
    id: int
    name: str
    description: Optional[str]

    model_config = {"from_attributes": True}
