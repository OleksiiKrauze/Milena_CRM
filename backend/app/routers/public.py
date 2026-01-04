"""
Public API endpoints that don't require authentication.
Used for website form integration.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.db import get_db
from app.schemas.public_case import PublicCaseCreate, PublicCaseResponse
from app.schemas.case import CaseCreate
from app.models.case import Case
from app.middleware.rate_limit import check_public_rate_limit, get_client_ip
from app.core.logging_config import get_logger
import os

logger = get_logger(__name__)

router = APIRouter(prefix="/public", tags=["Public"])

# Optional: Simple API key for additional security
# Set PUBLIC_API_KEY in .env to enable API key validation
PUBLIC_API_KEY = os.getenv("PUBLIC_API_KEY")


def verify_api_key(request: Request):
    """Optional API key verification for public endpoints"""
    if not PUBLIC_API_KEY:
        # API key not configured, skip validation
        return

    api_key = request.headers.get("X-API-Key")
    if not api_key or api_key != PUBLIC_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key"
        )


@router.post("/cases", response_model=PublicCaseResponse, status_code=status.HTTP_201_CREATED)
def create_public_case(
    case_data: PublicCaseCreate,
    request: Request,
    db: Session = Depends(get_db),
    _rate_limit: None = Depends(check_public_rate_limit),
    _api_key: None = Depends(verify_api_key)
):
    """
    Create a new case from public website form.

    This endpoint accepts case submissions from the website at milena.in.ua
    without requiring authentication.

    Rate limiting: 5 requests per 60 seconds per IP address.
    """
    client_ip = get_client_ip(request)

    try:
        logger.info(f"Public case submission from IP: {client_ip}")

        # Convert public case data to internal format
        internal_case_data = case_data.to_case_create()

        # Create CaseCreate instance for validation
        validated_data = CaseCreate(**internal_case_data)

        # Create case in database without created_by_user_id (public submission)
        db_case = Case(
            created_by_user_id=None,  # No user for public submissions
            # Basis
            basis=validated_data.basis,
            # Applicant - split name fields
            applicant_last_name=validated_data.applicant_last_name,
            applicant_first_name=validated_data.applicant_first_name,
            applicant_middle_name=validated_data.applicant_middle_name,
            applicant_phone=validated_data.applicant_phone,
            applicant_relation=validated_data.applicant_relation,
            # Missing person - location fields
            missing_settlement=validated_data.missing_settlement,
            missing_region=validated_data.missing_region,
            missing_address=validated_data.missing_address,
            # Missing person - split name fields
            missing_last_name=validated_data.missing_last_name,
            missing_first_name=validated_data.missing_first_name,
            missing_middle_name=validated_data.missing_middle_name,
            missing_gender=validated_data.missing_gender,
            missing_birthdate=validated_data.missing_birthdate,
            missing_photos=validated_data.missing_photos or [],
            missing_last_seen_datetime=validated_data.missing_last_seen_datetime,
            missing_last_seen_place=validated_data.missing_last_seen_place,
            missing_description=validated_data.missing_description,
            missing_special_signs=validated_data.missing_special_signs,
            missing_diseases=validated_data.missing_diseases,
            missing_phone=validated_data.missing_phone,
            missing_clothing=validated_data.missing_clothing,
            missing_belongings=validated_data.missing_belongings,
            # Additional case information
            additional_search_regions=validated_data.additional_search_regions or [],
            police_report_filed=validated_data.police_report_filed,
            search_terrain_type=validated_data.search_terrain_type,
            disappearance_circumstances=validated_data.disappearance_circumstances,
            initial_info=validated_data.initial_info,
            additional_info=validated_data.additional_info,
            # Case metadata
            decision_type=validated_data.decision_type,
            decision_comment=validated_data.decision_comment,
            tags=validated_data.tags or []
        )

        db.add(db_case)
        db.commit()
        db.refresh(db_case)

        logger.info(f"Public case created successfully: ID={db_case.id}, IP={client_ip}")

        return PublicCaseResponse(
            success=True,
            message="Заявку успішно створено. Наша команда зв'яжеться з вами найближчим часом.",
            case_id=db_case.id
        )

    except ValueError as e:
        logger.error(f"Validation error in public case submission: {str(e)}, IP={client_ip}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Помилка валідації даних: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error creating public case: {str(e)}, IP={client_ip}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Виникла помилка при створенні заявки. Спробуйте пізніше."
        )


@router.get("/health")
def public_health():
    """Health check endpoint for public API"""
    return {"status": "ok", "service": "public-api"}
