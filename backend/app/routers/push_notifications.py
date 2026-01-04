"""
Push Notifications API Router.

Provides endpoints for managing push notification subscriptions and settings.
Integrates with RBAC to filter available notification types by user permissions.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db import get_db
from app.models.user import User
from app.models.push_subscription import PushSubscription
from app.models.notification_setting import NotificationSetting
from app.routers.auth import get_current_user, get_user_permissions
from app.schemas.push_notification import (
    PushSubscriptionCreate,
    PushSubscriptionResponse,
    NotificationSettingUpdate,
    NotificationSettingResponse,
    NotificationSettingsListResponse,
    VAPIDPublicKeyResponse,
    TestNotificationRequest
)
from app.services.push_notification_service import push_service
from app.core.notification_types import (
    NotificationType,
    get_available_notification_types,
    get_notification_label
)
import os

router = APIRouter(prefix="/push-notifications", tags=["Push Notifications"])


@router.get("/vapid-public-key", response_model=VAPIDPublicKeyResponse)
def get_vapid_public_key():
    """
    Get VAPID public key for Web Push subscription.

    This is a public endpoint (no authentication required).
    Frontend uses this key to subscribe to push notifications.
    """
    public_key = os.getenv("VAPID_PUBLIC_KEY")
    if not public_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="VAPID public key not configured"
        )
    return {"public_key": public_key}


@router.post("/subscriptions", response_model=PushSubscriptionResponse, status_code=status.HTTP_201_CREATED)
def subscribe_to_push(
    subscription_data: PushSubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Subscribe current user to push notifications.

    Frontend should call this after user grants notification permission.
    If subscription already exists for this endpoint, updates the user_id.
    """
    # Check if subscription already exists
    existing = db.query(PushSubscription).filter(
        PushSubscription.endpoint == subscription_data.endpoint
    ).first()

    if existing:
        # Update user_id if different (subscription transferred to another user)
        if existing.user_id != current_user.id:
            existing.user_id = current_user.id
            db.commit()
            db.refresh(existing)
        return existing

    # Create new subscription
    new_subscription = PushSubscription(
        user_id=current_user.id,
        endpoint=subscription_data.endpoint,
        p256dh_key=subscription_data.keys["p256dh"],
        auth_key=subscription_data.keys["auth"],
        user_agent=subscription_data.user_agent
    )

    db.add(new_subscription)
    db.commit()
    db.refresh(new_subscription)

    return new_subscription


@router.delete("/subscriptions/{subscription_id}", status_code=status.HTTP_204_NO_CONTENT)
def unsubscribe_from_push(
    subscription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Unsubscribe from push notifications (delete subscription).

    User can only delete their own subscriptions.
    """
    subscription = db.query(PushSubscription).filter(
        PushSubscription.id == subscription_id,
        PushSubscription.user_id == current_user.id
    ).first()

    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found"
        )

    db.delete(subscription)
    db.commit()

    return None


@router.get("/subscriptions", response_model=List[PushSubscriptionResponse])
def list_my_subscriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all push subscriptions for current user"""
    subscriptions = db.query(PushSubscription).filter(
        PushSubscription.user_id == current_user.id
    ).all()

    return subscriptions


@router.get("/settings", response_model=NotificationSettingsListResponse)
def get_notification_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get notification settings for current user.

    Only shows notification types the user has permission to receive.
    Filters by user's RBAC permissions.
    """
    user_permissions = get_user_permissions(current_user)
    available_types = get_available_notification_types(user_permissions)

    settings = []

    for ntype in available_types:
        # Get existing setting or use default
        db_setting = db.query(NotificationSetting).filter(
            NotificationSetting.user_id == current_user.id,
            NotificationSetting.notification_type == ntype.value
        ).first()

        enabled = db_setting.enabled if db_setting else True  # Default: enabled

        label_info = get_notification_label(ntype)

        settings.append(NotificationSettingResponse(
            notification_type=ntype.value,
            enabled=enabled,
            label=label_info.get("title", ntype.value),
            description=label_info.get("description", "")
        ))

    return {"settings": settings}


@router.put("/settings/{notification_type}", response_model=NotificationSettingResponse)
def update_notification_setting(
    notification_type: str,
    setting_data: NotificationSettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update notification setting for a specific type.

    User can only update settings for notification types they have permission for.
    Validates against RBAC permissions.
    """
    # Validate notification type
    try:
        ntype = NotificationType(notification_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid notification type: {notification_type}"
        )

    # Check if user has permission for this notification type
    user_permissions = get_user_permissions(current_user)
    available_types = get_available_notification_types(user_permissions)

    if ntype not in available_types:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission for this notification type"
        )

    # Get or create setting
    db_setting = db.query(NotificationSetting).filter(
        NotificationSetting.user_id == current_user.id,
        NotificationSetting.notification_type == notification_type
    ).first()

    if db_setting:
        db_setting.enabled = setting_data.enabled
    else:
        db_setting = NotificationSetting(
            user_id=current_user.id,
            notification_type=notification_type,
            enabled=setting_data.enabled
        )
        db.add(db_setting)

    db.commit()
    db.refresh(db_setting)

    label_info = get_notification_label(ntype)

    return NotificationSettingResponse(
        notification_type=db_setting.notification_type,
        enabled=db_setting.enabled,
        label=label_info.get("title", notification_type),
        description=label_info.get("description", "")
    )


@router.post("/test", status_code=status.HTTP_200_OK)
def send_test_notification(
    test_data: TestNotificationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send test notification to current user (for debugging).

    Useful for testing if push notifications are working.
    """
    result = push_service.send_notification(
        db=db,
        user_id=current_user.id,
        notification_type=NotificationType.NEW_PUBLIC_CASE,  # Use any type for testing
        title=test_data.title,
        body=test_data.body,
        url=test_data.url
    )

    return {
        "message": "Test notification sent",
        "result": result
    }
