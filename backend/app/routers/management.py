from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from app.db import get_db
from app.schemas.management import (
    DirectionCreate,
    DirectionUpdate,
    DirectionDetailResponse,
)
from app.schemas.role import RoleResponse
from app.models.user import User, Role, Direction, user_roles
from app.routers.auth import require_role

router = APIRouter(prefix="/management", tags=["Management"])


# ============= ROLES MANAGEMENT =============
# Note: Redirecting to new RBAC endpoints

@router.get("/roles", response_model=List[RoleResponse])
def list_all_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Get list of all roles with user counts (admin only)"""
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


# Note: Create, Update, Delete role endpoints moved to /roles router
# Use /roles endpoints instead of /management/roles for role management


# ============= DIRECTIONS MANAGEMENT =============

@router.get("/directions", response_model=List[DirectionDetailResponse])
def list_all_directions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Get list of all directions (admin only)"""
    directions = db.query(Direction).all()

    # Add responsible_user_name to response
    result = []
    for direction in directions:
        direction_dict = {
            "id": direction.id,
            "name": direction.name,
            "description": direction.description,
            "responsible_user_id": direction.responsible_user_id,
            "responsible_user_name": direction.responsible_user.full_name if direction.responsible_user else None
        }
        result.append(DirectionDetailResponse(**direction_dict))

    return result


@router.post("/directions", response_model=DirectionDetailResponse, status_code=status.HTTP_201_CREATED)
def create_direction(
    direction_data: DirectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Create a new direction (admin only)"""
    # Check if direction with this name already exists
    existing_direction = db.query(Direction).filter(Direction.name == direction_data.name).first()
    if existing_direction:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Direction with name '{direction_data.name}' already exists"
        )

    # Validate responsible user if specified
    if direction_data.responsible_user_id:
        responsible_user = db.query(User).filter(User.id == direction_data.responsible_user_id).first()
        if not responsible_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id {direction_data.responsible_user_id} not found"
            )

    # Create new direction
    new_direction = Direction(
        name=direction_data.name,
        description=direction_data.description,
        responsible_user_id=direction_data.responsible_user_id
    )

    db.add(new_direction)
    db.commit()
    db.refresh(new_direction)

    return DirectionDetailResponse(
        id=new_direction.id,
        name=new_direction.name,
        description=new_direction.description,
        responsible_user_id=new_direction.responsible_user_id,
        responsible_user_name=new_direction.responsible_user.full_name if new_direction.responsible_user else None
    )


@router.put("/directions/{direction_id}", response_model=DirectionDetailResponse)
def update_direction(
    direction_id: int,
    direction_data: DirectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Update a direction (admin only)"""
    direction = db.query(Direction).filter(Direction.id == direction_id).first()

    if not direction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Direction with id {direction_id} not found"
        )

    update_data = direction_data.model_dump(exclude_unset=True)

    # Check if name is being changed and already exists
    if "name" in update_data:
        existing_direction = db.query(Direction).filter(
            Direction.name == update_data["name"],
            Direction.id != direction_id
        ).first()
        if existing_direction:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Direction with name '{update_data['name']}' already exists"
            )

    # Validate responsible user if being changed
    if "responsible_user_id" in update_data and update_data["responsible_user_id"]:
        responsible_user = db.query(User).filter(User.id == update_data["responsible_user_id"]).first()
        if not responsible_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id {update_data['responsible_user_id']} not found"
            )

    # Update fields
    for field, value in update_data.items():
        setattr(direction, field, value)

    db.commit()
    db.refresh(direction)

    return DirectionDetailResponse(
        id=direction.id,
        name=direction.name,
        description=direction.description,
        responsible_user_id=direction.responsible_user_id,
        responsible_user_name=direction.responsible_user.full_name if direction.responsible_user else None
    )


@router.delete("/directions/{direction_id}")
def delete_direction(
    direction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Delete a direction (admin only)"""
    direction = db.query(Direction).filter(Direction.id == direction_id).first()

    if not direction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Direction with id {direction_id} not found"
        )

    # Check if direction is assigned to any users
    if len(direction.users) > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete direction '{direction.name}' as it is assigned to {len(direction.users)} user(s)"
        )

    db.delete(direction)
    db.commit()

    return {"detail": "Direction deleted successfully"}
