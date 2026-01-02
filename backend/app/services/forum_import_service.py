"""
Forum import service - adapts forum_migrator.py for web interface
"""
import asyncio
import threading
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.forum_import import ForumImportStatus
from app.db import SessionLocal

# Import the ForumMigrator class
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))
try:
    from forum_migrator import ForumMigrator
except ImportError:
    ForumMigrator = None


class ForumImportService:
    """Service for managing forum imports"""

    @staticmethod
    def get_status(db: Session) -> ForumImportStatus:
        """Get current import status"""
        status = db.query(ForumImportStatus).filter(ForumImportStatus.id == 1).first()
        if not status:
            # Create default status if doesn't exist
            status = ForumImportStatus(
                id=1,
                is_running=False,
                status='idle',
                total_topics=0,
                processed_topics=0,
                successful_topics=0,
                failed_topics=0
            )
            db.add(status)
            db.commit()
            db.refresh(status)
        return status

    @staticmethod
    def update_status(db: Session, **kwargs) -> ForumImportStatus:
        """Update import status"""
        status = ForumImportService.get_status(db)
        for key, value in kwargs.items():
            setattr(status, key, value)
        status.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(status)
        return status

    @staticmethod
    def start_import(
        forum_url: str,
        forum_username: str,
        forum_password: str,
        subforum_id: int,
        max_topics: int,
        api_email: str,
        api_password: str
    ):
        """Start forum import in background thread"""

        # Check if ForumMigrator is available
        if ForumMigrator is None:
            raise RuntimeError("ForumMigrator not available. Make sure forum_migrator.py is in the project root.")

        # Start import in background thread
        thread = threading.Thread(
            target=ForumImportService._run_import,
            args=(forum_url, forum_username, forum_password, subforum_id, max_topics, api_email, api_password),
            daemon=True
        )
        thread.start()

    @staticmethod
    def _run_import(
        forum_url: str,
        forum_username: str,
        forum_password: str,
        subforum_id: int,
        max_topics: int,
        api_email: str,
        api_password: str
    ):
        """Run forum import (called in background thread)"""
        db = SessionLocal()

        try:
            # Update status to running
            ForumImportService.update_status(
                db,
                is_running=True,
                status='running',
                started_at=datetime.utcnow(),
                finished_at=None,
                total_topics=max_topics,
                processed_topics=0,
                successful_topics=0,
                failed_topics=0,
                current_topic_title=None,
                current_operation='Initializing...',
                last_error=None,
                forum_url=forum_url,
                subforum_id=subforum_id
            )

            # Create migrator with custom progress callbacks
            migrator = ForumMigrator(forum_url=forum_url, api_url="http://localhost:8000")

            # Setup driver
            ForumImportService.update_status(db, current_operation='Setting up browser...')
            migrator.setup_driver()

            # Login to forum
            ForumImportService.update_status(db, current_operation='Logging in to forum...')
            if not migrator.login_forum(forum_username, forum_password):
                raise Exception("Failed to login to forum")

            # Login to API
            ForumImportService.update_status(db, current_operation='Logging in to API...')
            if not migrator.login_api(api_email, api_password):
                raise Exception("Failed to login to API")

            # Get topics
            ForumImportService.update_status(db, current_operation=f'Fetching topics from subforum {subforum_id}...')
            topics = migrator.get_topics_from_subforum(subforum_id, max_topics)

            if not topics:
                raise Exception("No topics found")

            ForumImportService.update_status(db, total_topics=len(topics))

            # Process each topic
            success_count = 0
            for i, topic in enumerate(topics, 1):
                try:
                    ForumImportService.update_status(
                        db,
                        processed_topics=i,
                        current_topic_title=topic['title'],
                        current_operation=f'Processing topic {i}/{len(topics)}'
                    )

                    # Get topic details
                    topic_data = migrator.get_topic_details(topic['url'])

                    # Create case
                    case_id = migrator.create_case_from_topic(topic_data)
                    if not case_id:
                        ForumImportService.update_status(
                            db,
                            failed_topics=ForumImportService.get_status(db).failed_topics + 1
                        )
                        continue

                    # Create search
                    search_id = migrator.create_search_for_case(case_id, topic_data)

                    # Create events
                    if search_id:
                        migrator.create_events_from_posts(search_id, topic_data['posts'])

                    success_count += 1
                    ForumImportService.update_status(
                        db,
                        successful_topics=success_count
                    )

                except Exception as e:
                    ForumImportService.update_status(
                        db,
                        failed_topics=ForumImportService.get_status(db).failed_topics + 1,
                        last_error=str(e)
                    )

            # Complete
            ForumImportService.update_status(
                db,
                is_running=False,
                status='completed',
                finished_at=datetime.utcnow(),
                current_operation=None,
                current_topic_title=None
            )

        except Exception as e:
            # Error
            ForumImportService.update_status(
                db,
                is_running=False,
                status='error',
                finished_at=datetime.utcnow(),
                last_error=str(e),
                current_operation=None,
                current_topic_title=None
            )

        finally:
            if 'migrator' in locals() and migrator.driver:
                migrator.driver.quit()
            db.close()
