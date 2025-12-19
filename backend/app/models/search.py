import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class SearchStatus(str, enum.Enum):
    """Search status enum"""
    planned = "planned"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class SearchResult(str, enum.Enum):
    """Search result enum"""
    alive = "alive"
    dead = "dead"
    location_known = "location_known"
    not_found = "not_found"


class Search(Base):
    """Search process for a case"""
    __tablename__ = 'searches'

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey('cases.id', ondelete='CASCADE'), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    initiator_inforg_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), index=True)

    start_date = Column(Date)
    end_date = Column(Date)
    result = Column(SQLEnum(SearchResult), index=True)
    result_comment = Column(Text)

    # Current flyer reference (nullable, points to one flyer)
    # Note: post_update=True handles circular reference with Flyer model
    current_flyer_id = Column(Integer, ForeignKey('flyers.id', ondelete='SET NULL'))

    status = Column(SQLEnum(SearchStatus), default=SearchStatus.planned, nullable=False, index=True)
    notes = Column(Text)

    # Relationships
    case = relationship('Case', back_populates='searches')
    initiator_inforg = relationship('User', foreign_keys=[initiator_inforg_id])
    current_flyer = relationship('Flyer', foreign_keys=[current_flyer_id], post_update=True)
    flyers = relationship('Flyer', back_populates='search', foreign_keys='Flyer.search_id', cascade='all, delete-orphan')
    distributions = relationship('Distribution', back_populates='search', cascade='all, delete-orphan')
    map_grids = relationship('MapGrid', back_populates='search', cascade='all, delete-orphan')
    field_searches = relationship('FieldSearch', back_populates='search', cascade='all, delete-orphan')
    events = relationship('Event', back_populates='search', cascade='all, delete-orphan')
