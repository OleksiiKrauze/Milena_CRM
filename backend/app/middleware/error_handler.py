import logging
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError, OperationalError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    Handle HTTP exceptions

    Args:
        request: Incoming request
        exc: HTTP exception

    Returns:
        JSON response with error details
    """
    logger.warning(
        f"HTTP exception: {exc.status_code} - {exc.detail} "
        f"path={request.url.path}"
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "status_code": exc.status_code,
                "message": exc.detail,
                "path": request.url.path
            }
        }
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handle request validation errors

    Args:
        request: Incoming request
        exc: Validation error

    Returns:
        JSON response with validation error details
    """
    errors = exc.errors()
    logger.warning(
        f"Validation error: {len(errors)} error(s) "
        f"path={request.url.path} errors={errors}"
    )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY,
                "message": "Validation error",
                "path": request.url.path,
                "details": errors
            }
        }
    )


async def integrity_error_handler(request: Request, exc: IntegrityError):
    """
    Handle database integrity errors (unique constraints, etc.)

    Args:
        request: Incoming request
        exc: Integrity error

    Returns:
        JSON response with error details
    """
    logger.error(
        f"Database integrity error: {str(exc)} "
        f"path={request.url.path}",
        exc_info=True
    )

    # Extract useful error message
    error_msg = "Database integrity constraint violation"
    if "unique constraint" in str(exc).lower():
        error_msg = "A record with this data already exists"
    elif "foreign key constraint" in str(exc).lower():
        error_msg = "Referenced record does not exist"

    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error": {
                "status_code": status.HTTP_400_BAD_REQUEST,
                "message": error_msg,
                "path": request.url.path
            }
        }
    )


async def database_error_handler(request: Request, exc: OperationalError):
    """
    Handle database operational errors (connection issues, etc.)

    Args:
        request: Incoming request
        exc: Operational error

    Returns:
        JSON response with error details
    """
    logger.error(
        f"Database operational error: {str(exc)} "
        f"path={request.url.path}",
        exc_info=True
    )

    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "error": {
                "status_code": status.HTTP_503_SERVICE_UNAVAILABLE,
                "message": "Database service temporarily unavailable",
                "path": request.url.path
            }
        }
    )


async def general_exception_handler(request: Request, exc: Exception):
    """
    Handle all other unhandled exceptions

    Args:
        request: Incoming request
        exc: Exception

    Returns:
        JSON response with error details
    """
    logger.error(
        f"Unhandled exception: {type(exc).__name__}: {str(exc)} "
        f"path={request.url.path}",
        exc_info=True
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                "message": "Internal server error",
                "path": request.url.path
            }
        }
    )
