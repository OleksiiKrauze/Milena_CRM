"""add person_identified to SearchResult enum

Revision ID: 009_person_identified
Revises: 008_add_applicant_other_contacts
Create Date: 2026-01-25 15:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '009_person_identified'
down_revision = '008_add_applicant_other_contacts'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'person_identified' value to searchresult enum
    op.execute("ALTER TYPE searchresult ADD VALUE IF NOT EXISTS 'person_identified'")


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values directly
    # The value will remain but won't be used
    pass
