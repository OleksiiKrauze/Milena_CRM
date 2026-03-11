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
