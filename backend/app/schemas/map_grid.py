from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class GridCellCreate(BaseModel):
    """Schema for creating a grid cell"""
    cell_code: str = Field(..., min_length=1, max_length=20, description="Cell code like A1, B2, etc.")
    coordinates: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field("unassigned", description="Cell status: unassigned, assigned, in_progress, completed")
    assigned_to_field_search_id: Optional[int] = None
    notes: Optional[str] = None


class GridCellUpdate(BaseModel):
    """Schema for updating a grid cell"""
    cell_code: Optional[str] = Field(None, min_length=1, max_length=20)
    coordinates: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = None
    assigned_to_field_search_id: Optional[int] = None
    notes: Optional[str] = None


class GridCellResponse(BaseModel):
    """Schema for grid cell response"""
    id: int
    map_grid_id: int
    cell_code: str
    coordinates: Optional[str]
    status: str
    assigned_to_field_search_id: Optional[int]
    notes: Optional[str]

    model_config = {"from_attributes": True}


class MapGridCreate(BaseModel):
    """Schema for creating a map grid"""
    search_id: int = Field(..., description="Search ID this map grid belongs to")
    initiator_inforg_id: Optional[int] = None
    hq_coordinates: Optional[str] = Field(None, max_length=100, description="HQ coordinates")
    center_coordinates: Optional[str] = Field(None, max_length=100, description="Map center coordinates")
    grid_size: Optional[int] = Field(None, description="Grid size (e.g., 3 for 3x3 grid)")
    map_file_url: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = None


class MapGridUpdate(BaseModel):
    """Schema for updating a map grid"""
    initiator_inforg_id: Optional[int] = None
    hq_coordinates: Optional[str] = Field(None, max_length=100)
    center_coordinates: Optional[str] = Field(None, max_length=100)
    grid_size: Optional[int] = None
    map_file_url: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = None


class MapGridResponse(BaseModel):
    """Schema for map grid response"""
    id: int
    search_id: int
    created_at: datetime
    initiator_inforg_id: Optional[int]
    hq_coordinates: Optional[str]
    center_coordinates: Optional[str]
    grid_size: Optional[int]
    map_file_url: Optional[str]
    notes: Optional[str]

    model_config = {"from_attributes": True}


class MapGridWithCellsResponse(BaseModel):
    """Schema for map grid with all its cells"""
    id: int
    search_id: int
    created_at: datetime
    initiator_inforg_id: Optional[int]
    hq_coordinates: Optional[str]
    center_coordinates: Optional[str]
    grid_size: Optional[int]
    map_file_url: Optional[str]
    notes: Optional[str]
    grid_cells: List[GridCellResponse]

    model_config = {"from_attributes": True}


class MapGridListResponse(BaseModel):
    """Schema for paginated map grid list"""
    total: int
    map_grids: List[MapGridResponse]
