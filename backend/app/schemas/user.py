from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional


class AssignRolesRequest(BaseModel):
    """Schema for assigning roles to a user"""
    role_ids: List[int] = Field(..., min_length=1, description="List of role IDs to assign")


class AssignDirectionsRequest(BaseModel):
    """Schema for assigning directions to a user"""
    direction_ids: List[int] = Field(..., min_length=1, description="List of direction IDs to assign")


class UserUpdate(BaseModel):
    """Schema for updating user information"""
    status: Optional[str] = None  # "active", "inactive", "pending"
    comment: Optional[str] = None
    role_ids: Optional[List[int]] = None
    direction_ids: Optional[List[int]] = None


class UserListResponse(BaseModel):
    """Schema for user in list"""
    id: int
    last_name: str
    first_name: str
    middle_name: Optional[str]
    full_name: str
    phone: str
    email: str
    city: str
    status: str

    model_config = {"from_attributes": True, "use_enum_values": True}


class RoleResponse(BaseModel):
    """Schema for role response"""
    id: int
    name: str
    description: Optional[str]
    parent_role_id: Optional[int] = None

    model_config = {"from_attributes": True}


class DirectionResponse(BaseModel):
    """Schema for direction response"""
    id: int
    name: str
    description: Optional[str]

    model_config = {"from_attributes": True}


class UserDetailResponse(BaseModel):
    """Schema for detailed user response"""
    id: int
    last_name: str
    first_name: str
    middle_name: Optional[str]
    full_name: str
    phone: str
    email: str
    city: str
    status: str
    comment: Optional[str]
    roles: List[RoleResponse] = []
    directions: List[DirectionResponse] = []

    model_config = {"from_attributes": True, "use_enum_values": True}


class UsersListResponse(BaseModel):
    """Schema for paginated users list"""
    users: List[UserListResponse]
    total: int


class ChangePasswordRequest(BaseModel):
    """Schema for changing password"""
    old_password: str = Field(..., min_length=6)
    new_password: str = Field(..., min_length=6)
