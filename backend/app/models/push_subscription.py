from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class PushSubscription(Base):
    """Web Push subscription for a user"""
    __tablename__ = 'push_subscriptions'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    endpoint = Column(Text, unique=True, nullable=False)
    p256dh_key = Column(Text, nullable=False)  # Public key for encryption
    auth_key = Column(Text, nullable=False)     # Authentication secret
    user_agent = Column(Text, nullable=True)    # Browser/device info for debugging
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_used_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship('User', back_populates='push_subscriptions')


# Index for быстрого поиска всех подписок пользователя
Index('idx_push_subscription_user', PushSubscription.user_id)
