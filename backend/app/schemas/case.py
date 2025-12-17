from pydantic import BaseModel, Field
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime

if TYPE_CHECKING:
    from app.schemas.search import SearchResponse

from app.schemas.auth import UserBrief


class CaseCreate(BaseModel):
    """Schema for creating a case"""
    # Applicant info - split name fields
    applicant_last_name: str = Field(..., min_length=1, max_length=100)
    applicant_first_name: str = Field(..., min_length=1, max_length=100)
    applicant_middle_name: Optional[str] = Field(None, max_length=100)
    applicant_phone: Optional[str] = Field(None, max_length=50)
    applicant_relation: Optional[str] = Field(None, max_length=100)

    # Missing person info - location fields
    missing_settlement: Optional[str] = Field(None, max_length=200)
    missing_region: Optional[str] = Field(None, max_length=200)
    missing_address: Optional[str] = Field(None, max_length=500)

    # Missing person info - split name fields
    missing_last_name: str = Field(..., min_length=1, max_length=100)
    missing_first_name: str = Field(..., min_length=1, max_length=100)
    missing_middle_name: Optional[str] = Field(None, max_length=100)
    missing_gender: Optional[str] = Field(None, max_length=20)
    missing_birthdate: Optional[datetime] = None
    missing_photos: Optional[List[str]] = []
    missing_last_seen_datetime: Optional[datetime] = None
    missing_last_seen_place: Optional[str] = Field(None, max_length=500)
    missing_description: Optional[str] = None
    missing_special_signs: Optional[str] = None
    missing_diseases: Optional[str] = None

    # Case metadata
    decision_type: Optional[str] = "На розгляді"
    decision_comment: Optional[str] = None
    tags: Optional[List[str]] = []


class CaseUpdate(BaseModel):
    """Schema for updating a case"""
    # Applicant info - split name fields
    applicant_last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    applicant_first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    applicant_middle_name: Optional[str] = Field(None, max_length=100)
    applicant_phone: Optional[str] = Field(None, max_length=50)
    applicant_relation: Optional[str] = Field(None, max_length=100)

    # Missing person info - location fields
    missing_settlement: Optional[str] = Field(None, max_length=200)
    missing_region: Optional[str] = Field(None, max_length=200)
    missing_address: Optional[str] = Field(None, max_length=500)

    # Missing person info - split name fields
    missing_last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    missing_first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    missing_middle_name: Optional[str] = Field(None, max_length=100)
    missing_gender: Optional[str] = Field(None, max_length=20)
    missing_birthdate: Optional[datetime] = None
    missing_photos: Optional[List[str]] = None
    missing_last_seen_datetime: Optional[datetime] = None
    missing_last_seen_place: Optional[str] = Field(None, max_length=500)
    missing_description: Optional[str] = None
    missing_special_signs: Optional[str] = None
    missing_diseases: Optional[str] = None

    # Case metadata
    case_status: Optional[str] = None
    decision_type: Optional[str] = None
    decision_comment: Optional[str] = None
    tags: Optional[List[str]] = None


class CaseResponse(BaseModel):
    """Schema for case response"""
    id: int
    created_at: datetime
    created_by_user_id: Optional[int]
    created_by: Optional[UserBrief]
    updated_at: Optional[datetime]
    updated_by_user_id: Optional[int]
    updated_by: Optional[UserBrief]

    # Applicant info - split name fields
    applicant_last_name: str
    applicant_first_name: str
    applicant_middle_name: Optional[str]
    applicant_phone: Optional[str]
    applicant_relation: Optional[str]

    # Missing person info - location fields
    missing_settlement: Optional[str]
    missing_region: Optional[str]
    missing_address: Optional[str]

    # Missing person info - split name fields
    missing_last_name: str
    missing_first_name: str
    missing_middle_name: Optional[str]
    missing_gender: Optional[str]
    missing_birthdate: Optional[datetime]
    missing_photos: List[str]
    missing_last_seen_datetime: Optional[datetime]
    missing_last_seen_place: Optional[str]
    missing_description: Optional[str]
    missing_special_signs: Optional[str]
    missing_diseases: Optional[str]

    # Computed full names
    applicant_full_name: str
    missing_full_name: str

    # Case metadata
    case_status: str
    decision_type: str
    decision_comment: Optional[str]
    tags: List[str]

    model_config = {"from_attributes": True}


class CaseListResponse(BaseModel):
    """Schema for paginated case list"""
    total: int
    cases: List[CaseResponse]


class CaseFullResponse(CaseResponse):
    """Schema for case with all related data"""
    searches: List["SearchResponse"] = []

    model_config = {"from_attributes": True}


# Rebuild models to resolve forward references
from app.schemas.search import SearchResponse

CaseFullResponse.model_rebuild()
