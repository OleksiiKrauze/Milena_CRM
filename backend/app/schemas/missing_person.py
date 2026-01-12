from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class MissingPersonBase(BaseModel):
    """Base schema for missing person"""
    last_name: str
    first_name: str
    middle_name: Optional[str] = None
    gender: Optional[str] = None
    birthdate: Optional[datetime] = None
    phone: Optional[str] = None
    settlement: Optional[str] = None
    region: Optional[str] = None
    address: Optional[str] = None
    last_seen_datetime: Optional[datetime] = None
    last_seen_place: Optional[str] = None
    photos: Optional[List[str]] = []
    description: Optional[str] = None
    special_signs: Optional[str] = None
    diseases: Optional[str] = None
    clothing: Optional[str] = None
    belongings: Optional[str] = None


class MissingPersonCreate(MissingPersonBase):
    """Schema for creating a missing person (used within case creation)"""
    order_index: Optional[int] = 0


class MissingPersonUpdate(BaseModel):
    """Schema for updating a missing person"""
    last_name: Optional[str] = None
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    gender: Optional[str] = None
    birthdate: Optional[datetime] = None
    phone: Optional[str] = None
    settlement: Optional[str] = None
    region: Optional[str] = None
    address: Optional[str] = None
    last_seen_datetime: Optional[datetime] = None
    last_seen_place: Optional[str] = None
    photos: Optional[List[str]] = None
    description: Optional[str] = None
    special_signs: Optional[str] = None
    diseases: Optional[str] = None
    clothing: Optional[str] = None
    belongings: Optional[str] = None
    order_index: Optional[int] = None


class MissingPerson(MissingPersonBase):
    """Schema for missing person with ID"""
    id: int
    case_id: int
    order_index: int

    class Config:
        from_attributes = True
