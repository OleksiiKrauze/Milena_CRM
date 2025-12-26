import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, Enum as SQLEnum, Table, ARRAY, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class FieldSearchStatus(str, enum.Enum):
    """Field search status enum"""
    planning = "planning"
    prepared = "prepared"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


# Association table with extra fields for field search participants
field_search_participants = Table(
    'field_search_participants',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('field_search_id', Integer, ForeignKey('field_searches.id', ondelete='CASCADE'), nullable=False),
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
    Column('role_on_field', String(50)),  # coordinator, navigator, searcher, driver
    Column('group_name', String(50))  # Group A, Group B, etc.
)


class FieldSearch(Base):
    """Field search model"""
    __tablename__ = 'field_searches'

    id = Column(Integer, primary_key=True, index=True)
    search_id = Column(Integer, ForeignKey('searches.id', ondelete='CASCADE'), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    initiator_inforg_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'))

    start_date = Column(Date)
    flyer_id = Column(Integer, ForeignKey('flyers.id', ondelete='SET NULL'))

    meeting_datetime = Column(DateTime(timezone=True))
    meeting_place = Column(String(500))

    coordinator_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'))

    status = Column(SQLEnum(FieldSearchStatus), default=FieldSearchStatus.planning, nullable=False, index=True)
    end_date = Column(Date)
    result = Column(Text)
    notes = Column(Text)

    # Preparation section
    preparation_grid_file = Column(String(500))  # URL to grid file (gpx/kml)
    preparation_map_image = Column(String(500))  # URL to map image

    # Grid generation parameters
    grid_center_lat = Column(Float)  # Latitude of grid center point
    grid_center_lon = Column(Float)  # Longitude of grid center point
    grid_cols = Column(Integer)  # Number of grid columns (horizontal)
    grid_rows = Column(Integer)  # Number of grid rows (vertical)
    grid_cell_size = Column(Integer)  # Cell size in meters

    # Search progress section
    search_tracks = Column(ARRAY(String), default=list)  # URLs to track files (gpx/kml)
    search_photos = Column(ARRAY(String), default=list)  # URLs to photos

    # Relationships
    search = relationship('Search', back_populates='field_searches')
    initiator_inforg = relationship('User', foreign_keys=[initiator_inforg_id])
    flyer = relationship('Flyer', foreign_keys=[flyer_id])
    coordinator = relationship('User', foreign_keys=[coordinator_id])

    @property
    def case_id(self) -> int:
        """Get case_id from related search"""
        return self.search.case_id if self.search else None
