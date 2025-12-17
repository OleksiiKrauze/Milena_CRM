from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class Flyer(Base):
    """Flyer/Orientation model"""
    __tablename__ = 'flyers'

    id = Column(Integer, primary_key=True, index=True)
    search_id = Column(Integer, ForeignKey('searches.id', ondelete='CASCADE'), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    initiator_inforg_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'))

    title = Column(String(255), nullable=False)
    content = Column(Text)
    photo_url = Column(String(500))
    file_url = Column(String(500))

    is_active = Column(Boolean, default=True, nullable=False)
    version = Column(Integer, default=1, nullable=False)

    # Relationships
    search = relationship('Search', back_populates='flyers', foreign_keys=[search_id])
    initiator_inforg = relationship('User', foreign_keys=[initiator_inforg_id])
    distributions = relationship('Distribution', back_populates='flyer', cascade='all, delete-orphan')
