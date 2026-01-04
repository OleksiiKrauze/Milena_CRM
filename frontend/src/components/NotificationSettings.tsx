/**
 * Notification Settings Component
 *
 * Allows users to manage push notification preferences.
 * Shows only notification types that the user has permission to receive (RBAC filtering).
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { pushNotificationsApi } from '@/api/push-notifications';
import { Card, CardHeader, CardTitle, CardContent, Button, Loading } from '@/components/ui';

export function NotificationSettings() {
  const queryClient = useQueryClient();
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading: isPushLoading,
    error: pushError,
    requestPermission,
    unsubscribe,
  } = usePushNotifications();

  // Fetch notification settings from backend
  const { data: settingsData, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: pushNotificationsApi.getSettings,
    enabled: isSubscribed, // Only fetch if subscribed
  });

  // Mutation to update notification setting
  const updateSettingMutation = useMutation({
    mutationFn: ({ notificationType, enabled }: { notificationType: string; enabled: boolean }) =>
      pushNotificationsApi.updateSetting(notificationType, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    },
  });

  const handleToggleSetting = async (notificationType: string, currentEnabled: boolean) => {
    await updateSettingMutation.mutateAsync({
      notificationType,
      enabled: !currentEnabled,
    });
  };

  const handleUnsubscribe = async () => {
    await unsubscribe();
    queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
  };

  // Show "not supported" message
  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Push-сповіщення</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                Push-сповіщення не підтримуються
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                Ваш браузер не підтримує push-сповіщення. Спробуйте використати сучасний браузер
                (Chrome, Firefox, Safari 16.4+).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show "permission denied" message
  if (permission === 'denied') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Push-сповіщення</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Дозвіл відхилено</p>
              <p className="text-sm text-red-700 mt-1">
                Ви відхилили дозвіл на сповіщення. Щоб увімкнути їх, перейдіть в налаштування
                браузера та дозвольте сповіщення для цього сайту.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error if any
  if (pushError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Push-сповіщення</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{pushError}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show loading state
  if (isPushLoading || isSettingsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Push-сповіщення</CardTitle>
        </CardHeader>
        <CardContent>
          <Loading text="Завантаження..." />
        </CardContent>
      </Card>
    );
  }

  // Not subscribed - show enable button
  if (!isSubscribed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Push-сповіщення</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Увімкніть push-сповіщення, щоб отримувати миттєві повідомлення про нові заявки,
              призначення на виїзди та інші важливі події.
            </p>
            <Button fullWidth variant="primary" onClick={requestPermission}>
              <Bell className="h-5 w-5 mr-2" />
              Увімкнути сповіщення
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Subscribed - show settings
  return (
    <Card>
      <CardHeader>
        <CardTitle>Push-сповіщення</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Success message */}
          {showSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex gap-2 items-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="text-sm text-green-800">Налаштування збережено!</p>
            </div>
          )}

          {/* Status */}
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex gap-2 items-center">
            <Bell className="h-5 w-5 text-green-600" />
            <p className="text-sm text-green-800 font-medium">Сповіщення увімкнено</p>
          </div>

          {/* Notification types list */}
          {settingsData && settingsData.settings.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Типи сповіщень:</p>
              {settingsData.settings.map((setting) => (
                <div
                  key={setting.notification_type}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{setting.label}</p>
                      {setting.description && (
                        <p className="text-sm text-gray-600 mt-1">{setting.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleSetting(setting.notification_type, setting.enabled)}
                      disabled={updateSettingMutation.isPending}
                      className={`
                        relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${setting.enabled ? 'bg-primary-600' : 'bg-gray-300'}
                      `}
                      aria-label={`Toggle ${setting.label}`}
                    >
                      <span
                        className={`
                          inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                          ${setting.enabled ? 'translate-x-6' : 'translate-x-1'}
                        `}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No notification types available */}
          {settingsData && settingsData.settings.length === 0 && (
            <p className="text-sm text-gray-600">
              У вас немає доступних типів сповіщень на основі ваших ролей.
            </p>
          )}

          {/* Disable all button */}
          <Button
            fullWidth
            variant="secondary"
            onClick={handleUnsubscribe}
            disabled={isPushLoading}
          >
            <BellOff className="h-5 w-5 mr-2" />
            Вимкнути всі сповіщення
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
