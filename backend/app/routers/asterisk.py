from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
import pymysql
import paramiko
import io
import os
import re
from openai import OpenAI

from app.db import get_db
from app.models.settings import Settings
from app.models.user import User
from app.models.call_recording_link import CallRecordingLink
from app.models.case import Case
from app.routers.auth import require_permission

router = APIRouter(prefix="/asterisk", tags=["IP ATC"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class CallRecording(BaseModel):
    uniqueid: str
    calldate: str          # ISO string
    src: str
    dst: str
    duration: int          # total seconds
    billsec: int           # answered seconds
    disposition: str
    recordingfile: str


class CallRecordingsResponse(BaseModel):
    total: int
    items: List[CallRecording]


class LinkRecordingRequest(BaseModel):
    uniqueid: str
    case_id: int
    # CDR data to cache
    calldate: Optional[str] = None
    src: Optional[str] = None
    dst: Optional[str] = None
    duration: Optional[int] = None
    billsec: Optional[int] = None
    disposition: Optional[str] = None
    recordingfile: Optional[str] = None


class RecordingLinkResponse(BaseModel):
    id: int
    uniqueid: str
    case_id: int
    calldate: Optional[str]
    src: Optional[str]
    dst: Optional[str]
    duration: Optional[int]
    billsec: Optional[int]
    disposition: Optional[str]
    recordingfile: Optional[str]
    linked_at: Optional[datetime]

    class Config:
        from_attributes = True


class CaseRecordingsResponse(BaseModel):
    items: List[RecordingLinkResponse]


class AsteriskSettingsResponse(BaseModel):
    asterisk_cdr_host: Optional[str]
    asterisk_cdr_port: Optional[int]
    asterisk_cdr_db: Optional[str]
    asterisk_cdr_user: Optional[str]
    asterisk_cdr_password: Optional[str]
    asterisk_ssh_host: Optional[str]
    asterisk_ssh_port: Optional[int]
    asterisk_ssh_user: Optional[str]
    asterisk_ssh_password: Optional[str]
    asterisk_ssh_key: Optional[str]
    asterisk_recordings_path: Optional[str]
    voice_bot_prompt: Optional[str]

    class Config:
        from_attributes = True


class AsteriskSettingsUpdate(BaseModel):
    asterisk_cdr_host: Optional[str] = None
    asterisk_cdr_port: Optional[int] = 3306
    asterisk_cdr_db: Optional[str] = "asteriskcdrdb"
    asterisk_cdr_user: Optional[str] = None
    asterisk_cdr_password: Optional[str] = None
    asterisk_ssh_host: Optional[str] = None
    asterisk_ssh_port: Optional[int] = 22
    asterisk_ssh_user: Optional[str] = None
    asterisk_ssh_password: Optional[str] = None
    asterisk_ssh_key: Optional[str] = None
    asterisk_recordings_path: Optional[str] = "/var/spool/asterisk/monitor"
    voice_bot_prompt: Optional[str] = None


# ── Helper ─────────────────────────────────────────────────────────────────────

def _get_or_create_settings(db: Session) -> Settings:
    settings = db.query(Settings).filter(Settings.id == 1).first()
    if not settings:
        settings = Settings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _get_cdr_connection(settings: Settings):
    """Open a short-lived MySQL connection to Asterisk CDR database."""
    if not settings.asterisk_cdr_host:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Налаштування IP АТС не задані. Перейдіть до Налаштування → IP АТС."
        )
    try:
        conn = pymysql.connect(
            host=settings.asterisk_cdr_host,
            port=settings.asterisk_cdr_port or 3306,
            user=settings.asterisk_cdr_user or "",
            password=settings.asterisk_cdr_password or "",
            database=settings.asterisk_cdr_db or "asteriskcdrdb",
            connect_timeout=10,
            cursorclass=pymysql.cursors.DictCursor,
        )
        return conn
    except pymysql.Error as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Не вдалося підключитися до БД Asterisk: {e}"
        )


# ── Asterisk settings endpoints ────────────────────────────────────────────────

DEFAULT_VOICE_BOT_PROMPT = """Ти — голосовий асистент гарячої лінії пошуку зниклих осіб організації «Мілена».
Твоє завдання — зібрати інформацію про зниклу людину, задаючи питання по одному зі списку нижче.

Правила:
- Говори чітко, спокійно, виключно українською мовою.
- Задавай ОДНЕ питання за раз і чекай відповіді.
- Після кожної відповіді коротко підтверджуй почуте (1-2 слова: "Зрозуміло", "Дякую" тощо).
- Якщо відповідь незрозуміла — перепитай одного разу.
- Коли всі питання задані — подякуй і скажи: "Дякую, ваша заявка зареєстрована. З вами зв'яжуться найближчим часом."

Список питань (задавай саме в такому порядку):
1. Як вас звати? Назвіть, будь ласка, прізвище, ім'я та по батькові.
2. Вкажіть ваш номер телефону для зворотного зв'язку.
3. Ким вам доводиться зникла людина? (родич, друг, сусід тощо)
4. Як звати зниклого? Прізвище, ім'я та по батькові повністю.
5. Скільки років зниклому? Якщо знаєте — назвіть дату народження.
6. Де і коли востаннє бачили зниклого? Вкажіть дату, час та місце.
7. Опишіть зовнішність зниклого: зріст, статура, колір та довжина волосся.
8. В якому одязі був зниклий у момент зникнення?
9. Чи є особливі прикмети — шрами, татуювання, родимки, особливості ходи?
10. Чи є у зниклого хронічні захворювання, проблеми з пам'яттю або орієнтацією?
11. Чи є у зниклого мобільний телефон? Якщо так — номер?
12. Чи подана заява до поліції? Якщо так — назвіть номер справи або відділок.

Розпочни з привітання: "Доброго дня! Ви зателефонували на гарячу лінію пошуку зниклих осіб організації «Мілена». Я допоможу вам оформити заявку. Дозвольте поставити кілька запитань."
"""


@router.get("/bot-prompt")
def get_bot_prompt(db: Session = Depends(get_db)):
    """Public endpoint for voice bot to fetch its system prompt (no auth required)."""
    settings = _get_or_create_settings(db)
    return {"prompt": settings.voice_bot_prompt or DEFAULT_VOICE_BOT_PROMPT}


@router.get("/settings", response_model=AsteriskSettingsResponse)
def get_asterisk_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("settings:read"))
):
    """Get Asterisk/FreePBX connection settings"""
    return _get_or_create_settings(db)


@router.put("/settings", response_model=AsteriskSettingsResponse)
def update_asterisk_settings(
    data: AsteriskSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("settings:update"))
):
    """Update Asterisk/FreePBX connection settings"""
    settings = _get_or_create_settings(db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    return settings


# ── Call recordings list ───────────────────────────────────────────────────────

@router.get("/recordings", response_model=CallRecordingsResponse)
def list_recordings(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    sort_by: str = Query("calldate", description="Field to sort by: calldate, src, dst, duration, billsec"),
    sort_dir: str = Query("desc", description="Sort direction: asc or desc"),
    search: Optional[str] = Query(None, description="Search by caller or destination number"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ip_atc:read"))
):
    """List calls that have recordings from Asterisk CDR database"""
    settings = _get_or_create_settings(db)
    conn = _get_cdr_connection(settings)

    # Validate sort params to prevent SQL injection
    allowed_sort = {"calldate", "src", "dst", "duration", "billsec", "disposition"}
    if sort_by not in allowed_sort:
        sort_by = "calldate"
    sort_dir = "ASC" if sort_dir.lower() == "asc" else "DESC"

    try:
        with conn.cursor() as cursor:
            # Base WHERE: only records with non-empty recordingfile
            where = "WHERE (recordingfile IS NOT NULL AND recordingfile != '')"
            params: list = []

            if search:
                where += " AND (src LIKE %s OR dst LIKE %s)"
                term = f"%{search}%"
                params.extend([term, term])

            # Count
            cursor.execute(f"SELECT COUNT(*) AS cnt FROM cdr {where}", params)
            total = cursor.fetchone()["cnt"]

            # Data
            cursor.execute(
                f"""
                SELECT uniqueid, calldate, src, dst, duration, billsec, disposition, recordingfile
                FROM cdr
                {where}
                ORDER BY {sort_by} {sort_dir}
                LIMIT %s OFFSET %s
                """,
                params + [limit, skip],
            )
            rows = cursor.fetchall()
    finally:
        conn.close()

    items = [
        CallRecording(
            uniqueid=str(row["uniqueid"]),
            calldate=str(row["calldate"]),
            src=row["src"] or "",
            dst=row["dst"] or "",
            duration=int(row["duration"] or 0),
            billsec=int(row["billsec"] or 0),
            disposition=row["disposition"] or "",
            recordingfile=row["recordingfile"] or "",
        )
        for row in rows
    ]

    return {"total": total, "items": items}


# ── Download recording ─────────────────────────────────────────────────────────

@router.get("/recordings/download")
def download_recording(
    filename: str = Query(..., description="Recording filename from CDR (may include subdirectory)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ip_atc:read"))
):
    """
    Stream a recording file from the Asterisk server via SFTP.
    `filename` is the value stored in the CDR `recordingfile` field.
    It may be a bare filename like `20240101-120000-12345.wav` or a relative/full path.
    The full path is constructed as: asterisk_recordings_path + '/' + basename(filename)
    unless filename already starts with '/'.
    """
    settings = _get_or_create_settings(db)

    if not settings.asterisk_ssh_host:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SSH-доступ до сервера Asterisk не налаштований."
        )

    # Connect via SSH+SFTP
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        pkey = None
        if settings.asterisk_ssh_key:
            key_file = io.StringIO(settings.asterisk_ssh_key.strip())
            for key_class in (
                paramiko.RSAKey,
                paramiko.Ed25519Key,
                paramiko.ECDSAKey,
                paramiko.DSSKey,
            ):
                try:
                    pkey = key_class.from_private_key(key_file)
                    break
                except Exception:
                    key_file.seek(0)

        ssh.connect(
            hostname=settings.asterisk_ssh_host,
            port=settings.asterisk_ssh_port or 22,
            username=settings.asterisk_ssh_user or "root",
            password=settings.asterisk_ssh_password or None,
            pkey=pkey,
            timeout=15,
            look_for_keys=False,
            allow_agent=False,
        )
        sftp = ssh.open_sftp()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Не вдалося підключитися до сервера Asterisk по SSH: {e}"
        )

    # Determine remote path — always search via find to handle subdirectories
    base_dir = (settings.asterisk_recordings_path or "/var/spool/asterisk/monitor").rstrip("/")
    basename = os.path.basename(filename)

    if filename.startswith("/"):
        remote_path = filename
    else:
        try:
            _, stdout, stderr = ssh.exec_command(
                f"find {base_dir} -name '{basename}' -type f 2>/dev/null | head -1"
            )
            stdout.channel.settimeout(15)
            found = stdout.read().decode().strip()
            if found:
                remote_path = found
            else:
                sftp.close()
                ssh.close()
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Файл запису не знайдено: {basename}"
                )
        except HTTPException:
            raise
        except Exception as e:
            sftp.close()
            ssh.close()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Помилка пошуку файлу: {e}"
            )

    try:
        file_obj = sftp.open(remote_path, "rb")
        data = file_obj.read()
        file_obj.close()
    except FileNotFoundError:
        sftp.close()
        ssh.close()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Файл запису не знайдено: {remote_path}"
        )
    except Exception as e:
        sftp.close()
        ssh.close()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Помилка читання файлу: {e}"
        )
    finally:
        try:
            sftp.close()
            ssh.close()
        except Exception:
            pass

    ext = os.path.splitext(basename)[1].lower()
    content_type = "audio/wav" if ext == ".wav" else "audio/mpeg" if ext == ".mp3" else "application/octet-stream"

    return StreamingResponse(
        io.BytesIO(data),
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{basename}"'},
    )


# ── Recording ↔ Case links ─────────────────────────────────────────────────────

@router.post("/recordings/link", response_model=RecordingLinkResponse, status_code=status.HTTP_201_CREATED)
def link_recording_to_case(
    data: LinkRecordingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ip_atc:read")),
):
    """Link a call recording to a case (idempotent — same uniqueid+case_id won't duplicate)."""
    # Verify case exists
    case = db.query(Case).filter(Case.id == data.case_id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заявку не знайдено")

    # Check duplicate
    existing = (
        db.query(CallRecordingLink)
        .filter(CallRecordingLink.uniqueid == data.uniqueid, CallRecordingLink.case_id == data.case_id)
        .first()
    )
    if existing:
        return existing

    link = CallRecordingLink(
        uniqueid=data.uniqueid,
        case_id=data.case_id,
        calldate=data.calldate,
        src=data.src,
        dst=data.dst,
        duration=data.duration,
        billsec=data.billsec,
        disposition=data.disposition,
        recordingfile=data.recordingfile,
        linked_by_user_id=current_user.id,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.delete("/recordings/link/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def unlink_recording(
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ip_atc:read")),
):
    """Remove a recording↔case link."""
    link = db.query(CallRecordingLink).filter(CallRecordingLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Зв'язок не знайдено")
    db.delete(link)
    db.commit()


@router.get("/recordings/by-case/{case_id}", response_model=CaseRecordingsResponse)
def get_recordings_by_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ip_atc:read")),
):
    """Get all recordings linked to a specific case."""
    links = (
        db.query(CallRecordingLink)
        .filter(CallRecordingLink.case_id == case_id)
        .order_by(CallRecordingLink.linked_at.desc())
        .all()
    )
    return {"items": links}


@router.post("/recordings/transcribe")
def transcribe_recording(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ip_atc:read")),
):
    """Transcribe a call recording via OpenAI Whisper STT."""
    filename = data.get("filename")
    if not filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="filename is required")

    settings = _get_or_create_settings(db)

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPENAI_API_KEY не налаштований"
        )

    if not settings.asterisk_ssh_host:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SSH-доступ до сервера Asterisk не налаштований."
        )

    # Download file via SFTP (same logic as download_recording)
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        pkey = None
        if settings.asterisk_ssh_key:
            key_file = io.StringIO(settings.asterisk_ssh_key.strip())
            for key_class in (paramiko.RSAKey, paramiko.Ed25519Key, paramiko.ECDSAKey, paramiko.DSSKey):
                try:
                    pkey = key_class.from_private_key(key_file)
                    break
                except Exception:
                    key_file.seek(0)

        ssh.connect(
            hostname=settings.asterisk_ssh_host,
            port=settings.asterisk_ssh_port or 22,
            username=settings.asterisk_ssh_user or "root",
            password=settings.asterisk_ssh_password or None,
            pkey=pkey,
            timeout=15,
            look_for_keys=False,
            allow_agent=False,
        )
        sftp = ssh.open_sftp()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Не вдалося підключитися до сервера Asterisk по SSH: {e}"
        )

    base_dir = (settings.asterisk_recordings_path or "/var/spool/asterisk/monitor").rstrip("/")
    basename = os.path.basename(filename)

    if filename.startswith("/"):
        remote_path = filename
    else:
        try:
            _, stdout, _ = ssh.exec_command(
                f"find {base_dir} -name '{basename}' -type f 2>/dev/null | head -1"
            )
            stdout.channel.settimeout(15)
            found = stdout.read().decode().strip()
            if found:
                remote_path = found
            else:
                sftp.close()
                ssh.close()
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Файл запису не знайдено: {basename}")
        except HTTPException:
            raise
        except Exception as e:
            sftp.close()
            ssh.close()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Помилка пошуку файлу: {e}")

    try:
        file_obj = sftp.open(remote_path, "rb")
        audio_bytes = file_obj.read()
        file_obj.close()
    except Exception as e:
        sftp.close()
        ssh.close()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Помилка читання файлу: {e}")
    finally:
        try:
            sftp.close()
            ssh.close()
        except Exception:
            pass

    # Determine content type
    ext = os.path.splitext(basename)[1].lower()
    content_type = "audio/wav" if ext == ".wav" else "audio/mpeg" if ext == ".mp3" else "audio/ogg" if ext == ".ogg" else "application/octet-stream"

    # Send to OpenAI Whisper
    try:
        client = OpenAI(api_key=api_key)
        result = client.audio.transcriptions.create(
            model="whisper-1",
            file=(basename, audio_bytes, content_type),
        )
        return {"transcript": result.text}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Помилка розпізнавання мови: {e}"
        )


def _phone_variants(phone: str) -> set[str]:
    """
    Return all CDR-searchable variants of a phone number.
    Handles: 0XXXXXXXXX / 380XXXXXXXXX / +380XXXXXXXXX
    """
    digits = re.sub(r"\D", "", phone)
    variants: set[str] = set()
    if not digits:
        return variants
    # Normalize to 12-digit UA format (380XXXXXXXXX)
    if digits.startswith("380") and len(digits) == 12:
        ua12 = digits
    elif digits.startswith("0") and len(digits) == 10:
        ua12 = "380" + digits[1:]
    else:
        # Unknown format — add as-is
        variants.add(digits)
        return variants
    variants.add(ua12)                  # 380XXXXXXXXX
    variants.add("0" + ua12[3:])        # 0XXXXXXXXX
    variants.add("+" + ua12)            # +380XXXXXXXXX
    return variants


def _normalize_digits(phone: str) -> str:
    """Strip non-digits and normalize to 9-digit suffix for comparison."""
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("380") and len(digits) >= 12:
        return digits[3:]
    if digits.startswith("0") and len(digits) >= 10:
        return digits[1:]
    return digits


class VoiceBotCreateCaseRequest(BaseModel):
    transcript: str
    caller_phone: Optional[str] = None


@router.post("/voice-bot/create-case")
def voice_bot_create_case(
    data: VoiceBotCreateCaseRequest,
    db: Session = Depends(get_db),
):
    """
    Internal endpoint for voice bot to create a case after a call.
    No auth required — internal service-to-service call on Docker network.
    Mirrors the Telegram case creation flow.
    """
    import logging as _logging
    _log = _logging.getLogger("milena-bot.create-case")

    from app.models.missing_person import MissingPerson
    from app.schemas.case import CaseCreate

    # Step 1: autofill via GPT
    extracted_fields: dict = {}
    try:
        from app.services.openai_service import get_openai_service
        openai_service = get_openai_service()
        extracted_fields = openai_service.parse_case_info(db, data.transcript)
        _log.info("Autofill successful")
    except Exception as e:
        _log.warning(f"Autofill failed: {e}")

    # Step 2: build case dict
    case_dict: dict = {
        "basis": "Звернення на голосовий бот",
        "initial_info": data.transcript,
        "decision_type": "На розгляді",
        "tags": [],
    }
    if extracted_fields:
        filtered = {k: v for k, v in extracted_fields.items() if v is not None}
        # Fix None strings in missing_persons array items
        if "missing_persons" in filtered and filtered["missing_persons"]:
            for mp in filtered["missing_persons"]:
                if not mp.get("last_name"):
                    mp["last_name"] = "Невідомо"
                if not mp.get("first_name"):
                    mp["first_name"] = "Невідомо"
        case_dict.update(filtered)

    for field, fallback in [
        ("applicant_last_name", "Невідомо"),
        ("applicant_first_name", "Невідомо"),
        ("missing_last_name", "Невідомо"),
        ("missing_first_name", "Невідомо"),
    ]:
        if not case_dict.get(field):
            case_dict[field] = fallback

    # If CallerID differs from stated phone — add to other_contacts
    stated_phone = case_dict.get("applicant_phone") or ""
    if data.caller_phone and _normalize_digits(data.caller_phone) != _normalize_digits(stated_phone):
        existing = case_dict.get("other_contacts") or ""
        extra = f"Вхідний номер (CallerID): {data.caller_phone}"
        case_dict["other_contacts"] = (existing + "\n" + extra).strip() if existing else extra

    # Step 3: create case in DB
    try:
        validated = CaseCreate(**case_dict)
    except Exception as e:
        _log.error(f"CaseCreate validation error: {e}")
        return {"ok": False, "detail": str(e)}

    db_case = Case(
        created_by_user_id=None,
        basis=validated.basis,
        applicant_last_name=validated.applicant_last_name,
        applicant_first_name=validated.applicant_first_name,
        applicant_middle_name=validated.applicant_middle_name,
        applicant_phone=validated.applicant_phone,
        applicant_relation=validated.applicant_relation,
        applicant_other_contacts=case_dict.get("other_contacts"),
        missing_settlement=validated.missing_settlement,
        missing_region=validated.missing_region,
        missing_address=validated.missing_address,
        missing_last_name=validated.missing_last_name,
        missing_first_name=validated.missing_first_name,
        missing_middle_name=validated.missing_middle_name,
        missing_gender=validated.missing_gender,
        missing_birthdate=validated.missing_birthdate,
        missing_photos=validated.missing_photos or [],
        missing_last_seen_datetime=validated.missing_last_seen_datetime,
        missing_last_seen_place=validated.missing_last_seen_place,
        missing_description=validated.missing_description,
        missing_special_signs=validated.missing_special_signs,
        missing_diseases=validated.missing_diseases,
        missing_phone=validated.missing_phone,
        missing_clothing=validated.missing_clothing,
        missing_belongings=validated.missing_belongings,
        additional_search_regions=validated.additional_search_regions or [],
        police_report_filed=validated.police_report_filed,
        search_terrain_type=validated.search_terrain_type,
        disappearance_circumstances=validated.disappearance_circumstances,
        initial_info=validated.initial_info,
        call_transcript=data.transcript,
        decision_type=validated.decision_type,
        tags=validated.tags or [],
    )
    db.add(db_case)
    db.flush()

    db_missing = MissingPerson(
        case_id=db_case.id,
        last_name=validated.missing_last_name or "Невідомо",
        first_name=validated.missing_first_name or "Невідомо",
        middle_name=validated.missing_middle_name,
        gender=validated.missing_gender,
        birthdate=validated.missing_birthdate,
        phone=validated.missing_phone,
        settlement=validated.missing_settlement,
        region=validated.missing_region,
        address=validated.missing_address,
        last_seen_datetime=validated.missing_last_seen_datetime,
        last_seen_place=validated.missing_last_seen_place,
        photos=[],
        videos=[],
        description=validated.missing_description,
        special_signs=validated.missing_special_signs,
        diseases=validated.missing_diseases,
        clothing=validated.missing_clothing,
        belongings=validated.missing_belongings,
        order_index=0,
    )
    db.add(db_missing)
    db.commit()
    db.refresh(db_case)

    case_id = db_case.id
    missing_name = " ".join(filter(None, [validated.missing_last_name, validated.missing_first_name])) or "невідомо"
    _log.info(f"Voice bot case created: #{case_id} — {missing_name}")

    # Step 4: push notification
    try:
        from app.services.push_notification_service import push_service
        from app.core.notification_types import NotificationType
        push_service.send_notification_to_users_with_permission(
            db=db,
            notification_type=NotificationType.NEW_VOICE_BOT_CASE,
            title="Нова заявка з голосового бота",
            body=f"Нова заявка: {missing_name}",
            data={"case_id": case_id, "missing_name": missing_name},
            url=f"/cases/{case_id}",
        )
    except Exception as e:
        _log.warning(f"Push notification failed: {e}")

    # Step 5: auto-link recordings
    phones = [p for p in {data.caller_phone, validated.applicant_phone} if p]
    if phones:
        settings = _get_or_create_settings(db)
        if settings.asterisk_cdr_host:
            try:
                conn = _get_cdr_connection(settings)
                all_variants: set[str] = set()
                for phone in phones:
                    all_variants.update(_phone_variants(phone))
                linked = 0
                try:
                    with conn.cursor() as cursor:
                        placeholders = ",".join(["%s"] * len(all_variants))
                        cursor.execute(
                            f"""
                            SELECT uniqueid, calldate, src, dst, duration, billsec, disposition, recordingfile
                            FROM cdr
                            WHERE src IN ({placeholders})
                              AND calldate >= NOW() - INTERVAL %s MINUTE
                              AND disposition = 'ANSWERED'
                              AND recordingfile IS NOT NULL AND recordingfile != ''
                            ORDER BY calldate DESC LIMIT 10
                            """,
                            list(all_variants) + [20],
                        )
                        for row in cursor.fetchall():
                            exists = db.query(CallRecordingLink).filter(
                                CallRecordingLink.uniqueid == str(row["uniqueid"]),
                                CallRecordingLink.case_id == case_id,
                            ).first()
                            if exists:
                                continue
                            db.add(CallRecordingLink(
                                uniqueid=str(row["uniqueid"]),
                                case_id=case_id,
                                calldate=str(row["calldate"]),
                                src=row["src"] or "",
                                dst=row["dst"] or "",
                                duration=int(row["duration"] or 0),
                                billsec=int(row["billsec"] or 0),
                                disposition=row["disposition"] or "",
                                recordingfile=row["recordingfile"] or "",
                                linked_by_user_id=None,
                            ))
                            linked += 1
                finally:
                    conn.close()
                if linked:
                    db.commit()
                _log.info(f"Auto-linked {linked} recording(s) to case #{case_id}")
            except Exception as e:
                _log.warning(f"Recording auto-link failed: {e}")

    return {"ok": True, "case_id": case_id}


class VoiceBotNotifyRequest(BaseModel):
    case_id: int
    missing_name: str = "невідомо"


@router.post("/cases/notify")
def notify_new_voice_bot_case(
    data: VoiceBotNotifyRequest,
    db: Session = Depends(get_db),
):
    """
    Internal endpoint: send push notification about a new voice bot case.
    No auth required — internal service-to-service call on Docker network.
    """
    try:
        from app.services.push_notification_service import push_service
        from app.core.notification_types import NotificationType

        push_service.send_notification_to_users_with_permission(
            db=db,
            notification_type=NotificationType.NEW_VOICE_BOT_CASE,
            title="Нова заявка з голосового бота",
            body=f"Нова заявка: {data.missing_name}",
            data={"case_id": data.case_id, "missing_name": data.missing_name},
            url=f"/cases/{data.case_id}",
        )
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "detail": str(e)}


class AutoLinkRecordingsRequest(BaseModel):
    case_id: int
    phones: List[str]          # all known phones (SIP caller ID + stated by applicant)
    window_minutes: int = 20   # how far back to search in CDR


@router.post("/recordings/auto-link")
def auto_link_recordings(
    data: AutoLinkRecordingsRequest,
    db: Session = Depends(get_db),
):
    """
    Internal endpoint for voice bot to auto-attach recordings after case creation.
    No auth required — internal service-to-service call on Docker network.
    Searches CDR for calls from given phones in the last window_minutes minutes
    and creates RecordingLink records for any that have a recordingfile.
    """
    settings = _get_or_create_settings(db)
    if not settings.asterisk_cdr_host:
        return {"linked": 0, "detail": "CDR not configured"}

    case = db.query(Case).filter(Case.id == data.case_id).first()
    if not case:
        return {"linked": 0, "detail": "Case not found"}

    # Collect all phone variants for CDR matching
    all_variants: set[str] = set()
    for phone in data.phones:
        if phone:
            all_variants.update(_phone_variants(phone))
    if not all_variants:
        return {"linked": 0, "detail": "No valid phone numbers"}

    try:
        conn = _get_cdr_connection(settings)
    except HTTPException as e:
        return {"linked": 0, "detail": str(e.detail)}

    try:
        with conn.cursor() as cursor:
            placeholders = ",".join(["%s"] * len(all_variants))
            cursor.execute(
                f"""
                SELECT uniqueid, calldate, src, dst, duration, billsec, disposition, recordingfile
                FROM cdr
                WHERE src IN ({placeholders})
                  AND calldate >= NOW() - INTERVAL %s MINUTE
                  AND disposition = 'ANSWERED'
                  AND recordingfile IS NOT NULL AND recordingfile != ''
                ORDER BY calldate DESC
                LIMIT 10
                """,
                list(all_variants) + [data.window_minutes],
            )
            rows = cursor.fetchall()
    finally:
        conn.close()

    linked = 0
    for row in rows:
        existing = (
            db.query(CallRecordingLink)
            .filter(
                CallRecordingLink.uniqueid == str(row["uniqueid"]),
                CallRecordingLink.case_id == data.case_id,
            )
            .first()
        )
        if existing:
            continue
        link = CallRecordingLink(
            uniqueid=str(row["uniqueid"]),
            case_id=data.case_id,
            calldate=str(row["calldate"]),
            src=row["src"] or "",
            dst=row["dst"] or "",
            duration=int(row["duration"] or 0),
            billsec=int(row["billsec"] or 0),
            disposition=row["disposition"] or "",
            recordingfile=row["recordingfile"] or "",
            linked_by_user_id=None,  # auto-linked by voice bot
        )
        db.add(link)
        linked += 1

    if linked:
        db.commit()

    return {"linked": linked}


@router.get("/recordings/links-by-uniqueid/{uniqueid}", response_model=CaseRecordingsResponse)
def get_links_by_uniqueid(
    uniqueid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ip_atc:read")),
):
    """Get all case links for a given CDR uniqueid."""
    links = (
        db.query(CallRecordingLink)
        .filter(CallRecordingLink.uniqueid == uniqueid)
        .order_by(CallRecordingLink.linked_at.desc())
        .all()
    )
    return {"items": links}
