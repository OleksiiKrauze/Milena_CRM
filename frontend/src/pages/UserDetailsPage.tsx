import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { usersApi } from '@/api/users';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Badge, Loading, Button, getStatusBadgeVariant } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';

export function UserDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  const [editMode, setEditMode] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  const [selectedDirections, setSelectedDirections] = useState<number[]>([]);

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => usersApi.get(Number(id)),
    enabled: !!id,
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: usersApi.listRoles,
  });

  const { data: directions } = useQuery({
    queryKey: ['directions'],
    queryFn: usersApi.listDirections,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { status?: string; comment?: string; role_ids?: number[]; direction_ids?: number[] }) =>
      usersApi.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditMode(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => usersApi.delete(Number(id)),
    onSuccess: () => {
      navigate('/users');
    },
  });

  const handleEdit = () => {
    if (user) {
      setStatus(user.status);
      setComment(user.comment || '');
      setSelectedRoles(user.roles.map((r) => r.id));
      setSelectedDirections(user.directions.map((d) => d.id));
      setEditMode(true);
    }
  };

  const handleSave = () => {
    updateMutation.mutate({
      status,
      comment: comment || undefined,
      role_ids: selectedRoles,
      direction_ids: selectedDirections,
    });
  };

  const handleDelete = () => {
    if (window.confirm('Ви впевнені, що хочете видалити цього користувача?')) {
      deleteMutation.mutate();
    }
  };

  const toggleRole = (roleId: number) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const toggleDirection = (directionId: number) => {
    setSelectedDirections((prev) =>
      prev.includes(directionId) ? prev.filter((id) => id !== directionId) : [...prev, directionId]
    );
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: 'Активний',
      inactive: 'Неактивний',
      pending: 'На розгляді',
    };
    return labels[status] || status;
  };

  if (userLoading) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Користувач" showBack />
        <Container className="py-6">
          <Loading text="Завантаження користувача..." />
        </Container>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Користувач" showBack />
        <Container className="py-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">Користувача не знайдено</p>
          </div>
        </Container>
      </div>
    );
  }

  const isAdmin = currentUser?.roles.some((r) => r.name === 'admin');

  return (
    <div className="min-h-screen pb-nav">
      <Header title={user.full_name} showBack />

      <Container className="py-6">
        <div className="space-y-4">
          {/* Main Info */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle>Основна інформація</CardTitle>
                {!editMode && (
                  <Badge variant={getStatusBadgeVariant(user.status)}>
                    {getStatusLabel(user.status)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {editMode ? (
                <>
                  <div>
                    <label className="text-sm text-gray-600 block mb-1">Статус</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="active">Активний</option>
                      <option value="inactive">Неактивний</option>
                      <option value="pending">На розгляді</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 block mb-1">Коментар</label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={3}
                      placeholder="Додайте коментар (необов'язково)"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-gray-600">Прізвище</p>
                    <p className="font-medium">{user.last_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Ім'я</p>
                    <p className="font-medium">{user.first_name}</p>
                  </div>
                  {user.middle_name && (
                    <div>
                      <p className="text-sm text-gray-600">По батькові</p>
                      <p className="font-medium">{user.middle_name}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Телефон</p>
                    <p className="font-medium">{user.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Місто</p>
                    <p className="font-medium">{user.city}</p>
                  </div>
                  {user.comment && (
                    <div>
                      <p className="text-sm text-gray-600">Коментар</p>
                      <p className="font-medium">{user.comment}</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Roles */}
          <Card>
            <CardHeader>
              <CardTitle>Ролі</CardTitle>
            </CardHeader>
            <CardContent>
              {editMode && roles ? (
                <div className="space-y-2">
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role.id)}
                        onChange={() => toggleRole(role.id)}
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm">
                        {role.name}
                        {role.description && (
                          <span className="text-gray-500"> - {role.description}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {user.roles.length > 0 ? (
                    user.roles.map((role) => (
                      <Badge key={role.id} variant="default">
                        {role.name}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">Ролі не призначені</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Directions */}
          <Card>
            <CardHeader>
              <CardTitle>Напрямки</CardTitle>
            </CardHeader>
            <CardContent>
              {editMode && directions ? (
                <div className="space-y-2">
                  {directions.map((direction) => (
                    <label key={direction.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedDirections.includes(direction.id)}
                        onChange={() => toggleDirection(direction.id)}
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm">
                        {direction.name}
                        {direction.description && (
                          <span className="text-gray-500"> - {direction.description}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {user.directions.length > 0 ? (
                    user.directions.map((direction) => (
                      <Badge key={direction.id} variant="default">
                        {direction.name}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">Напрямки не призначені</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          {isAdmin && (
            <div className="space-y-3">
              {editMode ? (
                <>
                  <Button
                    fullWidth
                    onClick={handleSave}
                    loading={updateMutation.isPending}
                  >
                    Зберегти зміни
                  </Button>
                  <Button
                    fullWidth
                    variant="secondary"
                    onClick={() => setEditMode(false)}
                    disabled={updateMutation.isPending}
                  >
                    Скасувати
                  </Button>
                </>
              ) : (
                <>
                  <Button fullWidth onClick={handleEdit}>
                    Редагувати
                  </Button>
                  <Button
                    fullWidth
                    variant="danger"
                    onClick={handleDelete}
                    loading={deleteMutation.isPending}
                  >
                    Видалити користувача
                  </Button>
                </>
              )}
            </div>
          )}

          {updateMutation.isError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">Помилка оновлення користувача</p>
            </div>
          )}

          {deleteMutation.isError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">Помилка видалення користувача</p>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
