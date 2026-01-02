"""Add forum import settings and status table

Revision ID: 006
Revises: 005
Create Date: 2026-01-02 11:51:00

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Import needed for column existence check
    from sqlalchemy import inspect
    from sqlalchemy.engine import reflection

    conn = op.get_bind()
    inspector = inspect(conn)

    # Add forum import settings to settings table (only if they don't exist)
    existing_columns = [col['name'] for col in inspector.get_columns('settings')]

    if 'forum_url' not in existing_columns:
        op.add_column('settings', sa.Column('forum_url', sa.String(), nullable=True))
    if 'forum_username' not in existing_columns:
        op.add_column('settings', sa.Column('forum_username', sa.String(), nullable=True))
    if 'forum_password' not in existing_columns:
        op.add_column('settings', sa.Column('forum_password', sa.String(), nullable=True))
    if 'forum_subforum_id' not in existing_columns:
        op.add_column('settings', sa.Column('forum_subforum_id', sa.Integer(), nullable=True, server_default='150'))

    # Create forum_import_status table (only if it doesn't exist)
    existing_tables = inspector.get_table_names()

    if 'forum_import_status' not in existing_tables:
        op.create_table(
            'forum_import_status',
            sa.Column('id', sa.Integer(), nullable=False, server_default='1'),
            sa.Column('is_running', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('status', sa.String(), nullable=False, server_default='idle'),
            sa.Column('total_topics', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('processed_topics', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('successful_topics', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('failed_topics', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('current_topic_title', sa.String(), nullable=True),
            sa.Column('current_operation', sa.String(), nullable=True),
            sa.Column('started_at', sa.DateTime(), nullable=True),
            sa.Column('finished_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.text('NOW()')),
            sa.Column('last_error', sa.Text(), nullable=True),
            sa.Column('forum_url', sa.String(), nullable=True),
            sa.Column('subforum_id', sa.Integer(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )

        # Insert default row only if table was just created
        op.execute("""
            INSERT INTO forum_import_status (id, is_running, status, total_topics, processed_topics, successful_topics, failed_topics)
            VALUES (1, false, 'idle', 0, 0, 0, 0)
        """)


def downgrade() -> None:
    # Remove forum import settings from settings table
    op.drop_column('settings', 'forum_subforum_id')
    op.drop_column('settings', 'forum_password')
    op.drop_column('settings', 'forum_username')
    op.drop_column('settings', 'forum_url')

    # Drop forum_import_status table
    op.drop_table('forum_import_status')
