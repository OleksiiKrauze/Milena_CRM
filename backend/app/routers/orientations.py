from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from app.db import get_db
from app.schemas.orientation import (
    OrientationCreate,
    OrientationUpdate,
    OrientationResponse,
    OrientationListResponse,
    GenerateOrientationTextRequest,
    GenerateOrientationTextResponse
)
from app.models.orientation import Orientation
from app.models.search import Search
from app.models.case import Case
from app.models.flyer_template import FlyerTemplate, TemplateType
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.openai_service import get_openai_service

router = APIRouter(prefix="/orientations", tags=["Orientations"])


@router.post("/", response_model=OrientationResponse, status_code=status.HTTP_201_CREATED)
def create_orientation(
    orientation_data: OrientationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new orientation for a search"""

    # Verify search exists
    search = db.query(Search).filter(Search.id == orientation_data.search_id).first()
    if not search:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Search with id {orientation_data.search_id} not found"
        )

    # Create orientation
    db_orientation = Orientation(
        search_id=orientation_data.search_id,
        template_id=orientation_data.template_id,
        selected_photos=orientation_data.selected_photos,
        canvas_data=orientation_data.canvas_data,
        text_content=orientation_data.text_content,
        is_approved=orientation_data.is_approved,
        exported_files=orientation_data.exported_files,
        uploaded_images=orientation_data.uploaded_images
    )

    db.add(db_orientation)
    db.commit()
    db.refresh(db_orientation)

    return db_orientation


@router.get("/", response_model=OrientationListResponse)
def list_orientations(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Max number of records to return"),
    search_id: Optional[int] = Query(None, description="Filter by search ID"),
    is_approved: Optional[bool] = Query(None, description="Filter by approval status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of orientations with pagination and filters"""

    query = db.query(Orientation).options(
        joinedload(Orientation.search),
        joinedload(Orientation.template)
    )

    # Apply filters
    if search_id is not None:
        query = query.filter(Orientation.search_id == search_id)

    if is_approved is not None:
        query = query.filter(Orientation.is_approved == is_approved)

    # Get total count before pagination
    total = query.count()

    # Apply pagination
    orientations = query.order_by(Orientation.created_at.desc()).offset(skip).limit(limit).all()

    return OrientationListResponse(
        total=total,
        orientations=orientations
    )


@router.get("/{orientation_id}", response_model=OrientationResponse)
def get_orientation(
    orientation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific orientation by ID"""

    orientation = db.query(Orientation).options(
        joinedload(Orientation.search),
        joinedload(Orientation.template)
    ).filter(Orientation.id == orientation_id).first()

    if not orientation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Orientation with id {orientation_id} not found"
        )

    return orientation


@router.patch("/{orientation_id}", response_model=OrientationResponse)
def update_orientation(
    orientation_id: int,
    orientation_data: OrientationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an orientation"""

    db_orientation = db.query(Orientation).filter(Orientation.id == orientation_id).first()

    if not db_orientation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Orientation with id {orientation_id} not found"
        )

    # Update fields
    update_data = orientation_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(db_orientation, field, value)

    db.commit()
    db.refresh(db_orientation)

    return db_orientation


@router.delete("/{orientation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_orientation(
    orientation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an orientation"""

    db_orientation = db.query(Orientation).filter(Orientation.id == orientation_id).first()

    if not db_orientation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Orientation with id {orientation_id} not found"
        )

    db.delete(db_orientation)
    db.commit()

    return None


@router.post("/generate-text", response_model=GenerateOrientationTextResponse)
def generate_orientation_text(
    request_data: GenerateOrientationTextRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate orientation text using ChatGPT based on case data and template prompt"""

    # Get case data
    case = db.query(Case).filter(Case.id == request_data.case_id).first()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case with id {request_data.case_id} not found"
        )

    # Get template and its GPT prompt
    if request_data.template_id:
        template = db.query(FlyerTemplate).filter(
            FlyerTemplate.id == request_data.template_id,
            FlyerTemplate.is_active == 1
        ).first()
    else:
        # Get first active main template
        template = db.query(FlyerTemplate).filter(
            FlyerTemplate.template_type == TemplateType.main,
            FlyerTemplate.is_active == 1
        ).first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active template found"
        )

    if not template.gpt_prompt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Template does not have a GPT prompt configured"
        )

    # Get initial_info from case
    initial_info = case.initial_info or ""

    if not initial_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Case does not have initial_info (первинна інформація) filled in"
        )

    # Generate text using OpenAI
    openai_service = get_openai_service()
    try:
        result = openai_service.generate_orientation_text(initial_info, template.gpt_prompt)
        return GenerateOrientationTextResponse(**result)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating text: {str(e)}"
        )
