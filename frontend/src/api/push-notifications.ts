/**
 * API client for Push Notifications endpoints
 */
import { api } from '@/api/client';

export interface PushSubscriptionCreate {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  user_agent?: string;
}

export interface PushSubscriptionResponse {
  id: number;
  user_id: number;
  endpoint: string;
  created_at: string;
  last_used_at: string;
}

export interface NotificationSettingResponse {
  notification_type: string;
  enabled: boolean;
  label: string;
  description: string;
}

export interface NotificationSettingsListResponse {
  settings: NotificationSettingResponse[];
}

export interface VAPIDPublicKeyResponse {
  public_key: string;
}

export interface TestNotificationRequest {
  title: string;
  body: string;
  url?: string;
}

/**
 * Push Notifications API Client
 */
export const pushNotificationsApi = {
  /**
   * Get VAPID public key for push subscription (no auth required)
   */
  getVapidPublicKey: async (): Promise<string> => {
    const response = await api.get<VAPIDPublicKeyResponse>(
      '/push-notifications/vapid-public-key'
    );
    return response.data.public_key;
  },

  /**
   * Subscribe to push notifications
   */
  subscribe: async (subscriptionData: PushSubscriptionCreate): Promise<PushSubscriptionResponse> => {
    const response = await api.post<PushSubscriptionResponse>(
      '/push-notifications/subscriptions',
      subscriptionData
    );
    return response.data;
  },

  /**
   * Unsubscribe from push notifications
   */
  unsubscribe: async (subscriptionId: number): Promise<void> => {
    await api.delete(`/push-notifications/subscriptions/${subscriptionId}`);
  },

  /**
   * Get all subscriptions for current user
   */
  getSubscriptions: async (): Promise<PushSubscriptionResponse[]> => {
    const response = await api.get<PushSubscriptionResponse[]>(
      '/push-notifications/subscriptions'
    );
    return response.data;
  },

  /**
   * Get notification settings for current user (filtered by permissions)
   */
  getSettings: async (): Promise<NotificationSettingsListResponse> => {
    const response = await api.get<NotificationSettingsListResponse>(
      '/push-notifications/settings'
    );
    return response.data;
  },

  /**
   * Update notification setting for a specific type
   */
  updateSetting: async (notificationType: string, enabled: boolean): Promise<NotificationSettingResponse> => {
    const response = await api.put<NotificationSettingResponse>(
      `/push-notifications/settings/${notificationType}`,
      { enabled }
    );
    return response.data;
  },

  /**
   * Send test notification to current user
   */
  sendTestNotification: async (data: TestNotificationRequest): Promise<{ message: string; result: any }> => {
    const response = await api.post(
      '/push-notifications/test',
      data
    );
    return response.data;
  },
};

/**
 * Helper function to convert base64 VAPID key to Uint8Array
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Helper function to convert ArrayBuffer to base64
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
