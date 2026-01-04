"""
Push Notification Service for Web Push API.

Handles sending push notifications to users via Web Push protocol (RFC 8030).
Integrates with RBAC to ensure only authorized users receive notifications.
"""
import os
import json
import logging
from typing import List, Dict, Any, Optional
from pywebpush import webpush, WebPushException
from sqlalchemy.orm import Session
from app.models.push_subscription import PushSubscription
from app.models.notification_setting import NotificationSetting
from app.models.user import User
from app.core.notification_types import NotificationType, get_required_permission
from app.routers.auth import get_user_permissions
from datetime import datetime

logger = logging.getLogger(__name__)


class PushNotificationService:
    """Service for sending Web Push notifications"""

    def __init__(self):
        self.vapid_private_key = os.getenv("VAPID_PRIVATE_KEY")
        self.vapid_public_key = os.getenv("VAPID_PUBLIC_KEY")
        self.vapid_subject = os.getenv("VAPID_SUBJECT", "mailto:support@przmilena.click")

        if not self.vapid_private_key or not self.vapid_public_key:
            logger.warning("VAPID keys not configured - push notifications will not work")

    def send_notification(
        self,
        db: Session,
        user_id: int,
        notification_type: NotificationType,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        icon: str = "/android-chrome-192x192.png",
        badge: str = "/favicon-32x32.png",
        url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send push notification to a specific user.

        Args:
            db: Database session
            user_id: ID of user to send notification to
            notification_type: Type of notification (for permission check)
            title: Notification title
            body: Notification body text
            data: Additional data payload
            icon: Icon URL
            badge: Badge icon URL
            url: URL to open when notification is clicked

        Returns:
            Dict with 'sent', 'failed' counts and optional 'reason'
        """
        if not self.vapid_private_key or not self.vapid_public_key:
            logger.error("VAPID keys not configured")
            return {"sent": 0, "failed": 0, "reason": "vapid_not_configured"}

        # Get user's push subscriptions
        subscriptions = db.query(PushSubscription).filter(
            PushSubscription.user_id == user_id
        ).all()

        if not subscriptions:
            logger.info(f"No push subscriptions found for user {user_id}")
            return {"sent": 0, "failed": 0, "reason": "no_subscriptions"}

        # Check if user has this notification type enabled
        setting = db.query(NotificationSetting).filter(
            NotificationSetting.user_id == user_id,
            NotificationSetting.notification_type == notification_type.value
        ).first()

        if setting and not setting.enabled:
            logger.info(f"Notification {notification_type} disabled for user {user_id}")
            return {"sent": 0, "failed": 0, "reason": "disabled_by_user"}

        # Prepare notification payload
        payload = {
            "title": title,
            "body": body,
            "icon": icon,
            "badge": badge,
            "data": data or {},
            "tag": notification_type.value,
            "requireInteraction": False,
        }

        if url:
            payload["data"]["url"] = url

        sent_count = 0
        failed_subscriptions = []

        for subscription in subscriptions:
            try:
                subscription_info = {
                    "endpoint": subscription.endpoint,
                    "keys": {
                        "p256dh": subscription.p256dh_key,
                        "auth": subscription.auth_key
                    }
                }

                webpush(
                    subscription_info=subscription_info,
                    data=json.dumps(payload),
                    vapid_private_key=self.vapid_private_key,
                    vapid_claims={
                        "sub": self.vapid_subject
                    }
                )

                # Update last_used_at
                subscription.last_used_at = datetime.utcnow()
                sent_count += 1

                logger.info(f"Push sent to user {user_id}, subscription {subscription.id}")

            except WebPushException as e:
                logger.error(f"Failed to send push to subscription {subscription.id}: {e}")

                # If subscription is expired/invalid (410 Gone), mark for deletion
                if e.response and e.response.status_code == 410:
                    failed_subscriptions.append(subscription.id)
                    logger.info(f"Subscription {subscription.id} expired (410 Gone), will delete")

        # Clean up expired subscriptions
        if failed_subscriptions:
            db.query(PushSubscription).filter(
                PushSubscription.id.in_(failed_subscriptions)
            ).delete(synchronize_session=False)
            logger.info(f"Deleted {len(failed_subscriptions)} expired subscriptions")

        db.commit()

        return {
            "sent": sent_count,
            "failed": len(failed_subscriptions)
        }

    def send_notification_to_users_with_permission(
        self,
        db: Session,
        notification_type: NotificationType,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send notification to all users who have the required permission.

        Example: Send "new_public_case" to all users with "cases:read" permission.

        Args:
            db: Database session
            notification_type: Type of notification
            title: Notification title
            body: Notification body text
            data: Additional data payload
            url: URL to open when notification is clicked

        Returns:
            Dict with 'sent', 'failed', 'users_count'
        """
        required_permission = get_required_permission(notification_type)
        if not required_permission:
            logger.error(f"No permission mapping for notification type {notification_type}")
            return {"sent": 0, "failed": 0, "reason": "no_permission_mapping"}

        # Get all active users with roles
        users_with_roles = db.query(User).join(User.roles).filter(
            User.status == "active"
        ).all()

        # Filter users by permission
        eligible_users = []
        for user in users_with_roles:
            user_perms = get_user_permissions(user)
            if required_permission in user_perms:
                eligible_users.append(user)

        if not eligible_users:
            logger.info(f"No users found with permission {required_permission}")
            return {"sent": 0, "failed": 0, "reason": "no_eligible_users"}

        total_sent = 0
        total_failed = 0

        for user in eligible_users:
            result = self.send_notification(
                db=db,
                user_id=user.id,
                notification_type=notification_type,
                title=title,
                body=body,
                data=data,
                url=url
            )
            total_sent += result.get("sent", 0)
            total_failed += result.get("failed", 0)

        logger.info(
            f"Broadcast notification {notification_type}: "
            f"{total_sent} sent, {total_failed} failed to {len(eligible_users)} users"
        )

        return {
            "sent": total_sent,
            "failed": total_failed,
            "users_count": len(eligible_users)
        }


# Global service instance
push_service = PushNotificationService()
