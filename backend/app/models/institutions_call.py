from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class InstitutionsCall(Base):
    """Institutions call model"""
    __tablename__ = 'institutions_calls'

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey('cases.id', ondelete='CASCADE'), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'))

    organization_name = Column(String(255), nullable=False)
    organization_type = Column(String(100))
    phone = Column(String(50))

    result = Column(Text)
    notes = Column(Text)

    # Relationships
    case = relationship('Case')
    user = relationship('User', foreign_keys=[user_id])
