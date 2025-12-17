import time
import logging
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all HTTP requests and responses"""

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        """
        Log request details and response time

        Args:
            request: Incoming HTTP request
            call_next: Next middleware/endpoint in chain

        Returns:
            Response from next middleware/endpoint
        """
        # Start timer
        start_time = time.time()

        # Get request details
        method = request.method
        url = request.url.path
        query_params = str(request.query_params) if request.query_params else ""
        client_host = request.client.host if request.client else "unknown"

        # Log request
        logger.info(
            f"Request: {method} {url} "
            f"{f'?{query_params}' if query_params else ''} "
            f"from {client_host}"
        )

        try:
            # Process request
            response = await call_next(request)

            # Calculate processing time
            process_time = time.time() - start_time

            # Log response
            logger.info(
                f"Response: {method} {url} "
                f"status={response.status_code} "
                f"time={process_time:.3f}s"
            )

            # Add processing time to response headers
            response.headers["X-Process-Time"] = str(process_time)

            return response

        except Exception as e:
            # Calculate processing time even for errors
            process_time = time.time() - start_time

            # Log error
            logger.error(
                f"Error: {method} {url} "
                f"error={str(e)} "
                f"time={process_time:.3f}s",
                exc_info=True
            )
            raise
