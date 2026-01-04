from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class NotificationSetting(Base):
    """User notification preferences for different notification types"""
    __tablename__ = 'user_notification_settings'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    notification_type = Column(String(100), nullable=False)  # e.g., "new_public_case", "field_search_participant_added"
    enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship('User', back_populates='notification_settings')

    __table_args__ = (
        UniqueConstraint('user_id', 'notification_type', name='uq_user_notification_type'),
    )
