from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, insert, delete
from typing import List, Optional
from app.db import get_db
from app.schemas.field_search import (
    FieldSearchCreate, FieldSearchUpdate, FieldSearchResponse,
    FieldSearchListResponse, AddParticipantsRequest, ParticipantInfo
)
from app.models.field_search import FieldSearch, FieldSearchStatus, field_search_participants
from app.models.case import Case
from app.models.search import Search
from app.models.flyer import Flyer
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/field_searches", tags=["Field Searches"])


@router.post("/", response_model=FieldSearchResponse, status_code=status.HTTP_201_CREATED)
def create_field_search(
    field_search_data: FieldSearchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new field search for a search"""
    # Verify search exists
    search = db.query(Search).filter(Search.id == field_search_data.search_id).first()
    if not search:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Search with id {field_search_data.search_id} not found"
        )

    # Verify users if provided
    if field_search_data.initiator_inforg_id:
        initiator = db.query(User).filter(User.id == field_search_data.initiator_inforg_id).first()
        if not initiator:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id {field_search_data.initiator_inforg_id} not found"
            )

    if field_search_data.coordinator_id:
        coordinator = db.query(User).filter(User.id == field_search_data.coordinator_id).first()
        if not coordinator:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id {field_search_data.coordinator_id} not found"
            )

    # Verify flyer if provided
    if field_search_data.flyer_id:
        flyer = db.query(Flyer).filter(Flyer.id == field_search_data.flyer_id).first()
        if not flyer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Flyer with id {field_search_data.flyer_id} not found"
            )

    # Parse status enum
    fs_status = FieldSearchStatus.planning
    if field_search_data.status:
        try:
            fs_status = FieldSearchStatus[field_search_data.status]
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid field search status: {field_search_data.status}"
            )

    db_field_search = FieldSearch(
        search_id=field_search_data.search_id,
        initiator_inforg_id=field_search_data.initiator_inforg_id,
        start_date=field_search_data.start_date,
        flyer_id=field_search_data.flyer_id,
        meeting_datetime=field_search_data.meeting_datetime,
        meeting_place=field_search_data.meeting_place,
        coordinator_id=field_search_data.coordinator_id,
        status=fs_status,
        end_date=field_search_data.end_date,
        result=field_search_data.result,
        notes=field_search_data.notes
    )

    db.add(db_field_search)
    db.commit()
    db.refresh(db_field_search)

    return db_field_search


@router.get("/", response_model=FieldSearchListResponse)
def list_field_searches(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Max number of records to return"),
    case_id: Optional[int] = Query(None, description="Filter by case ID"),
    status_filter: Optional[str] = Query(None, description="Filter by field search status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of field searches with pagination and filters"""
    query = db.query(FieldSearch).options(
        joinedload(FieldSearch.search).joinedload(Search.case),
        joinedload(FieldSearch.initiator_inforg),
        joinedload(FieldSearch.coordinator)
    )

    # Filter by case_id if provided (need to join through search)
    if case_id:
        query = query.join(FieldSearch.search).filter(Search.case_id == case_id)

    # Filter by status if provided
    if status_filter:
        try:
            status_enum = FieldSearchStatus[status_filter]
            query = query.filter(FieldSearch.status == status_enum)
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}"
            )

    total = query.count()
    field_searches = query.order_by(FieldSearch.created_at.desc()).offset(skip).limit(limit).all()

    return {"total": total, "field_searches": field_searches}


@router.get("/{field_search_id}", response_model=FieldSearchResponse)
def get_field_search(
    field_search_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get field search by ID"""
    db_field_search = db.query(FieldSearch).filter(FieldSearch.id == field_search_id).first()

    if not db_field_search:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field search with id {field_search_id} not found"
        )

    return db_field_search


@router.put("/{field_search_id}", response_model=FieldSearchResponse)
def update_field_search(
    field_search_id: int,
    field_search_data: FieldSearchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update field search by ID"""
    db_field_search = db.query(FieldSearch).filter(FieldSearch.id == field_search_id).first()

    if not db_field_search:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field search with id {field_search_id} not found"
        )

    # Update fields if provided
    update_data = field_search_data.model_dump(exclude_unset=True)

    # Handle status separately to convert string to enum
    if "status" in update_data:
        try:
            update_data["status"] = FieldSearchStatus[update_data["status"]]
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid field search status: {update_data['status']}"
            )

    # Verify users if being updated
    if "initiator_inforg_id" in update_data and update_data["initiator_inforg_id"]:
        initiator = db.query(User).filter(User.id == update_data["initiator_inforg_id"]).first()
        if not initiator:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id {update_data['initiator_inforg_id']} not found"
            )

    if "coordinator_id" in update_data and update_data["coordinator_id"]:
        coordinator = db.query(User).filter(User.id == update_data["coordinator_id"]).first()
        if not coordinator:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id {update_data['coordinator_id']} not found"
            )

    # Verify flyer if being updated
    if "flyer_id" in update_data and update_data["flyer_id"]:
        flyer = db.query(Flyer).filter(Flyer.id == update_data["flyer_id"]).first()
        if not flyer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Flyer with id {update_data['flyer_id']} not found"
            )

    for field, value in update_data.items():
        setattr(db_field_search, field, value)

    db.commit()
    db.refresh(db_field_search)

    return db_field_search


@router.delete("/{field_search_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_field_search(
    field_search_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete field search by ID"""
    db_field_search = db.query(FieldSearch).filter(FieldSearch.id == field_search_id).first()

    if not db_field_search:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field search with id {field_search_id} not found"
        )

    db.delete(db_field_search)
    db.commit()

    return None


@router.post("/{field_search_id}/participants", status_code=status.HTTP_201_CREATED)
def add_participants(
    field_search_id: int,
    participants_data: AddParticipantsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add participants to field search"""
    # Verify field search exists
    db_field_search = db.query(FieldSearch).filter(FieldSearch.id == field_search_id).first()
    if not db_field_search:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field search with id {field_search_id} not found"
        )

    # Verify all users exist
    user_ids = [p.user_id for p in participants_data.participants]
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    if len(users) != len(user_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more user IDs are invalid"
        )

    # Add participants
    for participant in participants_data.participants:
        stmt = insert(field_search_participants).values(
            field_search_id=field_search_id,
            user_id=participant.user_id,
            role_on_field=participant.role_on_field,
            group_name=participant.group_name
        )
        db.execute(stmt)

    db.commit()

    return {"message": f"Added {len(participants_data.participants)} participants"}


@router.get("/{field_search_id}/participants", response_model=List[ParticipantInfo])
def get_participants(
    field_search_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of participants for a field search"""
    # Verify field search exists
    db_field_search = db.query(FieldSearch).filter(FieldSearch.id == field_search_id).first()
    if not db_field_search:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field search with id {field_search_id} not found"
        )

    # Query participants
    stmt = select(field_search_participants).where(
        field_search_participants.c.field_search_id == field_search_id
    )
    result = db.execute(stmt).fetchall()

    participants = []
    for row in result:
        participants.append(ParticipantInfo(
            user_id=row.user_id,
            role_on_field=row.role_on_field,
            group_name=row.group_name
        ))

    return participants


@router.delete("/{field_search_id}/participants/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_participant(
    field_search_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a participant from field search"""
    # Verify field search exists
    db_field_search = db.query(FieldSearch).filter(FieldSearch.id == field_search_id).first()
    if not db_field_search:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field search with id {field_search_id} not found"
        )

    # Delete participant
    stmt = delete(field_search_participants).where(
        field_search_participants.c.field_search_id == field_search_id,
        field_search_participants.c.user_id == user_id
    )
    result = db.execute(stmt)
    db.commit()

    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Participant with user_id {user_id} not found in this field search"
        )

    return None
