"""
Pydantic schemas for Push Notification API.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime


# Push Subscription Schemas
class PushSubscriptionCreate(BaseModel):
    """Schema for creating a push subscription"""
    endpoint: str = Field(..., description="Push service endpoint URL")
    keys: Dict[str, str] = Field(..., description="Encryption keys (p256dh and auth)")
    user_agent: Optional[str] = Field(None, description="Browser user agent")

    class Config:
        json_schema_extra = {
            "example": {
                "endpoint": "https://fcm.googleapis.com/fcm/send/...",
                "keys": {
                    "p256dh": "BNcRdreAL...",
                    "auth": "tBHSV..."
                },
                "user_agent": "Mozilla/5.0..."
            }
        }


class PushSubscriptionResponse(BaseModel):
    """Schema for push subscription response"""
    id: int
    user_id: int
    endpoint: str
    created_at: datetime
    last_used_at: datetime

    class Config:
        from_attributes = True


# Notification Settings Schemas
class NotificationSettingUpdate(BaseModel):
    """Schema for updating a notification setting"""
    enabled: bool = Field(..., description="Whether notification type is enabled")


class NotificationSettingResponse(BaseModel):
    """Schema for notification setting response"""
    notification_type: str = Field(..., description="Type of notification")
    enabled: bool = Field(..., description="Whether enabled")
    label: str = Field(..., description="Display label in Ukrainian")
    description: str = Field(..., description="Description of notification type")


class NotificationSettingsListResponse(BaseModel):
    """Schema for list of notification settings"""
    settings: List[NotificationSettingResponse]


# VAPID Public Key Response
class VAPIDPublicKeyResponse(BaseModel):
    """Schema for VAPID public key response"""
    public_key: str = Field(..., description="VAPID public key for push subscription")


# Test Notification Request
class TestNotificationRequest(BaseModel):
    """Schema for test notification request"""
    title: str = Field(..., min_length=1, max_length=100, description="Notification title")
    body: str = Field(..., min_length=1, max_length=200, description="Notification body")
    url: Optional[str] = Field(None, description="URL to open on click")

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Тестове сповіщення",
                "body": "Це тестове повідомлення для перевірки push-уведомлень",
                "url": "/cases/123"
            }
        }
