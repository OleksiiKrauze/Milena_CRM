import enum
from sqlalchemy import Column, Integer, String, Text, Enum as SQLEnum, Table, ForeignKey
from sqlalchemy.orm import relationship
from app.db import Base

# Association tables for many-to-many relationships
user_roles = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('role_id', Integer, ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True)
)

user_directions = Table(
    'user_directions',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('direction_id', Integer, ForeignKey('directions.id', ondelete='CASCADE'), primary_key=True)
)


class UserStatus(str, enum.Enum):
    """User account status"""
    active = "active"
    inactive = "inactive"
    pending = "pending"


class User(Base):
    """User/Employee model"""
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True)
    last_name = Column(String(100), nullable=False)
    first_name = Column(String(100), nullable=False)
    middle_name = Column(String(100), nullable=True)  # Optional (по батькові)
    phone = Column(String(50), unique=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    city = Column(String(100))
    status = Column(SQLEnum(UserStatus), default=UserStatus.pending, nullable=False, index=True)
    comment = Column(Text)
    password_hash = Column(String(255), nullable=False)

    # Many-to-many relationships
    roles = relationship('Role', secondary=user_roles, back_populates='users')
    directions = relationship('Direction', secondary=user_directions, back_populates='users')

    @property
    def full_name(self) -> str:
        """Generate full name from components"""
        parts = [self.last_name, self.first_name]
        if self.middle_name:
            parts.append(self.middle_name)
        return ' '.join(parts)


class Role(Base):
    """Role reference table with hierarchy"""
    __tablename__ = 'roles'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(String(255))
    parent_role_id = Column(Integer, ForeignKey('roles.id', ondelete='SET NULL'), nullable=True, index=True)

    # Self-referential relationship for hierarchy
    parent_role = relationship('Role', remote_side=[id], backref='child_roles')

    # Relationship
    users = relationship('User', secondary=user_roles, back_populates='roles')


class Direction(Base):
    """Direction of work reference table"""
    __tablename__ = 'directions'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(255))
    responsible_user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)

    # Relationship
    users = relationship('User', secondary=user_directions, back_populates='directions')
    responsible_user = relationship('User', foreign_keys=[responsible_user_id])
