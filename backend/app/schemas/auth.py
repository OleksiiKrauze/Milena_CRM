from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List


class UserCreate(BaseModel):
    """Schema for creating a new user"""
    last_name: str = Field(..., min_length=1, max_length=100)
    first_name: str = Field(..., min_length=1, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    phone: str = Field(..., min_length=10, max_length=50)
    email: EmailStr
    city: Optional[str] = Field(None, max_length=100)
    password: str = Field(..., min_length=6, max_length=100)
    comment: Optional[str] = None


class UserLogin(BaseModel):
    """Schema for user login"""
    email: EmailStr
    password: str


class Token(BaseModel):
    """Schema for JWT token response"""
    access_token: str
    token_type: str = "bearer"


class RoleResponse(BaseModel):
    """Schema for role response"""
    id: int
    name: str

    model_config = {"from_attributes": True}


class DirectionResponse(BaseModel):
    """Schema for direction response"""
    id: int
    name: str

    model_config = {"from_attributes": True}


class UserBrief(BaseModel):
    """Schema for brief user info"""
    id: int
    full_name: str

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    """Schema for user response"""
    id: int
    last_name: str
    first_name: str
    middle_name: Optional[str]
    full_name: str  # Computed property from model
    phone: str
    email: str
    city: Optional[str]
    status: str
    comment: Optional[str]
    roles: List[RoleResponse] = []
    directions: List[DirectionResponse] = []

    model_config = {"from_attributes": True, "use_enum_values": True}


class TokenData(BaseModel):
    """Schema for token data"""
    user_id: Optional[int] = None
