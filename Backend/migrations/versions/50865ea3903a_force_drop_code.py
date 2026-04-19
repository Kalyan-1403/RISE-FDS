"""force_drop_code

Revision ID: 50865ea3903a
Revises: 2a3128a7a9af
Create Date: 2026-04-19 15:33:56.023098

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '50865ea3903a'
down_revision = '2a3128a7a9af'
branch_labels = None
depends_on = None


def upgrade():
    # This safely tells PostgreSQL to drop the column ONLY if it exists.
    # It won't crash your local DB, but it will fix your Render DB!
    op.execute('ALTER TABLE faculty DROP COLUMN IF EXISTS code;')


def downgrade():
    pass
