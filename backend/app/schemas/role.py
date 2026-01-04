from pydantic import BaseModel, Field
from typing import Optional, List


class RoleCreate(BaseModel):
    """Schema for creating a role"""
    name: str = Field(..., min_length=1, max_length=50, description="Unique role identifier (e.g., 'coordinator')")
    display_name: str = Field(..., min_length=1, max_length=100, description="Display name (e.g., 'Координатор')")
    description: Optional[str] = Field(None, max_length=500)
    permissions: List[str] = Field(default_factory=list, description="List of permission codes (e.g., ['cases:read', 'cases:create'])")


class RoleUpdate(BaseModel):
    """Schema for updating a role"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    permissions: Optional[List[str]] = None


class RoleResponse(BaseModel):
    """Schema for role response"""
    id: int
    name: str
    display_name: str
    description: Optional[str]
    permissions: List[str]
    is_system: bool
    user_count: Optional[int] = Field(None, description="Number of users with this role")

    model_config = {"from_attributes": True}


class PermissionInfo(BaseModel):
    """Information about a single permission"""
    code: str = Field(..., description="Permission code (e.g., 'cases:read')")
    resource: str = Field(..., description="Resource name (e.g., 'cases')")
    resource_label: str = Field(..., description="Resource display label (e.g., 'Заявки')")
    action: str = Field(..., description="Action name (e.g., 'read')")
    action_label: str = Field(..., description="Action display label (e.g., 'Перегляд')")


class ResourcePermissions(BaseModel):
    """Permissions grouped by resource"""
    label: str = Field(..., description="Resource display label")
    permissions: List[dict] = Field(..., description="List of permissions for this resource")


class PermissionsListResponse(BaseModel):
    """Response with all available permissions"""
    all_permissions: List[str] = Field(..., description="List of all permission codes")
    permissions_info: List[PermissionInfo] = Field(..., description="Detailed permission info")
    by_resource: dict = Field(..., description="Permissions grouped by resource")
