import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { managementApi } from '@/api/management';
import { usersApi } from '@/api/users';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Button, Input, Loading } from '@/components/ui';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

export function DirectionsManagementPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingDirection, setEditingDirection] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', responsible_user_id: '' });

  const { data: directions, isLoading } = useQuery({
    queryKey: ['management-directions'],
    queryFn: managementApi.listDirections,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-for-directions'],
    queryFn: () => usersApi.list({ limit: 100, status_filter: 'active' }),
  });

  const createMutation = useMutation({
    mutationFn: managementApi.createDirection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management-directions'] });
      queryClient.invalidateQueries({ queryKey: ['directions'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => managementApi.updateDirection(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management-directions'] });
      queryClient.invalidateQueries({ queryKey: ['directions'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: managementApi.deleteDirection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management-directions'] });
      queryClient.invalidateQueries({ queryKey: ['directions'] });
    },
  });

  const resetForm = () => {
    setFormData({ name: '', description: '', responsible_user_id: '' });
    setEditingDirection(null);
    setShowForm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      description: formData.description || undefined,
      responsible_user_id: formData.responsible_user_id ? parseInt(formData.responsible_user_id) : undefined,
    };

    if (editingDirection) {
      updateMutation.mutate({ id: editingDirection, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (direction: any) => {
    setEditingDirection(direction.id);
    setFormData({
      name: direction.name,
      description: direction.description || '',
      responsible_user_id: direction.responsible_user_id?.toString() || '',
    });
    setShowForm(true);
  };

  const handleDelete = (directionId: number) => {
    if (window.confirm('Ви впевнені, що хочете видалити цей напрямок?')) {
      deleteMutation.mutate(directionId);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Управління напрямками" showBack />
        <Container className="py-6">
          <Loading text="Завантаження напрямків..." />
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-nav">
      <Header title="Управління напрямками" showBack />

      <Container className="py-6">
        <div className="space-y-4">
          {/* Add Button */}
          {!showForm && (
            <Button fullWidth onClick={() => setShowForm(true)}>
              <Plus className="h-5 w-5 mr-2" />
              Додати напрямок
            </Button>
          )}

          {/* Form */}
          {showForm && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{editingDirection ? 'Редагувати напрямок' : 'Новий напрямок'}</CardTitle>
                  <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    label="Назва напрямку"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Опис
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={3}
                      placeholder="Опис напрямку (необов'язково)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Відповідальний
                    </label>
                    <select
                      value={formData.responsible_user_id}
                      onChange={(e) => setFormData({ ...formData, responsible_user_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Не призначено</option>
                      {usersData?.users?.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      fullWidth
                      loading={createMutation.isPending || updateMutation.isPending}
                    >
                      {editingDirection ? 'Зберегти' : 'Створити'}
                    </Button>
                    <Button
                      type="button"
                      fullWidth
                      variant="secondary"
                      onClick={resetForm}
                    >
                      Скасувати
                    </Button>
                  </div>

                  {(createMutation.isError || updateMutation.isError) && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">Помилка збереження напрямку</p>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          )}

          {/* Directions List */}
          <div className="space-y-3">
            {directions?.map((direction) => (
              <Card key={direction.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{direction.name}</h3>
                      {direction.description && (
                        <p className="text-sm text-gray-600 mt-1">{direction.description}</p>
                      )}
                      {direction.responsible_user_name && (
                        <p className="text-xs text-gray-500 mt-1">
                          Відповідальний: {direction.responsible_user_name}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(direction)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(direction.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {deleteMutation.isError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">Помилка видалення напрямку</p>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
