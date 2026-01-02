from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.forum_import import (
    ForumImportStatusResponse,
    ForumImportStartRequest,
    ForumImportSettingsUpdate
)
from app.services.forum_import_service import ForumImportService
from app.models.forum_import import ForumImportStatus
from app.models.settings import Settings

router = APIRouter(prefix="/forum-import", tags=["Forum Import"])


@router.get("/status", response_model=ForumImportStatusResponse)
def get_import_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current forum import status"""
    return ForumImportService.get_status(db)


@router.post("/start", response_model=ForumImportStatusResponse)
def start_import(
    request: ForumImportStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Start forum import process"""
    # Check if already running
    import_status = ForumImportService.get_status(db)
    if import_status.is_running:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Import is already running"
        )

    # Start import in background
    try:
        ForumImportService.start_import(
            forum_url=request.forum_url,
            forum_username=request.forum_username,
            forum_password=request.forum_password,
            subforum_id=request.subforum_id,
            max_topics=request.max_topics,
            api_email=request.api_email,
            api_password=request.api_password
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start import: {str(e)}"
        )

    # Return updated status
    return ForumImportService.get_status(db)


@router.post("/stop", response_model=ForumImportStatusResponse)
def stop_import(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Stop forum import process (sets flag, actual stop depends on implementation)"""
    import_status = ForumImportService.get_status(db)
    if not import_status.is_running:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Import is not running"
        )

    # Update status to stopped
    return ForumImportService.update_status(
        db,
        is_running=False,
        status='stopped'
    )


@router.get("/settings")
def get_import_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get forum import settings"""
    settings = db.query(Settings).filter(Settings.id == 1).first()
    if not settings:
        return {
            "forum_url": None,
            "forum_username": None,
            "forum_password": None,
            "forum_subforum_id": 150
        }

    return {
        "forum_url": settings.forum_url,
        "forum_username": settings.forum_username,
        "forum_password": settings.forum_password,
        "forum_subforum_id": settings.forum_subforum_id
    }


@router.put("/settings")
def update_import_settings(
    settings_update: ForumImportSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update forum import settings"""
    settings = db.query(Settings).filter(Settings.id == 1).first()

    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Settings not found"
        )

    # Update settings
    update_data = settings_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)

    return {
        "forum_url": settings.forum_url,
        "forum_username": settings.forum_username,
        "forum_password": settings.forum_password,
        "forum_subforum_id": settings.forum_subforum_id
    }
