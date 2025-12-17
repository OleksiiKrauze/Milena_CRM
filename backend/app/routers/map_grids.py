from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db import get_db
from app.schemas.map_grid import (
    MapGridCreate, MapGridUpdate, MapGridResponse, MapGridListResponse,
    MapGridWithCellsResponse, GridCellCreate, GridCellUpdate, GridCellResponse
)
from app.models.map_grid import MapGrid, GridCell, GridCellStatus
from app.models.search import Search
from app.models.field_search import FieldSearch
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/map_grids", tags=["Map Grids"])


@router.post("/", response_model=MapGridResponse, status_code=status.HTTP_201_CREATED)
def create_map_grid(
    map_grid_data: MapGridCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new map grid for a search"""
    # Verify search exists
    search = db.query(Search).filter(Search.id == map_grid_data.search_id).first()
    if not search:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Search with id {map_grid_data.search_id} not found"
        )

    # Verify initiator_inforg_id if provided
    if map_grid_data.initiator_inforg_id:
        initiator = db.query(User).filter(User.id == map_grid_data.initiator_inforg_id).first()
        if not initiator:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id {map_grid_data.initiator_inforg_id} not found"
            )

    db_map_grid = MapGrid(
        search_id=map_grid_data.search_id,
        initiator_inforg_id=map_grid_data.initiator_inforg_id,
        hq_coordinates=map_grid_data.hq_coordinates,
        center_coordinates=map_grid_data.center_coordinates,
        grid_size=map_grid_data.grid_size,
        map_file_url=map_grid_data.map_file_url,
        notes=map_grid_data.notes
    )

    db.add(db_map_grid)
    db.commit()
    db.refresh(db_map_grid)

    return db_map_grid


@router.get("/", response_model=MapGridListResponse)
def list_map_grids(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Max number of records to return"),
    search_id: Optional[int] = Query(None, description="Filter by search ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of map grids with pagination and filters"""
    query = db.query(MapGrid)

    # Filter by search_id if provided
    if search_id:
        query = query.filter(MapGrid.search_id == search_id)

    total = query.count()
    map_grids = query.order_by(MapGrid.created_at.desc()).offset(skip).limit(limit).all()

    return {"total": total, "map_grids": map_grids}


@router.get("/{map_grid_id}", response_model=MapGridWithCellsResponse)
def get_map_grid(
    map_grid_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get map grid by ID with all its cells"""
    db_map_grid = db.query(MapGrid).filter(MapGrid.id == map_grid_id).first()

    if not db_map_grid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Map grid with id {map_grid_id} not found"
        )

    return db_map_grid


@router.put("/{map_grid_id}", response_model=MapGridResponse)
def update_map_grid(
    map_grid_id: int,
    map_grid_data: MapGridUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update map grid by ID"""
    db_map_grid = db.query(MapGrid).filter(MapGrid.id == map_grid_id).first()

    if not db_map_grid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Map grid with id {map_grid_id} not found"
        )

    # Update fields if provided
    update_data = map_grid_data.model_dump(exclude_unset=True)

    # Verify initiator_inforg_id if being updated
    if "initiator_inforg_id" in update_data and update_data["initiator_inforg_id"]:
        initiator = db.query(User).filter(User.id == update_data["initiator_inforg_id"]).first()
        if not initiator:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id {update_data['initiator_inforg_id']} not found"
            )

    for field, value in update_data.items():
        setattr(db_map_grid, field, value)

    db.commit()
    db.refresh(db_map_grid)

    return db_map_grid


@router.delete("/{map_grid_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_map_grid(
    map_grid_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete map grid by ID"""
    db_map_grid = db.query(MapGrid).filter(MapGrid.id == map_grid_id).first()

    if not db_map_grid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Map grid with id {map_grid_id} not found"
        )

    db.delete(db_map_grid)
    db.commit()

    return None


# Grid Cells endpoints (nested under map_grids)

@router.post("/{map_grid_id}/cells", response_model=GridCellResponse, status_code=status.HTTP_201_CREATED)
def create_grid_cell(
    map_grid_id: int,
    cell_data: GridCellCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new grid cell for a map grid"""
    # Verify map grid exists
    db_map_grid = db.query(MapGrid).filter(MapGrid.id == map_grid_id).first()
    if not db_map_grid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Map grid with id {map_grid_id} not found"
        )

    # Verify assigned_to_field_search_id if provided
    if cell_data.assigned_to_field_search_id:
        field_search = db.query(FieldSearch).filter(
            FieldSearch.id == cell_data.assigned_to_field_search_id
        ).first()
        if not field_search:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Field search with id {cell_data.assigned_to_field_search_id} not found"
            )

    # Parse status enum
    cell_status = GridCellStatus.unassigned
    if cell_data.status:
        try:
            cell_status = GridCellStatus[cell_data.status]
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid grid cell status: {cell_data.status}"
            )

    db_cell = GridCell(
        map_grid_id=map_grid_id,
        cell_code=cell_data.cell_code,
        coordinates=cell_data.coordinates,
        status=cell_status,
        assigned_to_field_search_id=cell_data.assigned_to_field_search_id,
        notes=cell_data.notes
    )

    db.add(db_cell)
    db.commit()
    db.refresh(db_cell)

    return db_cell


@router.get("/{map_grid_id}/cells", response_model=List[GridCellResponse])
def list_grid_cells(
    map_grid_id: int,
    status_filter: Optional[str] = Query(None, description="Filter by cell status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of grid cells for a map grid"""
    # Verify map grid exists
    db_map_grid = db.query(MapGrid).filter(MapGrid.id == map_grid_id).first()
    if not db_map_grid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Map grid with id {map_grid_id} not found"
        )

    query = db.query(GridCell).filter(GridCell.map_grid_id == map_grid_id)

    # Filter by status if provided
    if status_filter:
        try:
            status_enum = GridCellStatus[status_filter]
            query = query.filter(GridCell.status == status_enum)
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}"
            )

    cells = query.order_by(GridCell.cell_code).all()
    return cells


@router.put("/{map_grid_id}/cells/{cell_id}", response_model=GridCellResponse)
def update_grid_cell(
    map_grid_id: int,
    cell_id: int,
    cell_data: GridCellUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update grid cell by ID"""
    db_cell = db.query(GridCell).filter(
        GridCell.id == cell_id,
        GridCell.map_grid_id == map_grid_id
    ).first()

    if not db_cell:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Grid cell with id {cell_id} not found in map grid {map_grid_id}"
        )

    # Update fields if provided
    update_data = cell_data.model_dump(exclude_unset=True)

    # Handle status separately to convert string to enum
    if "status" in update_data:
        try:
            update_data["status"] = GridCellStatus[update_data["status"]]
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid grid cell status: {update_data['status']}"
            )

    # Verify assigned_to_field_search_id if being updated
    if "assigned_to_field_search_id" in update_data and update_data["assigned_to_field_search_id"]:
        field_search = db.query(FieldSearch).filter(
            FieldSearch.id == update_data["assigned_to_field_search_id"]
        ).first()
        if not field_search:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Field search with id {update_data['assigned_to_field_search_id']} not found"
            )

    for field, value in update_data.items():
        setattr(db_cell, field, value)

    db.commit()
    db.refresh(db_cell)

    return db_cell


@router.delete("/{map_grid_id}/cells/{cell_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_grid_cell(
    map_grid_id: int,
    cell_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete grid cell by ID"""
    db_cell = db.query(GridCell).filter(
        GridCell.id == cell_id,
        GridCell.map_grid_id == map_grid_id
    ).first()

    if not db_cell:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Grid cell with id {cell_id} not found in map grid {map_grid_id}"
        )

    db.delete(db_cell)
    db.commit()

    return None
