"""Add call_transcript to cases

Revision ID: 012_add_call_transcript_to_cases
Revises: 011_add_call_recording_links
Create Date: 2026-03-11

"""
from alembic import op
import sqlalchemy as sa

revision = '012_add_call_transcript_to_cases'
down_revision = '011_add_call_recording_links'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('cases', sa.Column('call_transcript', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('cases', 'call_transcript')
