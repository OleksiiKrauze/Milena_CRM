from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
from app.db import get_db
from app.schemas.case import (
    CaseCreate, CaseUpdate, CaseResponse, CaseListResponse,
    CaseFullResponse, CaseAutofillRequest, CaseAutofillResponse
)
from app.models.case import Case
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.openai_service import get_openai_service

router = APIRouter(prefix="/cases", tags=["Cases"])


@router.post("/", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
def create_case(
    case_data: CaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new case (заявка на поиск)"""
    db_case = Case(
        created_by_user_id=current_user.id,
        # Applicant - split name fields
        applicant_last_name=case_data.applicant_last_name,
        applicant_first_name=case_data.applicant_first_name,
        applicant_middle_name=case_data.applicant_middle_name,
        applicant_phone=case_data.applicant_phone,
        applicant_relation=case_data.applicant_relation,
        # Missing person - location fields
        missing_settlement=case_data.missing_settlement,
        missing_region=case_data.missing_region,
        missing_address=case_data.missing_address,
        # Missing person - split name fields
        missing_last_name=case_data.missing_last_name,
        missing_first_name=case_data.missing_first_name,
        missing_middle_name=case_data.missing_middle_name,
        missing_gender=case_data.missing_gender,
        missing_birthdate=case_data.missing_birthdate,
        missing_photos=case_data.missing_photos or [],
        missing_last_seen_datetime=case_data.missing_last_seen_datetime,
        missing_last_seen_place=case_data.missing_last_seen_place,
        missing_description=case_data.missing_description,
        missing_special_signs=case_data.missing_special_signs,
        missing_diseases=case_data.missing_diseases,
        missing_phone=case_data.missing_phone,
        missing_clothing=case_data.missing_clothing,
        missing_belongings=case_data.missing_belongings,
        # Additional case information
        additional_search_regions=case_data.additional_search_regions or [],
        police_report_filed=case_data.police_report_filed,
        search_terrain_type=case_data.search_terrain_type,
        disappearance_circumstances=case_data.disappearance_circumstances,
        initial_info=case_data.initial_info,
        additional_info=case_data.additional_info,
        # Case metadata
        decision_type=case_data.decision_type,
        decision_comment=case_data.decision_comment,
        tags=case_data.tags or []
    )

    db.add(db_case)
    db.commit()
    db.refresh(db_case)

    return db_case


@router.get("/", response_model=CaseListResponse)
def list_cases(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Max number of records to return"),
    decision_type_filter: str = Query(None, description="Filter by decision type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of cases with pagination"""
    query = db.query(Case)

    # Filter by decision type if provided
    if decision_type_filter:
        # DecisionType enum values are in Ukrainian, so we filter by the string value
        query = query.filter(Case.decision_type == decision_type_filter)

    total = query.count()
    cases = query.order_by(Case.created_at.desc()).offset(skip).limit(limit).all()

    return {"total": total, "cases": cases}


@router.get("/{case_id}", response_model=CaseResponse)
def get_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get case by ID"""
    db_case = db.query(Case).filter(Case.id == case_id).first()

    if not db_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case with id {case_id} not found"
        )

    return db_case


@router.put("/{case_id}", response_model=CaseResponse)
def update_case(
    case_id: int,
    case_data: CaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update case by ID"""
    db_case = db.query(Case).filter(Case.id == case_id).first()

    if not db_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case with id {case_id} not found"
        )

    # Update fields if provided
    update_data = case_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(db_case, field, value)

    # Track who updated the case
    db_case.updated_by_user_id = current_user.id

    db.commit()
    db.refresh(db_case)

    return db_case


@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete case by ID"""
    db_case = db.query(Case).filter(Case.id == case_id).first()

    if not db_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case with id {case_id} not found"
        )

    db.delete(db_case)
    db.commit()

    return None


@router.get("/{case_id}/full", response_model=CaseFullResponse)
def get_case_full(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get case by ID with all related data (searches, field searches, institutions calls)"""
    db_case = db.query(Case).filter(Case.id == case_id).first()

    if not db_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case with id {case_id} not found"
        )

    return db_case


@router.post("/autofill", response_model=CaseAutofillResponse)
def autofill_case_fields(
    request: CaseAutofillRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Autofill case fields using ChatGPT based on initial_info text.

    This endpoint analyzes the provided initial information and returns
    structured data that can be used to populate case fields.
    """
    try:
        openai_service = get_openai_service()
        extracted_fields = openai_service.parse_case_info(request.initial_info)

        return CaseAutofillResponse(fields=extracted_fields)

    except ValueError as e:
        # API key not configured
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OpenAI service not properly configured: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing autofill request: {str(e)}"
        )
