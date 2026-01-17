"""
Public API endpoints that don't require authentication.
Used for website form integration.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from app.db import get_db
from app.schemas.public_case import (
    PublicCaseCreate,
    PublicCaseResponse,
    TelegramCaseCreate,
    TelegramCaseResponse,
    TelegramPhotosResponse
)
from app.schemas.case import CaseCreate
from app.models.case import Case
from app.models.missing_person import MissingPerson
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
        db.flush()  # Flush to get case ID before creating missing person

        # Create MissingPerson record from legacy fields
        # This ensures compatibility with new missing_persons array structure
        db_missing_person = MissingPerson(
            case_id=db_case.id,
            last_name=validated_data.missing_last_name or "Невідомо",
            first_name=validated_data.missing_first_name or "Невідомо",
            middle_name=validated_data.missing_middle_name,
            gender=validated_data.missing_gender,
            birthdate=validated_data.missing_birthdate,
            phone=validated_data.missing_phone,
            settlement=validated_data.missing_settlement,
            region=validated_data.missing_region,
            address=validated_data.missing_address,
            last_seen_datetime=validated_data.missing_last_seen_datetime,
            last_seen_place=validated_data.missing_last_seen_place,
            photos=validated_data.missing_photos or [],
            videos=[],  # Public form doesn't support videos yet
            description=validated_data.missing_description,
            special_signs=validated_data.missing_special_signs,
            diseases=validated_data.missing_diseases,
            clothing=validated_data.missing_clothing,
            belongings=validated_data.missing_belongings,
            order_index=0
        )
        db.add(db_missing_person)

        db.commit()
        db.refresh(db_case)

        logger.info(f"Public case created successfully: ID={db_case.id}, IP={client_ip}")

        # Send push notification to users with cases:read permission
        try:
            from app.services.push_notification_service import push_service
            from app.core.notification_types import NotificationType

            push_service.send_notification_to_users_with_permission(
                db=db,
                notification_type=NotificationType.NEW_PUBLIC_CASE,
                title="Нова заявка з сайту",
                body=f"Нова заявка: {db_case.missing_full_name}",
                data={
                    "case_id": db_case.id,
                    "missing_name": db_case.missing_full_name
                },
                url=f"/cases/{db_case.id}"
            )
        except Exception as e:
            logger.error(f"Failed to send push notification for new case: {e}")
            # Don't fail the request if notification fails

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


@router.post("/telegram/case", response_model=TelegramCaseResponse, status_code=status.HTTP_201_CREATED)
def create_telegram_case(
    case_data: TelegramCaseCreate,
    request: Request,
    db: Session = Depends(get_db),
    _rate_limit: None = Depends(check_public_rate_limit),
    _api_key: None = Depends(verify_api_key)
):
    """
    Create a new case from Telegram bot.

    This endpoint accepts case submissions from Telegram bot.

    Flow:
    1. Receives text information in initial_info field
    2. Automatically parses with OpenAI autofill (if available)
    3. Creates case with parsed data
    4. Sends push notification to users with cases:read permission

    Rate limiting: 5 requests per 60 seconds per IP address.
    """
    client_ip = get_client_ip(request)

    try:
        logger.info(f"Telegram case submission from IP: {client_ip}")

        # Try to parse with OpenAI autofill
        extracted_fields = {}
        autofill_worked = False

        try:
            from app.services.openai_service import get_openai_service
            openai_service = get_openai_service()
            extracted_fields = openai_service.parse_case_info(db, case_data.initial_info)
            autofill_worked = True
            logger.info(f"OpenAI autofill successful for Telegram case")
        except Exception as e:
            logger.warning(f"OpenAI autofill failed for Telegram case: {e}")
            # Continue without autofill - case will be created with minimal data

        # Prepare case data with fallback values
        case_dict = {
            "basis": "Заявка з Telegram",
            "initial_info": case_data.initial_info,
            "decision_type": "На розгляді",
            "tags": [],
        }

        # If autofill worked, merge extracted fields (filter out None values)
        if autofill_worked and extracted_fields:
            # Filter out None values to avoid validation errors
            filtered_fields = {k: v for k, v in extracted_fields.items() if v is not None}
            case_dict.update(filtered_fields)

        # Ensure required fields have values (fallback if autofill didn't set them)
        if "applicant_last_name" not in case_dict or not case_dict.get("applicant_last_name"):
            case_dict["applicant_last_name"] = "Невідомо"
        if "applicant_first_name" not in case_dict or not case_dict.get("applicant_first_name"):
            case_dict["applicant_first_name"] = "Невідомо"
        if "missing_last_name" not in case_dict or not case_dict.get("missing_last_name"):
            case_dict["missing_last_name"] = "Невідомо"
        if "missing_first_name" not in case_dict or not case_dict.get("missing_first_name"):
            case_dict["missing_first_name"] = "Невідомо"

        # Create CaseCreate instance for validation
        validated_data = CaseCreate(**case_dict)

        # Create case in database (created_by_user_id is None for Telegram submissions)
        db_case = Case(
            created_by_user_id=None,
            # Basis
            basis=validated_data.basis,
            # Applicant
            applicant_last_name=validated_data.applicant_last_name,
            applicant_first_name=validated_data.applicant_first_name,
            applicant_middle_name=validated_data.applicant_middle_name,
            applicant_phone=validated_data.applicant_phone,
            applicant_relation=validated_data.applicant_relation,
            # Missing person - location
            missing_settlement=validated_data.missing_settlement,
            missing_region=validated_data.missing_region,
            missing_address=validated_data.missing_address,
            # Missing person - personal info
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
        db.flush()  # Flush to get case ID before creating missing person

        # Create MissingPerson record from legacy fields
        # This ensures compatibility with new missing_persons array structure
        db_missing_person = MissingPerson(
            case_id=db_case.id,
            last_name=validated_data.missing_last_name or "Невідомо",
            first_name=validated_data.missing_first_name or "Невідомо",
            middle_name=validated_data.missing_middle_name,
            gender=validated_data.missing_gender,
            birthdate=validated_data.missing_birthdate,
            phone=validated_data.missing_phone,
            settlement=validated_data.missing_settlement,
            region=validated_data.missing_region,
            address=validated_data.missing_address,
            last_seen_datetime=validated_data.missing_last_seen_datetime,
            last_seen_place=validated_data.missing_last_seen_place,
            photos=validated_data.missing_photos or [],
            videos=[],  # Telegram doesn't support videos in initial submission
            description=validated_data.missing_description,
            special_signs=validated_data.missing_special_signs,
            diseases=validated_data.missing_diseases,
            clothing=validated_data.missing_clothing,
            belongings=validated_data.missing_belongings,
            order_index=0
        )
        db.add(db_missing_person)

        db.commit()
        db.refresh(db_case)

        logger.info(f"Telegram case created successfully: ID={db_case.id}, IP={client_ip}, Autofill={'yes' if autofill_worked else 'no'}")

        # Send push notification to users with cases:read permission
        try:
            from app.services.push_notification_service import push_service
            from app.core.notification_types import NotificationType

            missing_name = db_case.missing_full_name if autofill_worked else "заявка з Telegram"

            push_service.send_notification_to_users_with_permission(
                db=db,
                notification_type=NotificationType.NEW_TELEGRAM_CASE,
                title="Нова заявка з Telegram",
                body=f"Нова заявка: {missing_name}",
                data={
                    "case_id": db_case.id,
                    "missing_name": missing_name
                },
                url=f"/cases/{db_case.id}"
            )
        except Exception as e:
            logger.error(f"Failed to send push notification for Telegram case: {e}")
            # Don't fail the request if notification fails

        message = "Заявку успішно створено."
        if autofill_worked:
            message += " Дані автоматично розпарсовано."
        else:
            message += " Дані потребують ручного опрацювання."

        return TelegramCaseResponse(
            success=True,
            message=message,
            case_id=db_case.id
        )

    except ValueError as e:
        logger.error(f"Validation error in Telegram case submission: {str(e)}, IP={client_ip}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Помилка валідації даних: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error creating Telegram case: {str(e)}, IP={client_ip}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Виникла помилка при створенні заявки. Спробуйте пізніше."
        )


@router.post("/telegram/case/{case_id}/photos", response_model=TelegramPhotosResponse)
async def add_telegram_case_photos(
    case_id: int,
    request: Request,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _rate_limit: None = Depends(check_public_rate_limit),
    _api_key: None = Depends(verify_api_key)
):
    """
    Add photos to existing Telegram case.

    Accepts image files and adds their URLs to case.missing_photos array.

    Rate limiting: 5 requests per 60 seconds per IP address.
    """
    from pathlib import Path
    import uuid

    client_ip = get_client_ip(request)

    try:
        logger.info(f"Telegram photos upload for case {case_id} from IP: {client_ip}")

        # Check that case exists
        db_case = db.query(Case).filter(Case.id == case_id).first()
        if not db_case:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Заявку з ID {case_id} не знайдено"
            )

        # Validate files
        if not files:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Не надано файлів"
            )

        if len(files) > 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Максимум 10 файлів за раз"
            )

        # Upload directory (same as in upload.py)
        UPLOAD_DIR = Path("/app/uploads")
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

        # Allowed image extensions
        ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
        MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

        uploaded_urls = []

        for file in files:
            # Validate file extension
            file_ext = Path(file.filename).suffix.lower()
            if file_ext not in ALLOWED_IMAGE_EXTENSIONS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Тип файлу {file_ext} не підтримується. Дозволені типи: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
                )

            # Check file size
            content = await file.read()
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Файл {file.filename} занадто великий. Максимальний розмір: 10 MB"
                )

            # Generate unique filename
            original_name = Path(file.filename).stem
            safe_name = "".join(c for c in original_name if c.isalnum() or c in (' ', '-', '_')).strip()
            safe_name = safe_name[:50]  # Limit length
            unique_filename = f"{uuid.uuid4()}_{safe_name}{file_ext}"
            file_path = UPLOAD_DIR / unique_filename

            # Save file
            with open(file_path, "wb") as f:
                f.write(content)

            # Add URL to list
            uploaded_urls.append(f"/uploads/{unique_filename}")

        # Update case with new photo URLs
        current_photos = db_case.missing_photos or []
        updated_photos = current_photos + uploaded_urls
        db_case.missing_photos = updated_photos

        db.commit()
        db.refresh(db_case)

        logger.info(f"Telegram case {case_id} updated with {len(uploaded_urls)} photos, IP={client_ip}")

        return TelegramPhotosResponse(
            success=True,
            message=f"Успішно завантажено {len(uploaded_urls)} фото",
            photos_count=len(uploaded_urls),
            photo_urls=uploaded_urls
        )

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error uploading photos for Telegram case {case_id}: {str(e)}, IP={client_ip}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Виникла помилка при завантаженні фото. Спробуйте пізніше."
        )


@router.get("/health")
def public_health():
    """Health check endpoint for public API"""
    return {"status": "ok", "service": "public-api"}
