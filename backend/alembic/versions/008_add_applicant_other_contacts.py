"""add applicant_other_contacts to cases

Revision ID: 008_add_applicant_other_contacts
Revises: a69b47b530bc
Create Date: 2026-01-25 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '008_add_applicant_other_contacts'
down_revision = 'a69b47b530bc'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add applicant_other_contacts column to cases table
    op.add_column('cases', sa.Column('applicant_other_contacts', sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove applicant_other_contacts column
    op.drop_column('cases', 'applicant_other_contacts')
