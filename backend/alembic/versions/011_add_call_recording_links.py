"""add call_recording_links table

Revision ID: 011_add_call_recording_links
Revises: 010_add_asterisk_settings
Create Date: 2026-03-11 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '011_add_call_recording_links'
down_revision = '010_add_asterisk_settings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'call_recording_links',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('uniqueid', sa.String(150), nullable=False, index=True),
        sa.Column('case_id', sa.Integer(), sa.ForeignKey('cases.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('calldate', sa.String(50), nullable=True),
        sa.Column('src', sa.String(100), nullable=True),
        sa.Column('dst', sa.String(100), nullable=True),
        sa.Column('duration', sa.Integer(), nullable=True),
        sa.Column('billsec', sa.Integer(), nullable=True),
        sa.Column('disposition', sa.String(50), nullable=True),
        sa.Column('recordingfile', sa.String(500), nullable=True),
        sa.Column('linked_by_user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('linked_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('call_recording_links')
