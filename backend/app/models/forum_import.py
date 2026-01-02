from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from datetime import datetime
from app.db import Base


class ForumImportStatus(Base):
    """
    Forum import progress tracking (singleton table)
    """
    __tablename__ = "forum_import_status"

    id = Column(Integer, primary_key=True, default=1)  # Always 1 (singleton)

    # Import status
    is_running = Column(Boolean, default=False, nullable=False)
    status = Column(String, default="idle", nullable=False)  # idle, running, completed, error

    # Progress tracking
    total_topics = Column(Integer, default=0)
    processed_topics = Column(Integer, default=0)
    successful_topics = Column(Integer, default=0)
    failed_topics = Column(Integer, default=0)

    # Current operation
    current_topic_title = Column(String, nullable=True)
    current_operation = Column(String, nullable=True)

    # Timestamps
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Error tracking
    last_error = Column(Text, nullable=True)

    # Import settings snapshot (to track what was used for this import)
    forum_url = Column(String, nullable=True)
    subforum_id = Column(Integer, nullable=True)
