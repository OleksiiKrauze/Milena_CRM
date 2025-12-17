from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db import get_db
from app.schemas.flyer import FlyerCreate, FlyerUpdate, FlyerResponse, FlyerListResponse
from app.models.flyer import Flyer
from app.models.search import Search
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/flyers", tags=["Flyers"])


@router.post("/", response_model=FlyerResponse, status_code=status.HTTP_201_CREATED)
def create_flyer(
    flyer_data: FlyerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new flyer for a search"""
    # Verify search exists
    search = db.query(Search).filter(Search.id == flyer_data.search_id).first()
    if not search:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Search with id {flyer_data.search_id} not found"
        )

    # Verify initiator_inforg_id if provided
    if flyer_data.initiator_inforg_id:
        initiator = db.query(User).filter(User.id == flyer_data.initiator_inforg_id).first()
        if not initiator:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id {flyer_data.initiator_inforg_id} not found"
            )

    db_flyer = Flyer(
        search_id=flyer_data.search_id,
        initiator_inforg_id=flyer_data.initiator_inforg_id,
        title=flyer_data.title,
        content=flyer_data.content,
        photo_url=flyer_data.photo_url,
        file_url=flyer_data.file_url,
        is_active=flyer_data.is_active if flyer_data.is_active is not None else True,
        version=flyer_data.version if flyer_data.version is not None else 1
    )

    db.add(db_flyer)
    db.commit()
    db.refresh(db_flyer)

    return db_flyer


@router.get("/", response_model=FlyerListResponse)
def list_flyers(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Max number of records to return"),
    search_id: Optional[int] = Query(None, description="Filter by search ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of flyers with pagination and filters"""
    query = db.query(Flyer)

    # Filter by search_id if provided
    if search_id:
        query = query.filter(Flyer.search_id == search_id)

    # Filter by is_active if provided
    if is_active is not None:
        query = query.filter(Flyer.is_active == is_active)

    total = query.count()
    flyers = query.order_by(Flyer.created_at.desc()).offset(skip).limit(limit).all()

    return {"total": total, "flyers": flyers}


@router.get("/{flyer_id}", response_model=FlyerResponse)
def get_flyer(
    flyer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get flyer by ID"""
    db_flyer = db.query(Flyer).filter(Flyer.id == flyer_id).first()

    if not db_flyer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flyer with id {flyer_id} not found"
        )

    return db_flyer


@router.put("/{flyer_id}", response_model=FlyerResponse)
def update_flyer(
    flyer_id: int,
    flyer_data: FlyerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update flyer by ID"""
    db_flyer = db.query(Flyer).filter(Flyer.id == flyer_id).first()

    if not db_flyer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flyer with id {flyer_id} not found"
        )

    # Update fields if provided
    update_data = flyer_data.model_dump(exclude_unset=True)

    # Verify initiator_inforg_id if being updated
    if "initiator_inforg_id" in update_data and update_data["initiator_inforg_id"]:
        initiator = db.query(User).filter(User.id == update_data["initiator_inforg_id"]).first()
        if not initiator:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id {update_data['initiator_inforg_id']} not found"
            )

    for field, value in update_data.items():
        setattr(db_flyer, field, value)

    db.commit()
    db.refresh(db_flyer)

    return db_flyer


@router.delete("/{flyer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_flyer(
    flyer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete flyer by ID"""
    db_flyer = db.query(Flyer).filter(Flyer.id == flyer_id).first()

    if not db_flyer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flyer with id {flyer_id} not found"
        )

    db.delete(db_flyer)
    db.commit()

    return None
