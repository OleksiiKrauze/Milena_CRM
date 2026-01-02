from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import logging
from app.db import get_db
from app.schemas.search import SearchCreate, SearchUpdate, SearchResponse, SearchListResponse, SearchFullResponse
from app.models.search import Search, SearchStatus
from app.models.case import Case
from app.models.user import User
from app.models.event import Event
from app.routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/searches", tags=["Searches"])


@router.post("/", response_model=SearchResponse, status_code=status.HTTP_201_CREATED)
def create_search(
    search_data: SearchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new search for a case"""
    # Verify case exists
    case = db.query(Case).filter(Case.id == search_data.case_id).first()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case with id {search_data.case_id} not found"
        )

    # Verify initiator_inforg_id if provided
    if search_data.initiator_inforg_id:
        initiator = db.query(User).filter(User.id == search_data.initiator_inforg_id).first()
        if not initiator:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id {search_data.initiator_inforg_id} not found"
            )

    # Parse status enum
    search_status = SearchStatus.planned
    if search_data.status:
        try:
            search_status = SearchStatus[search_data.status]
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid search status: {search_data.status}"
            )

    db_search = Search(
        case_id=search_data.case_id,
        initiator_inforg_id=search_data.initiator_inforg_id,
        start_date=search_data.start_date,
        end_date=search_data.end_date,
        result=search_data.result,
        status=search_status,
        notes=search_data.notes
    )

    # Set custom created_at if provided (for data migration)
    if search_data.created_at:
        db_search.created_at = search_data.created_at

    db.add(db_search)
    db.flush()  # Get search ID

    # Update case decision_type to "Пошук" when creating a search
    logger.info(f"Case {case.id} current decision_type: '{case.decision_type}'")
    if case.decision_type != "Пошук":
        logger.info(f"Updating case {case.id} decision_type to 'Пошук'")
        updated_rows = db.query(Case).filter(Case.id == search_data.case_id).update(
            {"decision_type": "Пошук", "updated_by_user_id": current_user.id},
            synchronize_session="fetch"
        )
        logger.info(f"Updated {updated_rows} rows for case {case.id}")
        db.flush()
    else:
        logger.info(f"Case {case.id} already has decision_type='Пошук', skipping update")

    db.commit()
    db.refresh(db_search)

    return db_search


@router.get("/", response_model=SearchListResponse)
def list_searches(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Max number of records to return"),
    case_id: Optional[int] = Query(None, description="Filter by case ID"),
    status_filter: Optional[str] = Query(None, description="Filter by search status"),
    result_filter: Optional[str] = Query(None, description="Filter by search result"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of searches with pagination and filters"""
    query = db.query(Search).options(
        joinedload(Search.case),
        joinedload(Search.initiator_inforg)
    )

    # Filter by case_id if provided
    if case_id:
        query = query.filter(Search.case_id == case_id)

    # Filter by status if provided
    if status_filter:
        try:
            status_enum = SearchStatus[status_filter]
            query = query.filter(Search.status == status_enum)
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}"
            )

    # Filter by result if provided
    if result_filter:
        query = query.filter(Search.result == result_filter)

    total = query.count()
    searches = query.order_by(Search.created_at.desc()).offset(skip).limit(limit).all()

    return {"total": total, "searches": searches}


@router.get("/{search_id}", response_model=SearchResponse)
def get_search(
    search_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get search by ID with latest orientation image"""
    from app.models.orientation import Orientation

    db_search = db.query(Search).options(
        joinedload(Search.case),
        joinedload(Search.initiator_inforg)
    ).filter(Search.id == search_id).first()

    if not db_search:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Search with id {search_id} not found"
        )

    # Get latest orientation image if available
    latest_orientation = db.query(Orientation).filter(
        Orientation.search_id == search_id,
        Orientation.is_approved == True
    ).order_by(Orientation.updated_at.desc()).first()

    if latest_orientation and latest_orientation.exported_files:
        db_search.latest_orientation_image = latest_orientation.exported_files[0]
    else:
        db_search.latest_orientation_image = None

    return db_search


@router.put("/{search_id}", response_model=SearchResponse)
def update_search(
    search_id: int,
    search_data: SearchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update search by ID"""
    db_search = db.query(Search).filter(Search.id == search_id).first()

    if not db_search:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Search with id {search_id} not found"
        )

    # Update fields if provided
    update_data = search_data.model_dump(exclude_unset=True)

    # Handle status separately to convert string to enum
    if "status" in update_data:
        try:
            update_data["status"] = SearchStatus[update_data["status"]]
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid search status: {update_data['status']}"
            )

    # Verify initiator_inforg_id if being updated
    if "initiator_inforg_id" in update_data and update_data["initiator_inforg_id"]:
        initiator = db.query(User).filter(User.id == update_data["initiator_inforg_id"]).first()
        if not initiator:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id {update_data['initiator_inforg_id']} not found"
            )

    # Auto-set status to completed when result is alive, dead, or location_known
    if "result" in update_data and update_data["result"] in ["alive", "dead", "location_known"]:
        logger.info(f"Search {search_id} result set to '{update_data['result']}', auto-setting status to 'completed'")
        update_data["status"] = SearchStatus.completed

    for field, value in update_data.items():
        setattr(db_search, field, value)

    db.commit()
    db.refresh(db_search)

    return db_search


@router.delete("/{search_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_search(
    search_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete search by ID"""
    db_search = db.query(Search).filter(Search.id == search_id).first()

    if not db_search:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Search with id {search_id} not found"
        )

    db.delete(db_search)
    db.commit()

    return None


@router.get("/{search_id}/full", response_model=SearchFullResponse)
def get_search_full(
    search_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get search by ID with all related data (flyers, orientations, distributions, map grids, events)"""
    db_search = db.query(Search).options(
        joinedload(Search.case),
        joinedload(Search.initiator_inforg),
        joinedload(Search.orientations),
        joinedload(Search.events).joinedload(Event.created_by),
        joinedload(Search.events).joinedload(Event.updated_by)
    ).filter(Search.id == search_id).first()

    if not db_search:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Search with id {search_id} not found"
        )

    return db_search
