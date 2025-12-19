from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone
from app.db import get_db
from app.schemas.event import (
    EventCreate, EventUpdate, EventResponse, EventListResponse
)
from app.models.event import Event
from app.models.search import Search
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/events", tags=["Events"])


@router.post("/", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    event_data: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new event for a search"""
    # Verify search exists
    search = db.query(Search).filter(Search.id == event_data.search_id).first()
    if not search:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Search with id {event_data.search_id} not found"
        )

    db_event = Event(
        search_id=event_data.search_id,
        created_by_user_id=current_user.id,
        event_datetime=event_data.event_datetime,
        event_type=event_data.event_type,
        description=event_data.description,
        media_files=event_data.media_files or []
    )

    db.add(db_event)
    db.commit()
    db.refresh(db_event)

    return db_event


@router.get("/", response_model=EventListResponse)
def list_events(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Max number of records to return"),
    search_id: Optional[int] = Query(None, description="Filter by search ID"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of events with pagination and filters"""
    query = db.query(Event)

    # Filter by search_id if provided
    if search_id:
        query = query.filter(Event.search_id == search_id)

    # Filter by event_type if provided
    if event_type:
        query = query.filter(Event.event_type == event_type)

    total = query.count()
    events = query.order_by(Event.event_datetime.desc()).offset(skip).limit(limit).all()

    return {"total": total, "events": events}


@router.get("/{event_id}", response_model=EventResponse)
def get_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get event by ID"""
    db_event = db.query(Event).filter(Event.id == event_id).first()

    if not db_event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with id {event_id} not found"
        )

    return db_event


@router.put("/{event_id}", response_model=EventResponse)
def update_event(
    event_id: int,
    event_data: EventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update event by ID"""
    db_event = db.query(Event).filter(Event.id == event_id).first()

    if not db_event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with id {event_id} not found"
        )

    # Update fields if provided
    update_data = event_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(db_event, field, value)

    # Set update metadata
    db_event.updated_at = datetime.now(timezone.utc)
    db_event.updated_by_user_id = current_user.id

    db.commit()
    db.refresh(db_event)

    return db_event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete event by ID"""
    db_event = db.query(Event).filter(Event.id == event_id).first()

    if not db_event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with id {event_id} not found"
        )

    db.delete(db_event)
    db.commit()

    return None
