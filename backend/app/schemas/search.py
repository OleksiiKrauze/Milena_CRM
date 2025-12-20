from pydantic import BaseModel, Field
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime, date

if TYPE_CHECKING:
    from app.schemas.flyer import FlyerResponse
    from app.schemas.distribution import DistributionResponse
    from app.schemas.map_grid import MapGridResponse
    from app.schemas.field_search import FieldSearchResponse
    from app.schemas.event import EventResponse
    from app.schemas.orientation import OrientationResponse
    from app.schemas.case import CaseResponse

from app.schemas.auth import UserBrief, CaseBrief


class SearchCreate(BaseModel):
    """Schema for creating a search"""
    case_id: int = Field(..., description="Case ID this search belongs to")
    initiator_inforg_id: Optional[int] = Field(None, description="User ID of the inforg who initiated this search")
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    result: Optional[str] = Field(None, description="alive, dead, location_known, not_found")
    result_comment: Optional[str] = None
    status: Optional[str] = Field("planned", description="Search status: planned, active, completed, cancelled")
    notes: Optional[str] = None


class SearchUpdate(BaseModel):
    """Schema for updating a search"""
    initiator_inforg_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    result: Optional[str] = None
    result_comment: Optional[str] = None
    current_flyer_id: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class SearchResponse(BaseModel):
    """Schema for search response"""
    id: int
    case_id: int
    case: Optional[CaseBrief]
    created_at: datetime
    initiator_inforg_id: Optional[int]
    initiator_inforg: Optional[UserBrief]
    start_date: Optional[date]
    end_date: Optional[date]
    result: Optional[str]
    result_comment: Optional[str]
    current_flyer_id: Optional[int]
    status: str
    notes: Optional[str]

    model_config = {"from_attributes": True, "use_enum_values": True}


class SearchListResponse(BaseModel):
    """Schema for paginated search list"""
    total: int
    searches: List[SearchResponse]


class SearchFullResponse(SearchResponse):
    """Schema for search with all related data"""
    case: Optional["CaseResponse"] = None  # Override to include full case data for orientations
    flyers: List["FlyerResponse"] = []
    orientations: List["OrientationResponse"] = []
    distributions: List["DistributionResponse"] = []
    map_grids: List["MapGridResponse"] = []
    field_searches: List["FieldSearchResponse"] = []
    events: List["EventResponse"] = []

    model_config = {"from_attributes": True, "use_enum_values": True}


# Rebuild models to resolve forward references
from app.schemas.case import CaseResponse
from app.schemas.flyer import FlyerResponse
from app.schemas.orientation import OrientationResponse
from app.schemas.distribution import DistributionResponse
from app.schemas.map_grid import MapGridResponse
from app.schemas.field_search import FieldSearchResponse
from app.schemas.event import EventResponse

SearchFullResponse.model_rebuild()
