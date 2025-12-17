import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SQLEnum, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class DistributionStatus(str, enum.Enum):
    """Distribution status enum"""
    planned = "planned"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"


class Distribution(Base):
    """Distribution of flyers model"""
    __tablename__ = 'distributions'

    id = Column(Integer, primary_key=True, index=True)
    search_id = Column(Integer, ForeignKey('searches.id', ondelete='CASCADE'), nullable=False, index=True)
    flyer_id = Column(Integer, ForeignKey('flyers.id', ondelete='SET NULL'), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    initiator_inforg_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'))

    settlements_text = Column(Text)

    # Channels: telegram, whatsapp, vk, email, sms, etc.
    channels = Column(ARRAY(String), default=list, nullable=False)

    status = Column(SQLEnum(DistributionStatus), default=DistributionStatus.planned, nullable=False, index=True)
    result_comment = Column(Text)

    # Relationships
    search = relationship('Search', back_populates='distributions')
    flyer = relationship('Flyer', back_populates='distributions')
    initiator_inforg = relationship('User', foreign_keys=[initiator_inforg_id])
