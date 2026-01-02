from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ForumImportSettingsUpdate(BaseModel):
    """Forum import settings update schema"""
    forum_url: Optional[str] = None
    forum_username: Optional[str] = None
    forum_password: Optional[str] = None
    forum_subforum_id: Optional[int] = None


class ForumImportStatusResponse(BaseModel):
    """Forum import status response schema"""
    id: int
    is_running: bool
    status: str
    total_topics: int
    processed_topics: int
    successful_topics: int
    failed_topics: int
    current_topic_title: Optional[str] = None
    current_operation: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_error: Optional[str] = None
    forum_url: Optional[str] = None
    subforum_id: Optional[int] = None

    class Config:
        from_attributes = True


class ForumImportStartRequest(BaseModel):
    """Forum import start request schema"""
    forum_url: str
    forum_username: str
    forum_password: str
    subforum_id: int
    max_topics: int = 10
    api_email: str
    api_password: str
