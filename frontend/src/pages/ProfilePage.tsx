import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api/auth';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/store/authStore';
import { hasPermission } from '@/utils/permissions';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Badge, Button, Loading, Input } from '@/components/ui';
import { NotificationSettings } from '@/components/NotificationSettings';
import { formatPhone } from '@/utils/formatters';
import { LogOut, Mail, Phone, MapPin, Lock, Settings } from 'lucide-react';

export function ProfilePage() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user-profile'],
    queryFn: authApi.me,
  });

  const changePasswordMutation = useMutation({
    mutationFn: usersApi.changePassword,
    onSuccess: () => {
      setPasswordSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(null);
      setTimeout(() => {
        setPasswordSuccess(false);
        setShowPasswordForm(false);
      }, 2000);
    },
    onError: (error: any) => {
      setPasswordError(error.message || 'Помилка зміни пароля');
    },
  });

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError('Новий пароль має містити мінімум 6 символів');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Паролі не співпадають');
      return;
    }

    changePasswordMutation.mutate({
      old_password: oldPassword,
      new_password: newPassword,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Профіль" />
        <Container className="py-6">
          <Loading text="Завантаження профілю..." />
        </Container>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Профіль" />
        <Container className="py-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">Помилка завантаження профілю</p>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-nav">
      <Header title="Профіль" />

      <Container className="py-6">
        <div className="space-y-4">
          {/* User Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle>{user.full_name}</CardTitle>
                  <div className="mt-2">
                    <Badge
                      variant={
                        user.status === 'active'
                          ? 'success'
                          : user.status === 'pending'
                          ? 'warning'
                          : 'danger'
                      }
                    >
                      {user.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 text-gray-700">
                <Mail className="h-5 w-5 text-gray-400" />
                <a href={`mailto:${user.email}`} className="hover:text-primary-600">
                  {user.email}
                </a>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <Phone className="h-5 w-5 text-gray-400" />
                <a href={`tel:${user.phone}`} className="hover:text-primary-600">
                  {formatPhone(user.phone)}
                </a>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <MapPin className="h-5 w-5 text-gray-400" />
                <span>{user.city}</span>
              </div>
            </CardContent>
          </Card>

          {/* Roles */}
          <Card>
            <CardHeader>
              <CardTitle>Ролі</CardTitle>
            </CardHeader>
            <CardContent>
              {user.roles.length === 0 ? (
                <p className="text-sm text-gray-600">Ролі не призначено</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {user.roles.map((role) => (
                    <Badge key={role.id} variant="info">
                      {role.name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Directions */}
          <Card>
            <CardHeader>
              <CardTitle>Напрямки роботи</CardTitle>
            </CardHeader>
            <CardContent>
              {user.directions.length === 0 ? (
                <p className="text-sm text-gray-600">Напрямки не призначено</p>
              ) : (
                <div className="space-y-2">
                  {user.directions.map((direction) => (
                    <div
                      key={direction.id}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <p className="font-medium text-gray-900">{direction.name}</p>
                      {direction.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {direction.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Settings Button */}
          {hasPermission(user, 'settings:read') && (
            <Button
              fullWidth
              variant="outline"
              onClick={() => navigate('/settings')}
            >
              <Settings className="h-5 w-5 mr-2" />
              Налаштування системи
            </Button>
          )}

          {/* Push Notifications */}
          <NotificationSettings />

          {/* Comment */}
          {user.comment && (
            <Card>
              <CardHeader>
                <CardTitle>Коментар</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{user.comment}</p>
              </CardContent>
            </Card>
          )}

          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle>Зміна пароля</CardTitle>
            </CardHeader>
            <CardContent>
              {!showPasswordForm ? (
                <Button
                  fullWidth
                  variant="secondary"
                  onClick={() => setShowPasswordForm(true)}
                >
                  <Lock className="h-5 w-5 mr-2" />
                  Змінити пароль
                </Button>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <Input
                    label="Старий пароль"
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    required
                  />
                  <Input
                    label="Новий пароль"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <Input
                    label="Підтвердження нового пароля"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />

                  {passwordError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">{passwordError}</p>
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">Пароль успішно змінено!</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Button
                      type="submit"
                      fullWidth
                      loading={changePasswordMutation.isPending}
                    >
                      Зберегти новий пароль
                    </Button>
                    <Button
                      type="button"
                      fullWidth
                      variant="secondary"
                      onClick={() => {
                        setShowPasswordForm(false);
                        setOldPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                        setPasswordError(null);
                      }}
                      disabled={changePasswordMutation.isPending}
                    >
                      Скасувати
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Logout Button */}
          <Button
            variant="danger"
            fullWidth
            onClick={handleLogout}
            className="mt-6"
          >
            <LogOut className="h-5 w-5 mr-2" />
            Вийти
          </Button>
        </div>
      </Container>
    </div>
  );
}
