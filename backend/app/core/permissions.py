"""
Permissions and RBAC (Role-Based Access Control) system
"""
from enum import Enum
from typing import List, Set


class Resource(str, Enum):
    """System resources (modules)"""
    CASES = "cases"
    SEARCHES = "searches"
    FIELD_SEARCHES = "field_searches"
    ORIENTATIONS = "orientations"
    DISTRIBUTIONS = "distributions"
    EVENTS = "events"
    USERS = "users"
    ROLES = "roles"
    SETTINGS = "settings"
    ORGANIZATIONS = "organizations"


class Action(str, Enum):
    """Actions that can be performed on resources"""
    READ = "read"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


class Permission:
    """
    Permission in format: resource:action
    Example: cases:read, cases:create, searches:update
    """

    def __init__(self, resource: Resource, action: Action):
        self.resource = resource
        self.action = action
        self.code = f"{resource.value}:{action.value}"

    def __str__(self):
        return self.code

    def __repr__(self):
        return f"Permission({self.code})"

    @staticmethod
    def from_string(permission_str: str) -> "Permission":
        """Create Permission from string like 'cases:read'"""
        resource_str, action_str = permission_str.split(":")
        return Permission(Resource(resource_str), Action(action_str))


# Human-readable labels for UI
RESOURCE_LABELS = {
    Resource.CASES: "Заявки",
    Resource.SEARCHES: "Пошуки",
    Resource.FIELD_SEARCHES: "Виїзди на місцевість",
    Resource.ORIENTATIONS: "Ориентування",
    Resource.DISTRIBUTIONS: "Розповсюдження",
    Resource.EVENTS: "Події",
    Resource.USERS: "Користувачі",
    Resource.ROLES: "Ролі",
    Resource.SETTINGS: "Налаштування",
    Resource.ORGANIZATIONS: "Організації",
}

ACTION_LABELS = {
    Action.READ: "Перегляд",
    Action.CREATE: "Створення",
    Action.UPDATE: "Редагування",
    Action.DELETE: "Видалення",
}


def get_all_permissions() -> List[str]:
    """Get list of all possible permissions"""
    permissions = []
    for resource in Resource:
        for action in Action:
            permissions.append(f"{resource.value}:{action.value}")
    return permissions


def get_permission_info() -> List[dict]:
    """
    Get all permissions with metadata for UI
    Returns list of dicts with permission info
    """
    permissions = []
    for resource in Resource:
        for action in Action:
            permissions.append({
                "code": f"{resource.value}:{action.value}",
                "resource": resource.value,
                "resource_label": RESOURCE_LABELS[resource],
                "action": action.value,
                "action_label": ACTION_LABELS[action],
            })
    return permissions


def get_permissions_by_resource() -> dict:
    """
    Get permissions grouped by resource for UI
    Returns dict: {resource: [{action, code, label}, ...]}
    """
    result = {}
    for resource in Resource:
        result[resource.value] = {
            "label": RESOURCE_LABELS[resource],
            "permissions": []
        }
        for action in Action:
            result[resource.value]["permissions"].append({
                "action": action.value,
                "action_label": ACTION_LABELS[action],
                "code": f"{resource.value}:{action.value}",
            })
    return result


# Predefined roles with their permissions
PREDEFINED_ROLES = {
    "admin": {
        "name": "admin",
        "display_name": "Адміністратор",
        "description": "Повний доступ до всіх модулів системи",
        "permissions": get_all_permissions(),
        "is_system": True,
    },
    "coordinator": {
        "name": "coordinator",
        "display_name": "Координатор",
        "description": "Повний доступ до заявок, пошуків, виїздів. Перегляд користувачів та налаштувань",
        "permissions": [
            # Full access to cases, searches, field searches
            "cases:read", "cases:create", "cases:update", "cases:delete",
            "searches:read", "searches:create", "searches:update", "searches:delete",
            "field_searches:read", "field_searches:create", "field_searches:update", "field_searches:delete",
            "orientations:read", "orientations:create", "orientations:update", "orientations:delete",
            "distributions:read", "distributions:create", "distributions:update", "distributions:delete",
            "events:read", "events:create", "events:update", "events:delete",
            "organizations:read", "organizations:create", "organizations:update", "organizations:delete",
            # Read-only for users and settings
            "users:read",
            "settings:read",
        ],
        "is_system": False,
    },
    "operator": {
        "name": "operator",
        "display_name": "Оператор",
        "description": "Створення та редагування заявок. Перегляд пошуків та виїздів",
        "permissions": [
            # Cases: create and update
            "cases:read", "cases:create", "cases:update",
            # Searches and field searches: read only
            "searches:read",
            "field_searches:read",
            "orientations:read",
            "distributions:read",
            "events:read",
            "organizations:read",
        ],
        "is_system": False,
    },
    "viewer": {
        "name": "viewer",
        "display_name": "Спостерігач",
        "description": "Тільки перегляд всіх модулів без можливості змін",
        "permissions": [
            "cases:read",
            "searches:read",
            "field_searches:read",
            "orientations:read",
            "distributions:read",
            "events:read",
            "users:read",
            "settings:read",
        ],
        "is_system": False,
    },
}


def has_permission(user_permissions: List[str], required_permission: str) -> bool:
    """
    Check if user has required permission

    Args:
        user_permissions: List of user's permission codes
        required_permission: Required permission code (e.g., "cases:read")

    Returns:
        True if user has permission, False otherwise
    """
    return required_permission in user_permissions


def has_any_permission(user_permissions: List[str], required_permissions: List[str]) -> bool:
    """Check if user has at least one of the required permissions"""
    return any(perm in user_permissions for perm in required_permissions)


def has_all_permissions(user_permissions: List[str], required_permissions: List[str]) -> bool:
    """Check if user has all required permissions"""
    return all(perm in user_permissions for perm in required_permissions)
