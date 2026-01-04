"""
Simple in-memory rate limiting middleware.
For production, consider using Redis-based rate limiting.
"""
from fastapi import Request, HTTPException, status
from datetime import datetime, timedelta
from typing import Dict, List
import threading


class RateLimiter:
    """Simple in-memory rate limiter"""

    def __init__(self, requests_per_window: int = 5, window_seconds: int = 60):
        """
        Initialize rate limiter.

        Args:
            requests_per_window: Maximum number of requests allowed per window
            window_seconds: Time window in seconds
        """
        self.requests_per_window = requests_per_window
        self.window_seconds = window_seconds
        self.requests: Dict[str, List[datetime]] = {}
        self.lock = threading.Lock()

    def _clean_old_requests(self, ip: str, now: datetime):
        """Remove requests older than the time window"""
        cutoff_time = now - timedelta(seconds=self.window_seconds)
        if ip in self.requests:
            self.requests[ip] = [
                req_time for req_time in self.requests[ip]
                if req_time > cutoff_time
            ]

    def check_rate_limit(self, ip: str) -> bool:
        """
        Check if request from IP is allowed.

        Args:
            ip: Client IP address

        Returns:
            True if request is allowed, False if rate limit exceeded
        """
        with self.lock:
            now = datetime.now()

            # Clean old requests
            self._clean_old_requests(ip, now)

            # Check if limit exceeded
            if ip not in self.requests:
                self.requests[ip] = []

            if len(self.requests[ip]) >= self.requests_per_window:
                return False

            # Add current request
            self.requests[ip].append(now)
            return True

    def get_remaining_requests(self, ip: str) -> int:
        """Get number of remaining requests for IP"""
        with self.lock:
            now = datetime.now()
            self._clean_old_requests(ip, now)

            if ip not in self.requests:
                return self.requests_per_window

            return max(0, self.requests_per_window - len(self.requests[ip]))


# Global rate limiter instance for public endpoints
# Allows 5 requests per 60 seconds per IP
public_rate_limiter = RateLimiter(requests_per_window=5, window_seconds=60)


def get_client_ip(request: Request) -> str:
    """
    Extract client IP from request, considering proxy headers.
    """
    # Check for X-Forwarded-For header (set by proxies/load balancers)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For can contain multiple IPs, take the first one
        return forwarded_for.split(",")[0].strip()

    # Check for X-Real-IP header (set by nginx)
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    # Fallback to direct client IP
    if request.client:
        return request.client.host

    return "unknown"


def check_public_rate_limit(request: Request):
    """
    Dependency for checking rate limit on public endpoints.
    Raises HTTPException if rate limit exceeded.
    """
    client_ip = get_client_ip(request)

    if not public_rate_limiter.check_rate_limit(client_ip):
        remaining = public_rate_limiter.get_remaining_requests(client_ip)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "Rate limit exceeded",
                "message": "Too many requests. Please try again later.",
                "remaining": remaining,
                "window_seconds": public_rate_limiter.window_seconds
            }
        )
