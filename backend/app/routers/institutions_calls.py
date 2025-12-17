from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db import get_db
from app.schemas.institutions_call import (
    InstitutionsCallCreate, InstitutionsCallUpdate,
    InstitutionsCallResponse, InstitutionsCallListResponse
)
from app.models.institutions_call import InstitutionsCall
from app.models.case import Case
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/institutions_calls", tags=["Institutions Calls"])


@router.post("/", response_model=InstitutionsCallResponse, status_code=status.HTTP_201_CREATED)
def create_institutions_call(
    call_data: InstitutionsCallCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new institutions call record"""
    # Verify case exists
    case = db.query(Case).filter(Case.id == call_data.case_id).first()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case with id {call_data.case_id} not found"
        )

    # Verify user if provided
    if call_data.user_id:
        user = db.query(User).filter(User.id == call_data.user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id {call_data.user_id} not found"
            )

    db_call = InstitutionsCall(
        case_id=call_data.case_id,
        user_id=call_data.user_id,
        organization_name=call_data.organization_name,
        organization_type=call_data.organization_type,
        phone=call_data.phone,
        result=call_data.result,
        notes=call_data.notes
    )

    db.add(db_call)
    db.commit()
    db.refresh(db_call)

    return db_call


@router.get("/", response_model=InstitutionsCallListResponse)
def list_institutions_calls(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Max number of records to return"),
    case_id: Optional[int] = Query(None, description="Filter by case ID"),
    organization_type: Optional[str] = Query(None, description="Filter by organization type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of institutions calls with pagination and filters"""
    query = db.query(InstitutionsCall)

    # Filter by case_id if provided
    if case_id:
        query = query.filter(InstitutionsCall.case_id == case_id)

    # Filter by organization_type if provided
    if organization_type:
        query = query.filter(InstitutionsCall.organization_type == organization_type)

    total = query.count()
    institutions_calls = query.order_by(InstitutionsCall.created_at.desc()).offset(skip).limit(limit).all()

    return {"total": total, "institutions_calls": institutions_calls}


@router.get("/{call_id}", response_model=InstitutionsCallResponse)
def get_institutions_call(
    call_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get institutions call by ID"""
    db_call = db.query(InstitutionsCall).filter(InstitutionsCall.id == call_id).first()

    if not db_call:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Institutions call with id {call_id} not found"
        )

    return db_call


@router.put("/{call_id}", response_model=InstitutionsCallResponse)
def update_institutions_call(
    call_id: int,
    call_data: InstitutionsCallUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update institutions call by ID"""
    db_call = db.query(InstitutionsCall).filter(InstitutionsCall.id == call_id).first()

    if not db_call:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Institutions call with id {call_id} not found"
        )

    # Update fields if provided
    update_data = call_data.model_dump(exclude_unset=True)

    # Verify user if being updated
    if "user_id" in update_data and update_data["user_id"]:
        user = db.query(User).filter(User.id == update_data["user_id"]).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id {update_data['user_id']} not found"
            )

    for field, value in update_data.items():
        setattr(db_call, field, value)

    db.commit()
    db.refresh(db_call)

    return db_call


@router.delete("/{call_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_institutions_call(
    call_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete institutions call by ID"""
    db_call = db.query(InstitutionsCall).filter(InstitutionsCall.id == call_id).first()

    if not db_call:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Institutions call with id {call_id} not found"
        )

    db.delete(db_call)
    db.commit()

    return None
