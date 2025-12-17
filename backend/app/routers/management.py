from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db import get_db
from app.schemas.management import (
    RoleCreate,
    RoleUpdate,
    RoleDetailResponse,
    DirectionCreate,
    DirectionUpdate,
    DirectionDetailResponse,
)
from app.models.user import User, Role, Direction
from app.routers.auth import require_role

router = APIRouter(prefix="/management", tags=["Management"])


# ============= ROLES MANAGEMENT =============

@router.get("/roles", response_model=List[RoleDetailResponse])
def list_all_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Get list of all roles with hierarchy (admin only)"""
    roles = db.query(Role).all()

    # Add parent_role_name to response
    result = []
    for role in roles:
        role_dict = {
            "id": role.id,
            "name": role.name,
            "description": role.description,
            "parent_role_id": role.parent_role_id,
            "parent_role_name": role.parent_role.name if role.parent_role else None
        }
        result.append(RoleDetailResponse(**role_dict))

    return result


@router.post("/roles", response_model=RoleDetailResponse, status_code=status.HTTP_201_CREATED)
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
            detail=f"Role with name '{role_data.name}' already exists"
        )

    # Validate parent role if specified
    if role_data.parent_role_id:
        parent_role = db.query(Role).filter(Role.id == role_data.parent_role_id).first()
        if not parent_role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent role with id {role_data.parent_role_id} not found"
            )

    # Create new role
    new_role = Role(
        name=role_data.name,
        description=role_data.description,
        parent_role_id=role_data.parent_role_id
    )

    db.add(new_role)
    db.commit()
    db.refresh(new_role)

    return RoleDetailResponse(
        id=new_role.id,
        name=new_role.name,
        description=new_role.description,
        parent_role_id=new_role.parent_role_id,
        parent_role_name=new_role.parent_role.name if new_role.parent_role else None
    )


@router.put("/roles/{role_id}", response_model=RoleDetailResponse)
def update_role(
    role_id: int,
    role_data: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Update a role (admin only)"""
    role = db.query(Role).filter(Role.id == role_id).first()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with id {role_id} not found"
        )

    # Prevent circular hierarchy
    if role_data.parent_role_id == role_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role cannot be its own parent"
        )

    update_data = role_data.model_dump(exclude_unset=True)

    # Check if name is being changed and already exists
    if "name" in update_data:
        existing_role = db.query(Role).filter(
            Role.name == update_data["name"],
            Role.id != role_id
        ).first()
        if existing_role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role with name '{update_data['name']}' already exists"
            )

    # Validate parent role if being changed
    if "parent_role_id" in update_data and update_data["parent_role_id"]:
        parent_role = db.query(Role).filter(Role.id == update_data["parent_role_id"]).first()
        if not parent_role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent role with id {update_data['parent_role_id']} not found"
            )

    # Update fields
    for field, value in update_data.items():
        setattr(role, field, value)

    db.commit()
    db.refresh(role)

    return RoleDetailResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        parent_role_id=role.parent_role_id,
        parent_role_name=role.parent_role.name if role.parent_role else None
    )


@router.delete("/roles/{role_id}")
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Delete a role (admin only)"""
    role = db.query(Role).filter(Role.id == role_id).first()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with id {role_id} not found"
        )

    # Prevent deleting admin role
    if role.name == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete admin role"
        )

    # Check if role is assigned to any users
    if len(role.users) > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete role '{role.name}' as it is assigned to {len(role.users)} user(s)"
        )

    # Check if role has child roles
    child_roles = db.query(Role).filter(Role.parent_role_id == role_id).all()
    if len(child_roles) > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete role '{role.name}' as it has {len(child_roles)} child role(s)"
        )

    db.delete(role)
    db.commit()

    return {"detail": "Role deleted successfully"}


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
