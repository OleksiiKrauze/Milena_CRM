"""Initial schema synchronization

Revision ID: 001
Revises:
Create Date: 2025-12-21 00:40:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Bring existing production database schema in sync with current models.
    This migration assumes tables already exist and only adds missing columns.
    """

    # Check if orientations.updated_at exists, if not add it
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # Update orientations table
    orientations_columns = [col['name'] for col in inspector.get_columns('orientations')]
    if 'updated_at' not in orientations_columns:
        op.add_column('orientations',
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True))

    # Update flyer_templates table
    flyer_templates_columns = [col['name'] for col in inspector.get_columns('flyer_templates')]

    # Create enum type if it doesn't exist
    # PostgreSQL doesn't support IF NOT EXISTS for CREATE TYPE, so check first
    result = conn.execute(sa.text("SELECT 1 FROM pg_type WHERE typname = 'templatetype'"))
    if not result.fetchone():
        conn.execute(sa.text("CREATE TYPE templatetype AS ENUM ('main', 'additional', 'logo')"))

    if 'created_at' not in flyer_templates_columns:
        op.add_column('flyer_templates',
            sa.Column('created_at', sa.DateTime(timezone=True),
                     server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False))

    if 'template_type' not in flyer_templates_columns:
        op.add_column('flyer_templates',
            sa.Column('template_type',
                     postgresql.ENUM('main', 'additional', 'logo', name='templatetype'),
                     nullable=True))
        # Set default value for existing rows
        op.execute("UPDATE flyer_templates SET template_type = 'main' WHERE template_type IS NULL")
        # Make it NOT NULL after setting defaults
        op.alter_column('flyer_templates', 'template_type', nullable=False)

    if 'description' not in flyer_templates_columns:
        op.add_column('flyer_templates',
            sa.Column('description', sa.Text(), nullable=True))

    if 'is_active' not in flyer_templates_columns:
        op.add_column('flyer_templates',
            sa.Column('is_active', sa.Integer(), server_default='1', nullable=True))

    # Drop old columns from flyer_templates if they exist
    if 'file_type' in flyer_templates_columns:
        op.drop_column('flyer_templates', 'file_type')

    if 'uploaded_at' in flyer_templates_columns:
        op.drop_column('flyer_templates', 'uploaded_at')

    # Create indexes if they don't exist
    indexes = [idx['name'] for idx in inspector.get_indexes('flyer_templates')]
    if 'idx_flyer_templates_template_type' not in indexes:
        op.create_index('idx_flyer_templates_template_type', 'flyer_templates', ['template_type'])


def downgrade() -> None:
    """
    Downgrade is not supported for initial sync migration.
    """
    pass
