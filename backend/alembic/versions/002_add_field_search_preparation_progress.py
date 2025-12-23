"""Add preparation and search progress fields to field_searches

Revision ID: 002
Revises: 001
Create Date: 2025-12-22 19:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add preparation and search progress fields to field_searches table"""

    # Check if columns already exist to avoid errors
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    field_searches_columns = [col['name'] for col in inspector.get_columns('field_searches')]

    # Add preparation section columns
    if 'preparation_grid_file' not in field_searches_columns:
        op.add_column('field_searches',
            sa.Column('preparation_grid_file', sa.String(length=500), nullable=True))

    if 'preparation_map_image' not in field_searches_columns:
        op.add_column('field_searches',
            sa.Column('preparation_map_image', sa.String(length=500), nullable=True))

    # Add search progress section columns
    if 'search_tracks' not in field_searches_columns:
        op.add_column('field_searches',
            sa.Column('search_tracks', postgresql.ARRAY(sa.String()), nullable=True,
                     server_default=sa.text("'{}'::varchar[]")))

    if 'search_photos' not in field_searches_columns:
        op.add_column('field_searches',
            sa.Column('search_photos', postgresql.ARRAY(sa.String()), nullable=True,
                     server_default=sa.text("'{}'::varchar[]")))


def downgrade() -> None:
    """Remove preparation and search progress fields from field_searches table"""

    op.drop_column('field_searches', 'search_photos')
    op.drop_column('field_searches', 'search_tracks')
    op.drop_column('field_searches', 'preparation_map_image')
    op.drop_column('field_searches', 'preparation_grid_file')
