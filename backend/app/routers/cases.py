from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.db import get_db
from app.schemas.case import (
    CaseCreate, CaseUpdate, CaseResponse, CaseListResponse,
    CaseFullResponse, CaseAutofillRequest, CaseAutofillResponse
)
from app.models.case import Case
from app.models.missing_person import MissingPerson
from app.models.user import User
from app.routers.auth import get_current_user, require_permission
from app.services.openai_service import get_openai_service

router = APIRouter(prefix="/cases", tags=["Cases"])


@router.post("/", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
def create_case(
    case_data: CaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("cases:create"))
):
    """Create a new case (заявка на поиск)"""
    db_case = Case(
        created_by_user_id=current_user.id,
        # Basis
        basis=case_data.basis,
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
        # Additional case information
        additional_search_regions=case_data.additional_search_regions or [],
        police_report_filed=case_data.police_report_filed,
        search_terrain_type=case_data.search_terrain_type,
        disappearance_circumstances=case_data.disappearance_circumstances,
        initial_info=case_data.initial_info,
        additional_info=case_data.additional_info,
        # Police information
        police_report_date=case_data.police_report_date,
        police_department=case_data.police_department,
        police_contact_user_id=case_data.police_contact_user_id,
        # Notes
        notes_text=case_data.notes_text,
        notes_images=case_data.notes_images or [],
        # Case metadata
        decision_type=case_data.decision_type,
        decision_comment=case_data.decision_comment,
        tags=case_data.tags or []
    )

    # Set custom created_at if provided (for data migration)
    if case_data.created_at:
        db_case.created_at = case_data.created_at

    db.add(db_case)
    db.flush()  # Flush to get case ID before creating missing persons

    # Handle missing persons - NEW approach
    if case_data.missing_persons:
        # Use missing_persons array if provided
        for idx, mp_data in enumerate(case_data.missing_persons):
            db_missing_person = MissingPerson(
                case_id=db_case.id,
                last_name=mp_data.last_name,
                first_name=mp_data.first_name,
                middle_name=mp_data.middle_name,
                gender=mp_data.gender,
                birthdate=mp_data.birthdate,
                phone=mp_data.phone,
                settlement=mp_data.settlement,
                region=mp_data.region,
                address=mp_data.address,
                last_seen_datetime=mp_data.last_seen_datetime,
                last_seen_place=mp_data.last_seen_place,
                photos=mp_data.photos or [],
                videos=mp_data.videos or [],
                description=mp_data.description,
                special_signs=mp_data.special_signs,
                diseases=mp_data.diseases,
                clothing=mp_data.clothing,
                belongings=mp_data.belongings,
                order_index=mp_data.order_index if mp_data.order_index is not None else idx
            )
            db.add(db_missing_person)

        # Populate legacy fields from first missing person for backward compatibility
        first_mp = case_data.missing_persons[0]
        db_case.missing_last_name = first_mp.last_name
        db_case.missing_first_name = first_mp.first_name
        db_case.missing_middle_name = first_mp.middle_name
        db_case.missing_gender = first_mp.gender
        db_case.missing_birthdate = first_mp.birthdate
        db_case.missing_photos = first_mp.photos or []
        db_case.missing_last_seen_datetime = first_mp.last_seen_datetime
        db_case.missing_last_seen_place = first_mp.last_seen_place
        db_case.missing_description = first_mp.description
        db_case.missing_special_signs = first_mp.special_signs
        db_case.missing_diseases = first_mp.diseases
        db_case.missing_phone = first_mp.phone
        db_case.missing_clothing = first_mp.clothing
        db_case.missing_belongings = first_mp.belongings

    elif case_data.missing_first_name and case_data.missing_last_name:
        # LEGACY: Use old single missing person fields if provided
        db_missing_person = MissingPerson(
            case_id=db_case.id,
            last_name=case_data.missing_last_name,
            first_name=case_data.missing_first_name,
            middle_name=case_data.missing_middle_name,
            gender=case_data.missing_gender,
            birthdate=case_data.missing_birthdate,
            phone=case_data.missing_phone,
            settlement=case_data.missing_settlement,
            region=case_data.missing_region,
            address=case_data.missing_address,
            last_seen_datetime=case_data.missing_last_seen_datetime,
            last_seen_place=case_data.missing_last_seen_place,
            photos=case_data.missing_photos or [],
            description=case_data.missing_description,
            special_signs=case_data.missing_special_signs,
            diseases=case_data.missing_diseases,
            clothing=case_data.missing_clothing,
            belongings=case_data.missing_belongings,
            order_index=0
        )
        db.add(db_missing_person)

        # Also populate legacy fields
        db_case.missing_last_name = case_data.missing_last_name
        db_case.missing_first_name = case_data.missing_first_name
        db_case.missing_middle_name = case_data.missing_middle_name
        db_case.missing_gender = case_data.missing_gender
        db_case.missing_birthdate = case_data.missing_birthdate
        db_case.missing_photos = case_data.missing_photos or []
        db_case.missing_last_seen_datetime = case_data.missing_last_seen_datetime
        db_case.missing_last_seen_place = case_data.missing_last_seen_place
        db_case.missing_description = case_data.missing_description
        db_case.missing_special_signs = case_data.missing_special_signs
        db_case.missing_diseases = case_data.missing_diseases
        db_case.missing_phone = case_data.missing_phone
        db_case.missing_clothing = case_data.missing_clothing
        db_case.missing_belongings = case_data.missing_belongings

    db.commit()
    db.refresh(db_case)

    return db_case


@router.get("/", response_model=CaseListResponse)
def list_cases(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Max number of records to return"),
    decision_type_filter: str = Query(None, description="Filter by decision type"),
    search_status_filter: str = Query(None, description="Filter by search status"),
    search_result_filter: str = Query(None, description="Filter by search result"),
    date_from: str = Query(None, description="Filter cases from this date (YYYY-MM-DD)"),
    date_to: str = Query(None, description="Filter cases to this date (YYYY-MM-DD)"),
    period: str = Query(None, description="Quick filter: 10d, 30d, all"),
    search_query: str = Query(None, description="Universal search by name, initial_info, or phone"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("cases:read"))
):
    """Get list of cases with pagination and filters"""
    from datetime import datetime, timedelta
    from sqlalchemy import and_, or_
    from app.models.search import Search

    query = db.query(Case).options(
        joinedload(Case.searches),
        joinedload(Case.missing_persons)
    )

    # Universal search: search by missing person's name, initial_info, applicant phone
    if search_query:
        search_term = f"%{search_query}%"
        # Search in multiple fields: names, initial_info, phone
        query = query.outerjoin(MissingPerson).filter(
            or_(
                # Search in missing person's last name
                Case.missing_last_name.ilike(search_term),
                MissingPerson.last_name.ilike(search_term),
                # Search in missing person's first name
                Case.missing_first_name.ilike(search_term),
                MissingPerson.first_name.ilike(search_term),
                # Search in initial_info (primary information text)
                Case.initial_info.ilike(search_term),
                # Search in applicant's phone
                Case.applicant_phone.ilike(search_term)
            )
        ).distinct()

    # Filter by decision type if provided
    if decision_type_filter:
        query = query.filter(Case.decision_type == decision_type_filter)

    # Filter by search status (from latest search)
    if search_status_filter:
        # Subquery to get case IDs with matching search status
        subquery = db.query(Search.case_id).filter(
            Search.status == search_status_filter
        ).group_by(Search.case_id).subquery()
        query = query.filter(Case.id.in_(subquery))

    # Filter by search result (from latest search)
    if search_result_filter:
        # Subquery to get case IDs with matching search result
        subquery = db.query(Search.case_id).filter(
            Search.result == search_result_filter
        ).group_by(Search.case_id).subquery()
        query = query.filter(Case.id.in_(subquery))

    # Handle period filter (takes precedence over date_from/date_to)
    if period:
        now = datetime.now()
        if period == '10d':
            date_from = (now - timedelta(days=10)).strftime('%Y-%m-%d')
        elif period == '30d':
            date_from = (now - timedelta(days=30)).strftime('%Y-%m-%d')
        # 'all' means no date filter

    # Filter by date range
    if date_from:
        try:
            date_from_dt = datetime.strptime(date_from, '%Y-%m-%d')
            query = query.filter(Case.created_at >= date_from_dt)
        except ValueError:
            pass  # Invalid date format, skip filter

    if date_to:
        try:
            date_to_dt = datetime.strptime(date_to, '%Y-%m-%d')
            # Add one day to include the entire end date
            date_to_dt = date_to_dt + timedelta(days=1)
            query = query.filter(Case.created_at < date_to_dt)
        except ValueError:
            pass  # Invalid date format, skip filter

    total = query.count()
    cases = query.order_by(Case.created_at.desc()).offset(skip).limit(limit).all()

    return {"total": total, "cases": cases}


@router.get("/{case_id}", response_model=CaseResponse)
def get_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("cases:read"))
):
    """Get case by ID"""
    db_case = db.query(Case).options(
        joinedload(Case.missing_persons)
    ).filter(Case.id == case_id).first()

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
    current_user: User = Depends(require_permission("cases:update"))
):
    """Update case by ID"""
    db_case = db.query(Case).options(
        joinedload(Case.missing_persons)
    ).filter(Case.id == case_id).first()

    if not db_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case with id {case_id} not found"
        )

    # Update fields if provided
    update_data = case_data.model_dump(exclude_unset=True)

    # Extract missing_persons if provided (handle separately)
    missing_persons_data = update_data.pop('missing_persons', None)

    # Update regular case fields
    for field, value in update_data.items():
        setattr(db_case, field, value)

    # Handle missing_persons update if provided
    if missing_persons_data is not None:
        # Delete existing missing persons
        db.query(MissingPerson).filter(MissingPerson.case_id == case_id).delete()

        # Create new missing persons from the array
        for idx, mp_data in enumerate(missing_persons_data):
            db_missing_person = MissingPerson(
                case_id=case_id,
                last_name=mp_data['last_name'],
                first_name=mp_data['first_name'],
                middle_name=mp_data.get('middle_name'),
                gender=mp_data.get('gender'),
                birthdate=mp_data.get('birthdate'),
                phone=mp_data.get('phone'),
                settlement=mp_data.get('settlement'),
                region=mp_data.get('region'),
                address=mp_data.get('address'),
                last_seen_datetime=mp_data.get('last_seen_datetime'),
                last_seen_place=mp_data.get('last_seen_place'),
                photos=mp_data.get('photos') or [],
                videos=mp_data.get('videos') or [],
                description=mp_data.get('description'),
                special_signs=mp_data.get('special_signs'),
                diseases=mp_data.get('diseases'),
                clothing=mp_data.get('clothing'),
                belongings=mp_data.get('belongings'),
                order_index=mp_data.get('order_index', idx)
            )
            db.add(db_missing_person)

        # Update legacy fields from first missing person
        if missing_persons_data:
            first_mp = missing_persons_data[0]
            db_case.missing_last_name = first_mp['last_name']
            db_case.missing_first_name = first_mp['first_name']
            db_case.missing_middle_name = first_mp.get('middle_name')
            db_case.missing_gender = first_mp.get('gender')
            db_case.missing_birthdate = first_mp.get('birthdate')
            db_case.missing_photos = first_mp.get('photos') or []
            db_case.missing_last_seen_datetime = first_mp.get('last_seen_datetime')
            db_case.missing_last_seen_place = first_mp.get('last_seen_place')
            db_case.missing_description = first_mp.get('description')
            db_case.missing_special_signs = first_mp.get('special_signs')
            db_case.missing_diseases = first_mp.get('diseases')
            db_case.missing_phone = first_mp.get('phone')
            db_case.missing_clothing = first_mp.get('clothing')
            db_case.missing_belongings = first_mp.get('belongings')

    # Track who updated the case
    db_case.updated_by_user_id = current_user.id

    db.commit()
    db.refresh(db_case)

    return db_case


@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("cases:delete"))
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
    current_user: User = Depends(require_permission("cases:read"))
):
    """Get case by ID with all related data (searches, field searches, institutions calls, missing persons)"""
    db_case = db.query(Case).options(
        joinedload(Case.missing_persons)
    ).filter(Case.id == case_id).first()

    if not db_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case with id {case_id} not found"
        )

    return db_case


@router.post("/autofill", response_model=CaseAutofillResponse)
def autofill_case_fields(
    request: CaseAutofillRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("cases:create"))
):
    """
    Autofill case fields using ChatGPT based on initial_info text.

    This endpoint analyzes the provided initial information and returns
    structured data that can be used to populate case fields.
    """
    try:
        openai_service = get_openai_service()
        extracted_fields = openai_service.parse_case_info(db, request.initial_info)

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
