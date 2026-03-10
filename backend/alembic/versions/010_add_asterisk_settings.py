"""add asterisk settings to settings table

Revision ID: 010_add_asterisk_settings
Revises: 009_person_identified
Create Date: 2026-03-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '010_add_asterisk_settings'
down_revision = '009_person_identified'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('settings', sa.Column('asterisk_cdr_host', sa.String(), nullable=True))
    op.add_column('settings', sa.Column('asterisk_cdr_port', sa.Integer(), nullable=True, server_default='3306'))
    op.add_column('settings', sa.Column('asterisk_cdr_db', sa.String(), nullable=True, server_default='asteriskcdrdb'))
    op.add_column('settings', sa.Column('asterisk_cdr_user', sa.String(), nullable=True))
    op.add_column('settings', sa.Column('asterisk_cdr_password', sa.String(), nullable=True))
    op.add_column('settings', sa.Column('asterisk_ssh_host', sa.String(), nullable=True))
    op.add_column('settings', sa.Column('asterisk_ssh_port', sa.Integer(), nullable=True, server_default='22'))
    op.add_column('settings', sa.Column('asterisk_ssh_user', sa.String(), nullable=True))
    op.add_column('settings', sa.Column('asterisk_ssh_password', sa.String(), nullable=True))
    op.add_column('settings', sa.Column('asterisk_ssh_key', sa.Text(), nullable=True))
    op.add_column('settings', sa.Column('asterisk_recordings_path', sa.String(), nullable=True,
                                        server_default='/var/spool/asterisk/monitor'))


def downgrade() -> None:
    op.drop_column('settings', 'asterisk_recordings_path')
    op.drop_column('settings', 'asterisk_ssh_key')
    op.drop_column('settings', 'asterisk_ssh_password')
    op.drop_column('settings', 'asterisk_ssh_user')
    op.drop_column('settings', 'asterisk_ssh_port')
    op.drop_column('settings', 'asterisk_ssh_host')
    op.drop_column('settings', 'asterisk_cdr_password')
    op.drop_column('settings', 'asterisk_cdr_user')
    op.drop_column('settings', 'asterisk_cdr_db')
    op.drop_column('settings', 'asterisk_cdr_port')
    op.drop_column('settings', 'asterisk_cdr_host')
