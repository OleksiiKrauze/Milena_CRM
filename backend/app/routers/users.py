from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
from app.db import get_db
from app.schemas.auth import UserResponse, UserBrief
from app.schemas.user import (
    AssignRolesRequest,
    AssignDirectionsRequest,
    UserUpdate,
    UsersListResponse,
    UserListResponse,
    RoleResponse,
    DirectionResponse,
)
from app.models.user import User, Role, Direction, UserStatus
from app.routers.auth import get_current_user, require_role, require_permission

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/roles", response_model=List[RoleResponse])
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Get list of all roles (admin only)"""
    roles = db.query(Role).all()
    return roles


@router.get("/directions", response_model=List[DirectionResponse])
def list_directions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Get list of all directions (admin only)"""
    directions = db.query(Direction).all()
    return directions


@router.get("/brief", response_model=List[UserBrief])
def list_users_brief(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users:read"))
):
    """Get brief list of active users (id and full_name only) - available to all authenticated users"""
    users = db.query(User).filter(User.status == UserStatus.active).all()
    return users


@router.get("/", response_model=UsersListResponse)
def list_users(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Max number of records to return"),
    status_filter: str = Query(None, description="Filter by status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Get list of users with pagination (admin only)"""
    query = db.query(User)

    if status_filter:
        query = query.filter(User.status == status_filter)

    total = query.count()
    users = query.offset(skip).limit(limit).all()
    return UsersListResponse(users=users, total=total)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users:read"))
):
    """Get user by ID"""
    db_user = db.query(User).filter(User.id == user_id).first()

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found"
        )

    return db_user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Update user information (admin only)"""
    db_user = db.query(User).filter(User.id == user_id).first()

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found"
        )

    # Update fields if provided
    update_data = user_data.model_dump(exclude_unset=True)

    # Handle role_ids separately
    role_ids = update_data.pop("role_ids", None)
    if role_ids is not None:
        roles = db.query(Role).filter(Role.id.in_(role_ids)).all()
        if len(roles) != len(role_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more role IDs are invalid"
            )
        db_user.roles = roles

    # Handle direction_ids separately
    direction_ids = update_data.pop("direction_ids", None)
    if direction_ids is not None:
        directions = db.query(Direction).filter(Direction.id.in_(direction_ids)).all()
        if len(directions) != len(direction_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more direction IDs are invalid"
            )
        db_user.directions = directions

    # Handle status separately to convert string to enum
    if "status" in update_data:
        try:
            update_data["status"] = UserStatus[update_data["status"]]
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid user status: {update_data['status']}"
            )

    # Update remaining fields
    for field, value in update_data.items():
        setattr(db_user, field, value)

    db.commit()
    db.refresh(db_user)

    return db_user


@router.post("/{user_id}/roles", response_model=UserResponse)
def assign_roles_to_user(
    user_id: int,
    roles_data: AssignRolesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Assign roles to a user (admin only)"""
    db_user = db.query(User).filter(User.id == user_id).first()

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found"
        )

    # Verify all role IDs exist
    roles = db.query(Role).filter(Role.id.in_(roles_data.role_ids)).all()
    if len(roles) != len(roles_data.role_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more role IDs are invalid"
        )

    # Replace existing roles with new ones
    db_user.roles = roles
    db.commit()
    db.refresh(db_user)

    return db_user


@router.delete("/{user_id}/roles/{role_id}", response_model=UserResponse)
def remove_role_from_user(
    user_id: int,
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Remove a role from a user (admin only)"""
    db_user = db.query(User).filter(User.id == user_id).first()

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found"
        )

    # Find and remove the role
    role_to_remove = None
    for role in db_user.roles:
        if role.id == role_id:
            role_to_remove = role
            break

    if not role_to_remove:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User does not have role with id {role_id}"
        )

    db_user.roles.remove(role_to_remove)
    db.commit()
    db.refresh(db_user)

    return db_user


@router.post("/{user_id}/directions", response_model=UserResponse)
def assign_directions_to_user(
    user_id: int,
    directions_data: AssignDirectionsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Assign directions to a user (admin only)"""
    db_user = db.query(User).filter(User.id == user_id).first()

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found"
        )

    # Verify all direction IDs exist
    directions = db.query(Direction).filter(Direction.id.in_(directions_data.direction_ids)).all()
    if len(directions) != len(directions_data.direction_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more direction IDs are invalid"
        )

    # Replace existing directions with new ones
    db_user.directions = directions
    db.commit()
    db.refresh(db_user)

    return db_user


@router.delete("/{user_id}/directions/{direction_id}", response_model=UserResponse)
def remove_direction_from_user(
    user_id: int,
    direction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Remove a direction from a user (admin only)"""
    db_user = db.query(User).filter(User.id == user_id).first()

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found"
        )

    # Find and remove the direction
    direction_to_remove = None
    for direction in db_user.directions:
        if direction.id == direction_id:
            direction_to_remove = direction
            break

    if not direction_to_remove:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User does not have direction with id {direction_id}"
        )

    db_user.directions.remove(direction_to_remove)
    db.commit()
    db.refresh(db_user)

    return db_user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Delete a user (admin only)"""
    # Prevent self-deletion
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    db_user = db.query(User).filter(User.id == user_id).first()

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found"
        )

    db.delete(db_user)
    db.commit()

    return {"detail": "User deleted successfully"}
