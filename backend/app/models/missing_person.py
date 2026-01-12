from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, ARRAY, Boolean
from sqlalchemy.orm import relationship
from app.db import Base


class MissingPerson(Base):
    """Missing person associated with a case"""
    __tablename__ = 'missing_persons'

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey('cases.id', ondelete='CASCADE'), nullable=False, index=True)

    # Personal data - split name fields
    last_name = Column(String(100), nullable=False)
    first_name = Column(String(100), nullable=False)
    middle_name = Column(String(100))
    gender = Column(String(20))
    birthdate = Column(DateTime(timezone=True))

    # Contact
    phone = Column(String(50))

    # Location where missing person lived
    settlement = Column(String(200))
    region = Column(String(200))
    address = Column(String(500))

    # Last seen information
    last_seen_datetime = Column(DateTime(timezone=True))
    last_seen_place = Column(String(500))

    # Photos - array of URLs
    photos = Column(ARRAY(String), default=list)

    # Description
    description = Column(Text)  # Physical description
    special_signs = Column(Text)  # Special signs/marks
    diseases = Column(Text)  # Medical conditions
    clothing = Column(Text)  # What they were wearing
    belongings = Column(Text)  # Personal belongings they had

    # Order in case (for displaying multiple missing persons)
    order_index = Column(Integer, default=0, nullable=False)

    # Relationship
    case = relationship('Case', back_populates='missing_persons')

    @property
    def full_name(self) -> str:
        """Generate full name"""
        parts = [self.last_name, self.first_name]
        if self.middle_name:
            parts.append(self.middle_name)
        return ' '.join(parts)
