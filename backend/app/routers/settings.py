from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.schemas.settings import SettingsResponse, SettingsUpdate
from app.models.settings import Settings
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("/", response_model=SettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get application settings"""
    settings = db.query(Settings).filter(Settings.id == 1).first()

    if not settings:
        # Create default settings if not exist
        settings = Settings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings


@router.put("/", response_model=SettingsResponse)
def update_settings(
    settings_data: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update application settings"""
    settings = db.query(Settings).filter(Settings.id == 1).first()

    if not settings:
        # Create settings if not exist
        settings = Settings(id=1, case_autofill_prompt=settings_data.case_autofill_prompt)
        db.add(settings)
    else:
        # Update existing settings
        settings.case_autofill_prompt = settings_data.case_autofill_prompt

    db.commit()
    db.refresh(settings)

    return settings
