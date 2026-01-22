from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import Optional
from app.db import get_db
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationListResponse,
)
from app.models.organization import Organization, OrganizationType
from app.models.user import User
from app.routers.auth import require_permission

router = APIRouter(prefix="/organizations", tags=["Organizations"])


@router.post("/", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
def create_organization(
    organization_data: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("organizations:create"))
):
    """Create a new organization"""
    # Parse type enum
    try:
        org_type = OrganizationType[organization_data.type]
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid organization type: {organization_data.type}. Valid types: {', '.join([t.value for t in OrganizationType])}"
        )

    db_organization = Organization(
        created_by_user_id=current_user.id,
        name=organization_data.name,
        type=org_type,
        region=organization_data.region,
        city=organization_data.city,
        address=organization_data.address,
        contact_info=organization_data.contact_info,
        notes=organization_data.notes,
    )

    db.add(db_organization)
    db.commit()
    db.refresh(db_organization)

    return db_organization


@router.get("/", response_model=OrganizationListResponse)
def list_organizations(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Max number of records to return"),
    type_filter: Optional[str] = Query(None, description="Filter by organization type"),
    region_filter: Optional[str] = Query(None, description="Filter by region"),
    search_query: Optional[str] = Query(None, description="Search by name or city"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("organizations:read"))
):
    """Get list of organizations with pagination and filters"""
    query = db.query(Organization).options(
        joinedload(Organization.created_by),
        joinedload(Organization.updated_by)
    )

    # Filter by type
    if type_filter:
        try:
            type_enum = OrganizationType[type_filter]
            query = query.filter(Organization.type == type_enum)
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid organization type: {type_filter}"
            )

    # Filter by region
    if region_filter:
        query = query.filter(Organization.region == region_filter)

    # Search by name or city
    if search_query:
        search_term = f"%{search_query}%"
        query = query.filter(
            or_(
                Organization.name.ilike(search_term),
                Organization.city.ilike(search_term)
            )
        )

    total = query.count()
    organizations = query.order_by(Organization.name).offset(skip).limit(limit).all()

    return {"total": total, "organizations": organizations}


@router.get("/{organization_id}", response_model=OrganizationResponse)
def get_organization(
    organization_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("organizations:read"))
):
    """Get organization by ID"""
    db_organization = db.query(Organization).options(
        joinedload(Organization.created_by),
        joinedload(Organization.updated_by)
    ).filter(Organization.id == organization_id).first()

    if not db_organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization with id {organization_id} not found"
        )

    return db_organization


@router.put("/{organization_id}", response_model=OrganizationResponse)
def update_organization(
    organization_id: int,
    organization_data: OrganizationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("organizations:update"))
):
    """Update organization by ID"""
    db_organization = db.query(Organization).filter(Organization.id == organization_id).first()

    if not db_organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization with id {organization_id} not found"
        )

    # Update fields if provided
    update_data = organization_data.model_dump(exclude_unset=True)

    # Handle type separately to convert string to enum
    if "type" in update_data:
        try:
            update_data["type"] = OrganizationType[update_data["type"]]
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid organization type: {update_data['type']}"
            )

    for field, value in update_data.items():
        setattr(db_organization, field, value)

    # Track who updated
    db_organization.updated_by_user_id = current_user.id

    db.commit()
    db.refresh(db_organization)

    return db_organization


@router.delete("/{organization_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organization(
    organization_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("organizations:delete"))
):
    """Delete organization by ID"""
    db_organization = db.query(Organization).filter(Organization.id == organization_id).first()

    if not db_organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization with id {organization_id} not found"
        )

    db.delete(db_organization)
    db.commit()

    return None
