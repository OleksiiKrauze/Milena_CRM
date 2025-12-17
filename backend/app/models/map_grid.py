import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class GridCellStatus(str, enum.Enum):
    """Grid cell status enum"""
    unassigned = "unassigned"
    assigned = "assigned"
    in_progress = "in_progress"
    completed = "completed"


class MapGrid(Base):
    """Map grid model"""
    __tablename__ = 'map_grids'

    id = Column(Integer, primary_key=True, index=True)
    search_id = Column(Integer, ForeignKey('searches.id', ondelete='CASCADE'), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    initiator_inforg_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'))

    hq_coordinates = Column(String(100))
    center_coordinates = Column(String(100))
    grid_size = Column(Integer)

    map_file_url = Column(String(500))
    notes = Column(Text)

    # Relationships
    search = relationship('Search', back_populates='map_grids')
    initiator_inforg = relationship('User', foreign_keys=[initiator_inforg_id])
    grid_cells = relationship('GridCell', back_populates='map_grid', cascade='all, delete-orphan')


class GridCell(Base):
    """Grid cell model"""
    __tablename__ = 'grid_cells'

    id = Column(Integer, primary_key=True, index=True)
    map_grid_id = Column(Integer, ForeignKey('map_grids.id', ondelete='CASCADE'), nullable=False, index=True)

    cell_code = Column(String(20), nullable=False)
    coordinates = Column(String(100))
    status = Column(SQLEnum(GridCellStatus), default=GridCellStatus.unassigned, nullable=False)

    assigned_to_field_search_id = Column(Integer, ForeignKey('field_searches.id', ondelete='SET NULL'))

    notes = Column(Text)

    # Relationships
    map_grid = relationship('MapGrid', back_populates='grid_cells')
    assigned_field_search = relationship('FieldSearch', foreign_keys=[assigned_to_field_search_id])
