from fastapi import APIRouter, UploadFile, File, HTTPException, status
from typing import List
import os
import uuid
from pathlib import Path

router = APIRouter(prefix="/upload", tags=["Upload"])

# Upload directory
UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Allowed image extensions
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
# Allowed media extensions (images, video, audio, GPS tracks)
ALLOWED_MEDIA_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp",  # Images
    ".mp4", ".mov", ".avi", ".mkv", ".webm",   # Video
    ".mp3", ".wav", ".ogg", ".m4a", ".aac",    # Audio
    ".gpx", ".kml"                              # GPS tracks
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_MEDIA_FILE_SIZE = 100 * 1024 * 1024  # 100 MB for video/audio


def validate_image_file(file: UploadFile) -> None:
    """Validate uploaded image file"""
    # Check extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
        )


def validate_media_file(file: UploadFile) -> None:
    """Validate uploaded media file (image, video, audio)"""
    # Check extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_MEDIA_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_MEDIA_EXTENSIONS)}"
        )


@router.post("/images", response_model=List[str])
async def upload_images(files: List[UploadFile] = File(...)):
    """
    Upload one or multiple image files
    Returns list of URLs to uploaded files
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided"
        )

    if len(files) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 10 files allowed"
        )

    uploaded_urls = []

    for file in files:
        # Validate file
        validate_image_file(file)

        # Check file size
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File {file.filename} is too large. Maximum size: 10 MB"
            )

        # Generate unique filename while preserving original name
        file_ext = Path(file.filename).suffix.lower()
        original_name = Path(file.filename).stem
        # Sanitize filename - remove special characters
        safe_name = "".join(c for c in original_name if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_name = safe_name[:50]  # Limit length
        unique_filename = f"{uuid.uuid4()}_{safe_name}{file_ext}"
        file_path = UPLOAD_DIR / unique_filename

        # Save file
        with open(file_path, "wb") as f:
            f.write(content)

        # Return URL (relative path)
        uploaded_urls.append(f"/uploads/{unique_filename}")

    return uploaded_urls


@router.post("/media", response_model=List[str])
async def upload_media(files: List[UploadFile] = File(...)):
    """
    Upload one or multiple media files (images, video, audio)
    Returns list of URLs to uploaded files
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided"
        )

    if len(files) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 10 files allowed"
        )

    uploaded_urls = []

    for file in files:
        # Validate file
        validate_media_file(file)

        # Check file size
        content = await file.read()
        if len(content) > MAX_MEDIA_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File {file.filename} is too large. Maximum size: 100 MB"
            )

        # Generate unique filename while preserving original name
        file_ext = Path(file.filename).suffix.lower()
        original_name = Path(file.filename).stem
        # Sanitize filename - remove special characters
        safe_name = "".join(c for c in original_name if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_name = safe_name[:50]  # Limit length
        unique_filename = f"{uuid.uuid4()}_{safe_name}{file_ext}"
        file_path = UPLOAD_DIR / unique_filename

        # Save file
        with open(file_path, "wb") as f:
            f.write(content)

        # Return URL (relative path)
        uploaded_urls.append(f"/uploads/{unique_filename}")

    return uploaded_urls


@router.delete("/images/{filename}")
async def delete_image(filename: str):
    """Delete uploaded image"""
    file_path = UPLOAD_DIR / filename

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )

    # Security check - ensure file is in upload directory
    try:
        file_path.resolve().relative_to(UPLOAD_DIR.resolve())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file path"
        )

    os.remove(file_path)

    return {"detail": "File deleted successfully"}
