from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
from app.db import get_db
from app.schemas.flyer_template import (
    FlyerTemplateResponse,
    FlyerTemplateListResponse,
    FlyerTemplateUpdate
)
from app.models.flyer_template import FlyerTemplate, TemplateType
from app.models.user import User
from app.routers.auth import get_current_user, require_admin
import os
import uuid
from pathlib import Path

router = APIRouter(prefix="/flyer-templates", tags=["Flyer Templates"])

# Directory for storing uploaded templates
UPLOAD_DIR = Path("uploads/flyer_templates")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload", response_model=FlyerTemplateResponse, status_code=status.HTTP_201_CREATED)
async def upload_template(
    template_type: str = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Upload a new flyer template (admin only)"""

    # Validate template type
    try:
        template_type_enum = TemplateType[template_type]
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid template type. Must be one of: {', '.join([t.name for t in TemplateType])}"
        )

    # Validate file extension
    allowed_extensions = {".jpg", ".jpeg", ".png", ".pdf", ".svg"}
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )

    # Generate unique filename
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = UPLOAD_DIR / unique_filename

    # Save file
    try:
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )

    # Create web-accessible path
    web_path = f"/uploads/flyer_templates/{unique_filename}"

    # Create database record
    db_template = FlyerTemplate(
        template_type=template_type_enum,
        file_name=file.filename,
        file_path=web_path,
        description=description
    )

    db.add(db_template)
    db.commit()
    db.refresh(db_template)

    return db_template


@router.get("", response_model=FlyerTemplateListResponse)
def list_templates(
    template_type: Optional[str] = None,
    is_active: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of flyer templates"""

    query = db.query(FlyerTemplate)

    if template_type:
        try:
            template_type_enum = TemplateType[template_type]
            query = query.filter(FlyerTemplate.template_type == template_type_enum)
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid template type"
            )

    if is_active is not None:
        query = query.filter(FlyerTemplate.is_active == is_active)

    templates = query.order_by(FlyerTemplate.created_at.desc()).all()

    return FlyerTemplateListResponse(
        total=len(templates),
        templates=templates
    )


@router.get("/{template_id}", response_model=FlyerTemplateResponse)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific flyer template"""

    template = db.query(FlyerTemplate).filter(FlyerTemplate.id == template_id).first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id {template_id} not found"
        )

    return template


@router.patch("/{template_id}", response_model=FlyerTemplateResponse)
def update_template(
    template_id: int,
    template_data: FlyerTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update a flyer template (admin only)"""

    db_template = db.query(FlyerTemplate).filter(FlyerTemplate.id == template_id).first()

    if not db_template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id {template_id} not found"
        )

    update_data = template_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(db_template, field, value)

    db.commit()
    db.refresh(db_template)

    return db_template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete a flyer template (admin only)"""

    db_template = db.query(FlyerTemplate).filter(FlyerTemplate.id == template_id).first()

    if not db_template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id {template_id} not found"
        )

    # Delete physical file
    try:
        # Convert web path to file system path
        # Web path: /uploads/flyer_templates/uuid.jpg
        # File path: uploads/flyer_templates/uuid.jpg
        file_system_path = db_template.file_path.lstrip('/')
        if os.path.exists(file_system_path):
            os.remove(file_system_path)
    except Exception as e:
        # Log error but continue with database deletion
        print(f"Failed to delete file: {str(e)}")

    db.delete(db_template)
    db.commit()

    return None
