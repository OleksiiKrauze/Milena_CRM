from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class CallRecordingLink(Base):
    """Links an Asterisk CDR recording to a CRM case."""
    __tablename__ = 'call_recording_links'

    id = Column(Integer, primary_key=True, index=True)
    # Asterisk CDR uniqueid — identifies the specific call
    uniqueid = Column(String(150), nullable=False, index=True)
    case_id = Column(Integer, ForeignKey('cases.id', ondelete='CASCADE'), nullable=False, index=True)

    # Cached CDR fields for display without hitting Asterisk each time
    calldate = Column(String(50))
    src = Column(String(100))
    dst = Column(String(100))
    duration = Column(Integer)
    billsec = Column(Integer)
    disposition = Column(String(50))
    recordingfile = Column(String(500))

    # Audit
    linked_by_user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'))
    linked_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    case = relationship('Case', backref='call_recording_links')
    linked_by = relationship('User', foreign_keys=[linked_by_user_id])
