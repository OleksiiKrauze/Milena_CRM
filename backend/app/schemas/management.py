from pydantic import BaseModel, Field
from typing import Optional, List


class RoleCreate(BaseModel):
    """Schema for creating a role"""
    name: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=255)
    parent_role_id: Optional[int] = None


class RoleUpdate(BaseModel):
    """Schema for updating a role"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=255)
    parent_role_id: Optional[int] = None


class RoleDetailResponse(BaseModel):
    """Schema for detailed role response with hierarchy"""
    id: int
    name: str
    description: Optional[str]
    parent_role_id: Optional[int]
    parent_role_name: Optional[str] = None

    model_config = {"from_attributes": True}


class DirectionCreate(BaseModel):
    """Schema for creating a direction"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    responsible_user_id: Optional[int] = None


class DirectionUpdate(BaseModel):
    """Schema for updating a direction"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    responsible_user_id: Optional[int] = None


class DirectionDetailResponse(BaseModel):
    """Schema for detailed direction response"""
    id: int
    name: str
    description: Optional[str]
    responsible_user_id: Optional[int]
    responsible_user_name: Optional[str] = None

    model_config = {"from_attributes": True}
