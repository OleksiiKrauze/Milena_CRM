import enum
from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, Enum as SQLEnum, ARRAY, String, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class CaseStatus(str, enum.Enum):
    """Case status enum"""
    new = "new"
    in_review = "in_review"
    in_search = "in_search"
    suspended = "suspended"
    closed_found_alive = "closed_found_alive"
    closed_found_dead = "closed_found_dead"
    closed_location_known_no_search = "closed_location_known_no_search"
    closed_other = "closed_other"


class Case(Base):
    """Case/Application for missing person search"""
    __tablename__ = 'cases'

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by_user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    updated_by_user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), index=True)

    # Applicant data - split name fields
    applicant_last_name = Column(String(100), nullable=False)
    applicant_first_name = Column(String(100), nullable=False)
    applicant_middle_name = Column(String(100))
    applicant_phone = Column(String(50))
    applicant_relation = Column(String(100))

    # Missing person data - location fields
    missing_settlement = Column(String(200))
    missing_region = Column(String(200))
    missing_address = Column(String(500))

    # Missing person data - split name fields
    missing_last_name = Column(String(100), nullable=False)
    missing_first_name = Column(String(100), nullable=False)
    missing_middle_name = Column(String(100))
    missing_gender = Column(String(20))
    missing_birthdate = Column(DateTime(timezone=True))
    missing_photos = Column(ARRAY(String), default=list)  # Multiple photo URLs
    missing_last_seen_datetime = Column(DateTime(timezone=True))
    missing_last_seen_place = Column(String(500))
    missing_description = Column(Text)
    missing_special_signs = Column(Text)
    missing_diseases = Column(Text)
    missing_phone = Column(String(50))
    missing_clothing = Column(Text)
    missing_belongings = Column(Text)

    # Additional case information
    additional_search_regions = Column(ARRAY(String), default=list)
    police_report_filed = Column(Boolean, default=False)
    search_terrain_type = Column(String(50))  # Місто, Ліс, Поле, Вода, Інше
    disappearance_circumstances = Column(Text)
    initial_info = Column(Text)  # Первинна інформація - первичный ввод всех данных
    additional_info = Column(Text)

    case_status = Column(SQLEnum(CaseStatus), default=CaseStatus.new, nullable=False, index=True)
    decision_type = Column(String(50), default="На розгляді", nullable=False, index=True)
    decision_comment = Column(Text)

    # Tags for categorization - PostgreSQL array
    tags = Column(ARRAY(String), default=list)

    # Relationships
    created_by = relationship('User', foreign_keys=[created_by_user_id])
    updated_by = relationship('User', foreign_keys=[updated_by_user_id])
    searches = relationship('Search', back_populates='case', cascade='all, delete-orphan')

    @property
    def applicant_full_name(self) -> str:
        """Generate full name for applicant"""
        parts = [self.applicant_last_name, self.applicant_first_name]
        if self.applicant_middle_name:
            parts.append(self.applicant_middle_name)
        return ' '.join(parts)

    @property
    def missing_full_name(self) -> str:
        """Generate full name for missing person"""
        parts = [self.missing_last_name, self.missing_first_name]
        if self.missing_middle_name:
            parts.append(self.missing_middle_name)
        return ' '.join(parts)
