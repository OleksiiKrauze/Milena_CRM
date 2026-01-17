from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy import func
from app.db import get_db
from app.schemas.role import RoleCreate, RoleUpdate, RoleResponse, PermissionsListResponse
from app.models.user import Role, User, user_roles
from app.routers.auth import get_current_user, require_role, require_permission
from app.core.permissions import get_all_permissions, get_permission_info, get_permissions_by_resource

router = APIRouter(prefix="/roles", tags=["Roles"])


@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    role_data: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Create a new role (admin only)"""
    # Check if role with this name already exists
    existing_role = db.query(Role).filter(Role.name == role_data.name).first()
    if existing_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{role_data.name}' already exists"
        )

    # Validate permissions
    all_permissions = get_all_permissions()
    for perm in role_data.permissions:
        if perm not in all_permissions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid permission: {perm}"
            )

    db_role = Role(
        name=role_data.name,
        display_name=role_data.display_name,
        description=role_data.description,
        permissions=role_data.permissions,
        is_system=False  # User-created roles are never system roles
    )

    db.add(db_role)
    db.commit()
    db.refresh(db_role)

    # Add user_count
    user_count = db.query(func.count(user_roles.c.user_id)).filter(
        user_roles.c.role_id == db_role.id
    ).scalar()

    response = RoleResponse.model_validate(db_role)
    response.user_count = user_count

    return response


@router.get("/", response_model=List[RoleResponse])
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("roles:read"))
):
    """Get list of all roles with user counts"""
    roles = db.query(Role).order_by(Role.name).all()

    # Add user_count for each role
    response = []
    for role in roles:
        user_count = db.query(func.count(user_roles.c.user_id)).filter(
            user_roles.c.role_id == role.id
        ).scalar()

        role_response = RoleResponse.model_validate(role)
        role_response.user_count = user_count
        response.append(role_response)

    return response


@router.get("/{role_id}", response_model=RoleResponse)
def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("roles:read"))
):
    """Get role by ID with user count"""
    db_role = db.query(Role).filter(Role.id == role_id).first()

    if not db_role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with id {role_id} not found"
        )

    # Add user_count
    user_count = db.query(func.count(user_roles.c.user_id)).filter(
        user_roles.c.role_id == db_role.id
    ).scalar()

    response = RoleResponse.model_validate(db_role)
    response.user_count = user_count

    return response


@router.put("/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: int,
    role_data: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Update role by ID (admin only)"""
    db_role = db.query(Role).filter(Role.id == role_id).first()

    if not db_role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with id {role_id} not found"
        )

    # Prevent modifying system role name
    if db_role.is_system and role_data.name and role_data.name != db_role.name:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify system role name"
        )

    # Check if new name conflicts with existing role
    if role_data.name and role_data.name != db_role.name:
        existing_role = db.query(Role).filter(Role.name == role_data.name).first()
        if existing_role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role '{role_data.name}' already exists"
            )

    # Validate permissions if provided
    if role_data.permissions is not None:
        all_permissions = get_all_permissions()
        for perm in role_data.permissions:
            if perm not in all_permissions:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid permission: {perm}"
                )

    # Update fields if provided
    update_data = role_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_role, field, value)

    db.commit()
    db.refresh(db_role)

    # Add user_count
    user_count = db.query(func.count(user_roles.c.user_id)).filter(
        user_roles.c.role_id == db_role.id
    ).scalar()

    response = RoleResponse.model_validate(db_role)
    response.user_count = user_count

    return response


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Delete role by ID (admin only). System roles cannot be deleted."""
    db_role = db.query(Role).filter(Role.id == role_id).first()

    if not db_role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with id {role_id} not found"
        )

    # Prevent deleting system roles
    if db_role.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cannot delete system role '{db_role.name}'"
        )

    # Check if role has users
    user_count = db.query(func.count(user_roles.c.user_id)).filter(
        user_roles.c.role_id == role_id
    ).scalar()

    if user_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete role '{db_role.name}': {user_count} user(s) assigned to this role"
        )

    db.delete(db_role)
    db.commit()

    return None


@router.get("/permissions/list", response_model=PermissionsListResponse)
def get_permissions_list(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("roles:read"))
):
    """
    Get all available permissions for UI.
    Returns permissions grouped by resource with labels.
    """
    return PermissionsListResponse(
        all_permissions=get_all_permissions(),
        permissions_info=get_permission_info(),
        by_resource=get_permissions_by_resource()
    )
