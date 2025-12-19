"""
Event model for tracking search-related events
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from .user import Base


class Event(Base):
    """Events related to searches (witness testimony, photos, videos, etc.)"""
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)

    # Relationship to search
    search_id = Column(Integer, ForeignKey("searches.id", ondelete="CASCADE"), nullable=False, index=True)

    # Creation metadata
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), index=True)

    # Event details
    event_datetime = Column(DateTime(timezone=True), nullable=False)  # When the event actually occurred
    event_type = Column(String(100), nullable=False)  # Type: показання свідка, фото, відео, etc.
    description = Column(Text, nullable=False)  # Description of the event
    media_files = Column(ARRAY(String), default=list)  # URLs to uploaded media (photos, audio, video)

    # Update metadata
    updated_at = Column(DateTime(timezone=True), nullable=True)
    updated_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    # Relationships
    search = relationship("Search", back_populates="events")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    updated_by = relationship("User", foreign_keys=[updated_by_user_id])
