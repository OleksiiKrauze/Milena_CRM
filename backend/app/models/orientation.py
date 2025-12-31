from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, ARRAY
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class Orientation(Base):
    """Orientation/Flyer for missing person search"""
    __tablename__ = 'orientations'

    id = Column(Integer, primary_key=True, index=True)
    search_id = Column(Integer, ForeignKey('searches.id', ondelete='CASCADE'), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Template selection
    template_id = Column(Integer, ForeignKey('flyer_templates.id', ondelete='SET NULL'), nullable=True)

    # Selected photos for this orientation
    selected_photos = Column(ARRAY(String), default=list)  # URLs to photos

    # Canvas data (positions, sizes, layers, etc.)
    canvas_data = Column(JSONB, default=dict)  # JSON with canvas state

    # Text content
    text_content = Column(Text)  # The actual text of the orientation

    # Status
    is_approved = Column(Boolean, default=False)  # "Узгоджено" checkbox

    # Exported JPEG files
    exported_files = Column(ARRAY(String), default=list)  # Paths to exported JPEG files

    # Uploaded images (user-uploaded orientation images)
    uploaded_images = Column(ARRAY(String), default=list)  # Paths to uploaded orientation images

    # Relationships
    search = relationship('Search', back_populates='orientations')
    template = relationship('FlyerTemplate')
