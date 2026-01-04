import enum
from sqlalchemy import Column, Integer, String, Text, Boolean, Enum as SQLEnum, Table, ForeignKey, ARRAY
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

    # One-to-many relationships for push notifications
    push_subscriptions = relationship('PushSubscription', back_populates='user', cascade='all, delete-orphan')
    notification_settings = relationship('NotificationSetting', back_populates='user', cascade='all, delete-orphan')

    @property
    def full_name(self) -> str:
        """Generate full name from components"""
        parts = [self.last_name, self.first_name]
        if self.middle_name:
            parts.append(self.middle_name)
        return ' '.join(parts)


class Role(Base):
    """Role with permissions (RBAC)"""
    __tablename__ = 'roles'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)  # Unique identifier (e.g., "admin", "coordinator")
    display_name = Column(String(100), nullable=False)  # Display name (e.g., "Адміністратор")
    description = Column(String(500))
    permissions = Column(ARRAY(String), default=list, nullable=False)  # List of permission codes ["cases:read", "cases:create", ...]
    is_system = Column(Boolean, default=False, nullable=False)  # System roles cannot be deleted

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
