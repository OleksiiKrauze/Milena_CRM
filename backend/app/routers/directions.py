from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db import get_db
from app.schemas.direction import DirectionCreate, DirectionUpdate, DirectionResponse
from app.models.user import Direction, User
from app.routers.auth import get_current_user, require_role

router = APIRouter(prefix="/directions", tags=["Directions"])


@router.post("/", response_model=DirectionResponse, status_code=status.HTTP_201_CREATED)
def create_direction(
    direction_data: DirectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Create a new direction (admin only)"""
    # Check if direction with this name already exists
    existing_direction = db.query(Direction).filter(Direction.name == direction_data.name).first()
    if existing_direction:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Direction '{direction_data.name}' already exists"
        )

    db_direction = Direction(
        name=direction_data.name,
        description=direction_data.description
    )

    db.add(db_direction)
    db.commit()
    db.refresh(db_direction)

    return db_direction


@router.get("/", response_model=List[DirectionResponse])
def list_directions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of all directions"""
    directions = db.query(Direction).order_by(Direction.name).all()
    return directions


@router.get("/{direction_id}", response_model=DirectionResponse)
def get_direction(
    direction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get direction by ID"""
    db_direction = db.query(Direction).filter(Direction.id == direction_id).first()

    if not db_direction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Direction with id {direction_id} not found"
        )

    return db_direction


@router.put("/{direction_id}", response_model=DirectionResponse)
def update_direction(
    direction_id: int,
    direction_data: DirectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Update direction by ID (admin only)"""
    db_direction = db.query(Direction).filter(Direction.id == direction_id).first()

    if not db_direction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Direction with id {direction_id} not found"
        )

    # Check if new name conflicts with existing direction
    if direction_data.name and direction_data.name != db_direction.name:
        existing_direction = db.query(Direction).filter(Direction.name == direction_data.name).first()
        if existing_direction:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Direction '{direction_data.name}' already exists"
            )

    # Update fields if provided
    update_data = direction_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_direction, field, value)

    db.commit()
    db.refresh(db_direction)

    return db_direction


@router.delete("/{direction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_direction(
    direction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Delete direction by ID (admin only)"""
    db_direction = db.query(Direction).filter(Direction.id == direction_id).first()

    if not db_direction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Direction with id {direction_id} not found"
        )

    db.delete(db_direction)
    db.commit()

    return None
