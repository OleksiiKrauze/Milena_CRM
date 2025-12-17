from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db import get_db
from app.schemas.distribution import DistributionCreate, DistributionUpdate, DistributionResponse, DistributionListResponse
from app.models.distribution import Distribution, DistributionStatus
from app.models.search import Search
from app.models.flyer import Flyer
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/distributions", tags=["Distributions"])


@router.post("/", response_model=DistributionResponse, status_code=status.HTTP_201_CREATED)
def create_distribution(
    distribution_data: DistributionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new distribution for a search"""
    # Verify search exists
    search = db.query(Search).filter(Search.id == distribution_data.search_id).first()
    if not search:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Search with id {distribution_data.search_id} not found"
        )

    # Verify flyer_id if provided
    if distribution_data.flyer_id:
        flyer = db.query(Flyer).filter(Flyer.id == distribution_data.flyer_id).first()
        if not flyer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Flyer with id {distribution_data.flyer_id} not found"
            )

    # Verify initiator_inforg_id if provided
    if distribution_data.initiator_inforg_id:
        initiator = db.query(User).filter(User.id == distribution_data.initiator_inforg_id).first()
        if not initiator:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id {distribution_data.initiator_inforg_id} not found"
            )

    # Parse status enum
    dist_status = DistributionStatus.planned
    if distribution_data.status:
        try:
            dist_status = DistributionStatus[distribution_data.status]
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid distribution status: {distribution_data.status}"
            )

    db_distribution = Distribution(
        search_id=distribution_data.search_id,
        flyer_id=distribution_data.flyer_id,
        initiator_inforg_id=distribution_data.initiator_inforg_id,
        settlements_text=distribution_data.settlements_text,
        channels=distribution_data.channels if distribution_data.channels else [],
        status=dist_status,
        result_comment=distribution_data.result_comment
    )

    db.add(db_distribution)
    db.commit()
    db.refresh(db_distribution)

    return db_distribution


@router.get("/", response_model=DistributionListResponse)
def list_distributions(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Max number of records to return"),
    search_id: Optional[int] = Query(None, description="Filter by search ID"),
    status_filter: Optional[str] = Query(None, description="Filter by distribution status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of distributions with pagination and filters"""
    query = db.query(Distribution)

    # Filter by search_id if provided
    if search_id:
        query = query.filter(Distribution.search_id == search_id)

    # Filter by status if provided
    if status_filter:
        try:
            status_enum = DistributionStatus[status_filter]
            query = query.filter(Distribution.status == status_enum)
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}"
            )

    total = query.count()
    distributions = query.order_by(Distribution.created_at.desc()).offset(skip).limit(limit).all()

    return {"total": total, "distributions": distributions}


@router.get("/{distribution_id}", response_model=DistributionResponse)
def get_distribution(
    distribution_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get distribution by ID"""
    db_distribution = db.query(Distribution).filter(Distribution.id == distribution_id).first()

    if not db_distribution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Distribution with id {distribution_id} not found"
        )

    return db_distribution


@router.put("/{distribution_id}", response_model=DistributionResponse)
def update_distribution(
    distribution_id: int,
    distribution_data: DistributionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update distribution by ID"""
    db_distribution = db.query(Distribution).filter(Distribution.id == distribution_id).first()

    if not db_distribution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Distribution with id {distribution_id} not found"
        )

    # Update fields if provided
    update_data = distribution_data.model_dump(exclude_unset=True)

    # Handle status separately to convert string to enum
    if "status" in update_data:
        try:
            update_data["status"] = DistributionStatus[update_data["status"]]
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid distribution status: {update_data['status']}"
            )

    # Verify flyer_id if being updated
    if "flyer_id" in update_data and update_data["flyer_id"]:
        flyer = db.query(Flyer).filter(Flyer.id == update_data["flyer_id"]).first()
        if not flyer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Flyer with id {update_data['flyer_id']} not found"
            )

    # Verify initiator_inforg_id if being updated
    if "initiator_inforg_id" in update_data and update_data["initiator_inforg_id"]:
        initiator = db.query(User).filter(User.id == update_data["initiator_inforg_id"]).first()
        if not initiator:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id {update_data['initiator_inforg_id']} not found"
            )

    for field, value in update_data.items():
        setattr(db_distribution, field, value)

    db.commit()
    db.refresh(db_distribution)

    return db_distribution


@router.delete("/{distribution_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_distribution(
    distribution_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete distribution by ID"""
    db_distribution = db.query(Distribution).filter(Distribution.id == distribution_id).first()

    if not db_distribution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Distribution with id {distribution_id} not found"
        )

    db.delete(db_distribution)
    db.commit()

    return None
