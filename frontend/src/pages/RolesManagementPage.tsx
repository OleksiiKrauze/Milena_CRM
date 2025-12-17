import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { managementApi } from '@/api/management';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Button, Input, Loading } from '@/components/ui';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

export function RolesManagementPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', parent_role_id: '' });

  const { data: roles, isLoading } = useQuery({
    queryKey: ['management-roles'],
    queryFn: managementApi.listRoles,
  });

  const createMutation = useMutation({
    mutationFn: managementApi.createRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management-roles'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => managementApi.updateRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management-roles'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: managementApi.deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management-roles'] });
    },
  });

  const resetForm = () => {
    setFormData({ name: '', description: '', parent_role_id: '' });
    setEditingRole(null);
    setShowForm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      description: formData.description || undefined,
      parent_role_id: formData.parent_role_id ? parseInt(formData.parent_role_id) : undefined,
    };

    if (editingRole) {
      updateMutation.mutate({ id: editingRole, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (role: any) => {
    setEditingRole(role.id);
    setFormData({
      name: role.name,
      description: role.description || '',
      parent_role_id: role.parent_role_id?.toString() || '',
    });
    setShowForm(true);
  };

  const handleDelete = (roleId: number) => {
    if (window.confirm('Ви впевнені, що хочете видалити цю роль?')) {
      deleteMutation.mutate(roleId);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Управління ролями" showBack />
        <Container className="py-6">
          <Loading text="Завантаження ролей..." />
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-nav">
      <Header title="Управління ролями" showBack />

      <Container className="py-6">
        <div className="space-y-4">
          {/* Add Button */}
          {!showForm && (
            <Button fullWidth onClick={() => setShowForm(true)}>
              <Plus className="h-5 w-5 mr-2" />
              Додати роль
            </Button>
          )}

          {/* Form */}
          {showForm && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{editingRole ? 'Редагувати роль' : 'Нова роль'}</CardTitle>
                  <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    label="Назва ролі"
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
                      placeholder="Опис ролі (необов'язково)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Підпорядковується
                    </label>
                    <select
                      value={formData.parent_role_id}
                      onChange={(e) => setFormData({ ...formData, parent_role_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Адміністратору (за замовчуванням)</option>
                      {roles?.filter(r => r.id !== editingRole).map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
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
                      {editingRole ? 'Зберегти' : 'Створити'}
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
                      <p className="text-sm text-red-800">Помилка збереження ролі</p>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          )}

          {/* Roles List */}
          <div className="space-y-3">
            {roles?.map((role) => (
              <Card key={role.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{role.name}</h3>
                      {role.description && (
                        <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                      )}
                      {role.parent_role_name && (
                        <p className="text-xs text-gray-500 mt-1">
                          Підпорядковується: {role.parent_role_name}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(role)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(role.id)}
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
              <p className="text-sm text-red-800">Помилка видалення ролі</p>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
