"""
Notification types configuration with RBAC integration.

Maps notification types to required permissions and provides UI labels.
"""
from enum import Enum
from typing import Dict, List, Optional
from app.core.permissions import Resource, Action


class NotificationType(str, Enum):
    """Supported notification types"""
    NEW_PUBLIC_CASE = "new_public_case"
    FIELD_SEARCH_PARTICIPANT_ADDED = "field_search_participant_added"


# Mapping: notification_type -> required permission
# User can only receive notifications for types they have permission to access
NOTIFICATION_PERMISSIONS: Dict[NotificationType, str] = {
    NotificationType.NEW_PUBLIC_CASE: f"{Resource.CASES.value}:{Action.READ.value}",
    NotificationType.FIELD_SEARCH_PARTICIPANT_ADDED: f"{Resource.FIELD_SEARCHES.value}:{Action.READ.value}",
}


# UI Labels in Ukrainian for frontend
NOTIFICATION_LABELS: Dict[NotificationType, Dict[str, str]] = {
    NotificationType.NEW_PUBLIC_CASE: {
        "title": "Нова заявка з сайту",
        "description": "Отримувати сповіщення про нові заявки з публічного вебсайту"
    },
    NotificationType.FIELD_SEARCH_PARTICIPANT_ADDED: {
        "title": "Призначення на виїзд",
        "description": "Отримувати сповіщення коли вас додають як учасника виїзду"
    },
}


def get_required_permission(notification_type: NotificationType) -> Optional[str]:
    """
    Get required permission for a notification type.

    Args:
        notification_type: Type of notification

    Returns:
        Permission string (e.g., "cases:read") or None if not found
    """
    return NOTIFICATION_PERMISSIONS.get(notification_type)


def get_available_notification_types(user_permissions: List[str]) -> List[NotificationType]:
    """
    Filter notification types by user permissions.

    User can only subscribe to notifications they have permission to see.

    Args:
        user_permissions: List of user's permissions

    Returns:
        List of notification types user can subscribe to
    """
    available = []
    for ntype, required_perm in NOTIFICATION_PERMISSIONS.items():
        if required_perm in user_permissions:
            available.append(ntype)
    return available


def get_notification_label(notification_type: NotificationType) -> Dict[str, str]:
    """
    Get UI label and description for notification type.

    Args:
        notification_type: Type of notification

    Returns:
        Dict with 'title' and 'description' keys
    """
    return NOTIFICATION_LABELS.get(notification_type, {
        "title": notification_type.value,
        "description": ""
    })
