from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, ARRAY, String, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class Case(Base):
    """Case/Application for missing person search"""
    __tablename__ = 'cases'

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by_user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    updated_by_user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), index=True)

    # Basis for the case
    basis = Column(String(200))  # Підстава (звернення поліції, дзвінок на гарячу лінію, соцмережі і тд)

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

    # LEGACY: Missing person data - kept for backward compatibility
    # New cases use missing_persons relationship (separate table)
    # These fields are populated from first missing_person for old API compatibility
    missing_last_name = Column(String(100), nullable=True)  # Changed to nullable
    missing_first_name = Column(String(100), nullable=True)  # Changed to nullable
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
    search_terrain_type = Column(String(50))  # Місто, Ліс, Поле, Вода, Інше
    disappearance_circumstances = Column(Text)
    initial_info = Column(Text)  # Первинна інформація - первичный ввод всех данных
    additional_info = Column(Text)

    # Police information
    police_report_filed = Column(Boolean, default=False)
    police_report_date = Column(DateTime(timezone=True))
    police_department = Column(String(200))  # Райвідділок
    police_contact_user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'))

    # Notes
    notes_text = Column(Text)  # Текстові примітки
    notes_images = Column(ARRAY(String), default=list)  # Зображення до приміток

    decision_type = Column(String(50), default="На розгляді", nullable=False, index=True)
    decision_comment = Column(Text)

    # Tags for categorization - PostgreSQL array
    tags = Column(ARRAY(String), default=list)

    # Relationships
    created_by = relationship('User', foreign_keys=[created_by_user_id])
    updated_by = relationship('User', foreign_keys=[updated_by_user_id])
    police_contact = relationship('User', foreign_keys=[police_contact_user_id])
    missing_persons = relationship('MissingPerson', back_populates='case', cascade='all, delete-orphan', order_by='MissingPerson.order_index')
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

    @property
    def latest_search_result(self) -> str | None:
        """Get the result from the most recent search"""
        if not self.searches:
            return None
        # Sort searches by created_at descending and get the first one's result
        latest = max(self.searches, key=lambda s: s.created_at)
        return latest.result
