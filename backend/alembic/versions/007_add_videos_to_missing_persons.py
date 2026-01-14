"""add videos to missing_persons

Revision ID: 007_add_videos
Revises: ed4eb014b536
Create Date: 2026-01-14 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '007_add_videos'
down_revision = 'ed4eb014b536'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add videos column to missing_persons table
    op.add_column('missing_persons', sa.Column('videos', sa.ARRAY(sa.String()), nullable=True))

    # Set default empty array for existing records
    op.execute("UPDATE missing_persons SET videos = ARRAY[]::varchar[] WHERE videos IS NULL")


def downgrade() -> None:
    # Remove videos column
    op.drop_column('missing_persons', 'videos')
