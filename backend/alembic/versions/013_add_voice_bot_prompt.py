"""Add voice_bot_prompt to settings

Revision ID: 013_add_voice_bot_prompt
Revises: 012_add_call_transcript_to_cases
Create Date: 2026-03-12

"""
from alembic import op
import sqlalchemy as sa

revision = '013_add_voice_bot_prompt'
down_revision = '012_add_call_transcript_to_cases'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('settings', sa.Column('voice_bot_prompt', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('settings', 'voice_bot_prompt')
