"""add missing_persons table

Revision ID: 007_add_missing_persons_table
Revises: 3266d974b129
Create Date: 2026-01-12

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '007_add_missing_persons_table'
down_revision = '3266d974b129'
branch_labels = None
depends_on = None


def upgrade():
    # Create missing_persons table
    op.create_table(
        'missing_persons',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=False),
        sa.Column('last_name', sa.String(length=100), nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=False),
        sa.Column('middle_name', sa.String(length=100), nullable=True),
        sa.Column('gender', sa.String(length=20), nullable=True),
        sa.Column('birthdate', sa.DateTime(timezone=True), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('settlement', sa.String(length=200), nullable=True),
        sa.Column('region', sa.String(length=200), nullable=True),
        sa.Column('address', sa.String(length=500), nullable=True),
        sa.Column('last_seen_datetime', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_seen_place', sa.String(length=500), nullable=True),
        sa.Column('photos', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('special_signs', sa.Text(), nullable=True),
        sa.Column('diseases', sa.Text(), nullable=True),
        sa.Column('clothing', sa.Text(), nullable=True),
        sa.Column('belongings', sa.Text(), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
    )
    op.create_index(op.f('ix_missing_persons_case_id'), 'missing_persons', ['case_id'], unique=False)

    # Migrate existing data from cases table to missing_persons table
    # This will copy all existing missing_* fields as the first missing person for each case
    op.execute("""
        INSERT INTO missing_persons (
            case_id,
            last_name,
            first_name,
            middle_name,
            gender,
            birthdate,
            phone,
            settlement,
            region,
            address,
            last_seen_datetime,
            last_seen_place,
            photos,
            description,
            special_signs,
            diseases,
            clothing,
            belongings,
            order_index
        )
        SELECT
            id,
            missing_last_name,
            missing_first_name,
            missing_middle_name,
            missing_gender,
            missing_birthdate,
            missing_phone,
            missing_settlement,
            missing_region,
            missing_address,
            missing_last_seen_datetime,
            missing_last_seen_place,
            missing_photos,
            missing_description,
            missing_special_signs,
            missing_diseases,
            missing_clothing,
            missing_belongings,
            0
        FROM cases
        WHERE missing_first_name IS NOT NULL AND missing_last_name IS NOT NULL
    """)

    # Make missing_last_name and missing_first_name nullable in cases table
    # (keeping old fields for backward compatibility)
    op.alter_column('cases', 'missing_last_name', nullable=True)
    op.alter_column('cases', 'missing_first_name', nullable=True)


def downgrade():
    # Restore NOT NULL constraints
    op.alter_column('cases', 'missing_last_name', nullable=False)
    op.alter_column('cases', 'missing_first_name', nullable=False)

    # Drop missing_persons table (cascade will handle foreign keys)
    op.drop_index(op.f('ix_missing_persons_case_id'), table_name='missing_persons')
    op.drop_table('missing_persons')
