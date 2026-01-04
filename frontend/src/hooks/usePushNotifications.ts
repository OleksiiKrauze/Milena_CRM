/**
 * React hook for managing push notifications
 */
import { useState, useEffect, useCallback } from 'react';
import { pushNotificationsApi, urlBase64ToUint8Array } from '@/api/push-notifications';

export type NotificationPermission = 'default' | 'granted' | 'denied';

interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  requestPermission: () => Promise<void>;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

/**
 * Hook for managing Web Push notification subscriptions
 *
 * Provides functionality to:
 * - Check if push notifications are supported
 * - Request notification permission
 * - Subscribe/unsubscribe from push notifications
 * - Track subscription state
 */
export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if push notifications are supported
  useEffect(() => {
    const supported =
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window;

    setIsSupported(supported);

    if (supported && Notification.permission) {
      setPermission(Notification.permission);
    }
  }, []);

  // Check current subscription status
  const checkSubscription = useCallback(async () => {
    if (!isSupported) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(subscription !== null);
    } catch (err) {
      console.error('Error checking subscription:', err);
    }
  }, [isSupported]);

  // Check subscription on mount
  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  /**
   * Request notification permission from the user
   */
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      setError('Push notifications are not supported in this browser');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        // Automatically subscribe after permission is granted
        await subscribe();
      } else if (result === 'denied') {
        setError('Notification permission was denied');
      }
    } catch (err) {
      console.error('Error requesting permission:', err);
      setError(err instanceof Error ? err.message : 'Failed to request permission');
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  /**
   * Subscribe to push notifications
   */
  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError('Push notifications are not supported');
      return;
    }

    if (Notification.permission !== 'granted') {
      setError('Notification permission not granted');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Wait for service worker to be ready
      const registration = await navigator.serviceWorker.ready;

      // Get existing subscription
      let subscription = await registration.pushManager.getSubscription();

      // If already subscribed, unsubscribe first to get a fresh subscription
      if (subscription) {
        await subscription.unsubscribe();
      }

      // Get VAPID public key from backend
      const vapidPublicKey = await pushNotificationsApi.getVapidPublicKey();
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      // Subscribe to push notifications
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as BufferSource,
      });

      // Extract subscription data
      const subscriptionJson = subscription.toJSON();

      if (!subscriptionJson.endpoint || !subscriptionJson.keys) {
        throw new Error('Invalid subscription data');
      }

      // Send subscription to backend
      await pushNotificationsApi.subscribe({
        endpoint: subscriptionJson.endpoint,
        keys: {
          p256dh: subscriptionJson.keys.p256dh || '',
          auth: subscriptionJson.keys.auth || '',
        },
        user_agent: navigator.userAgent,
      });

      setIsSubscribed(true);
      console.log('Successfully subscribed to push notifications');
    } catch (err) {
      console.error('Error subscribing to push notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to subscribe');
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  /**
   * Unsubscribe from push notifications
   */
  const unsubscribe = useCallback(async () => {
    if (!isSupported) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe();

        // Get all subscriptions from backend and delete them
        const subscriptions = await pushNotificationsApi.getSubscriptions();
        await Promise.all(
          subscriptions.map((sub) => pushNotificationsApi.unsubscribe(sub.id))
        );

        setIsSubscribed(false);
        console.log('Successfully unsubscribed from push notifications');
      }
    } catch (err) {
      console.error('Error unsubscribing from push notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to unsubscribe');
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    requestPermission,
    subscribe,
    unsubscribe,
  };
}
