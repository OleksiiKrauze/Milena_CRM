import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class OrganizationType(str, enum.Enum):
    """Organization type enum"""
    police = "police"  # Поліція
    medical = "medical"  # Медична
    transport = "transport"  # Транспорт
    religious = "religious"  # Релігійна
    shelter = "shelter"  # Прихистки


class Organization(Base):
    """Organization/Institution model"""
    __tablename__ = 'organizations'

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Timestamps and user tracking
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by_user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    updated_by_user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), index=True)

    # Organization info
    name = Column(String(255), nullable=False, index=True)
    type = Column(SQLEnum(OrganizationType), nullable=False, index=True)

    # Location
    region = Column(String(200), index=True)  # Область
    city = Column(String(200))  # Населений пункт
    address = Column(String(500))  # Адреса

    # Contact and notes
    contact_info = Column(Text)  # Контактна інформація (телефони, email, години роботи)
    notes = Column(Text)  # Коментар

    # Relationships
    created_by = relationship('User', foreign_keys=[created_by_user_id])
    updated_by = relationship('User', foreign_keys=[updated_by_user_id])
