import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rolesApi } from '@/api/roles';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Button, Input, Loading } from '@/components/ui';
import { Plus, Edit2, Trash2, X, Shield, Users, CheckSquare, Square } from 'lucide-react';
import type { Role, RoleCreate, RoleUpdate, ResourcePermissions } from '@/types/api';

export function RolesManagementPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    display_name: string;
    description: string;
    permissions: Set<string>;
  }>({
    name: '',
    display_name: '',
    description: '',
    permissions: new Set(),
  });

  // Fetch roles
  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: rolesApi.list,
  });

  // Fetch available permissions
  const { data: permissionsData, isLoading: permissionsLoading } = useQuery({
    queryKey: ['permissions'],
    queryFn: rolesApi.getPermissions,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: RoleCreate) => rolesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      resetForm();
      alert('Роль успішно створена');
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Помилка створення ролі');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: RoleUpdate }) => rolesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      resetForm();
      alert('Роль успішно оновлена');
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Помилка оновлення ролі');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => rolesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      alert('Роль успішно видалена');
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Помилка видалення ролі');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      display_name: '',
      description: '',
      permissions: new Set(),
    });
    setEditingRole(null);
    setShowForm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const permissionsArray = Array.from(formData.permissions);

    if (editingRole) {
      const updateData: RoleUpdate = {
        name: formData.name !== editingRole.name ? formData.name : undefined,
        display_name: formData.display_name !== editingRole.display_name ? formData.display_name : undefined,
        description: formData.description !== (editingRole.description || '') ? formData.description : undefined,
        permissions: permissionsArray,
      };
      updateMutation.mutate({ id: editingRole.id, data: updateData });
    } else {
      const createData: RoleCreate = {
        name: formData.name,
        display_name: formData.display_name,
        description: formData.description || undefined,
        permissions: permissionsArray,
      };
      createMutation.mutate(createData);
    }
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      display_name: role.display_name,
      description: role.description || '',
      permissions: new Set(role.permissions),
    });
    setShowForm(true);
  };

  const handleDelete = (role: Role) => {
    if (role.is_system) {
      alert('Неможливо видалити системну роль');
      return;
    }
    if (role.user_count && role.user_count > 0) {
      alert(`Неможливо видалити роль: ${role.user_count} користувачів мають цю роль`);
      return;
    }
    if (window.confirm(`Ви впевнені, що хочете видалити роль "${role.display_name}"?`)) {
      deleteMutation.mutate(role.id);
    }
  };

  const togglePermission = (permission: string) => {
    const newPermissions = new Set(formData.permissions);
    if (newPermissions.has(permission)) {
      newPermissions.delete(permission);
    } else {
      newPermissions.add(permission);
    }
    setFormData({ ...formData, permissions: newPermissions });
  };

  const toggleAllResourcePermissions = (_resource: string, resourcePerms: ResourcePermissions) => {
    const newPermissions = new Set(formData.permissions);
    const allSelected = resourcePerms.permissions.every(p => newPermissions.has(p.code));

    if (allSelected) {
      // Deselect all
      resourcePerms.permissions.forEach(p => newPermissions.delete(p.code));
    } else {
      // Select all
      resourcePerms.permissions.forEach(p => newPermissions.add(p.code));
    }

    setFormData({ ...formData, permissions: newPermissions });
  };

  if (rolesLoading || permissionsLoading) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Управління ролями" showBack />
        <Container className="py-6">
          <Loading text="Завантаження..." />
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
                  <Button variant="ghost" size="sm" onClick={resetForm}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Ідентифікатор <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="наприклад: operator"
                      required
                      disabled={editingRole?.is_system}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Латиниця, без пробілів (використовується в системі)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Назва для відображення <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                      placeholder="наприклад: Оператор"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Опис</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      placeholder="Короткий опис ролі"
                    />
                  </div>

                  {/* Permissions Section */}
                  <div>
                    <label className="block text-sm font-medium mb-3">
                      Дозволи <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-4 border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                      {permissionsData && Object.entries(permissionsData.by_resource).map(([resource, data]) => {
                        const resourceData = data as ResourcePermissions;
                        const allSelected = resourceData.permissions.every(p =>
                          formData.permissions.has(p.code)
                        );
                        const someSelected = resourceData.permissions.some(p =>
                          formData.permissions.has(p.code)
                        );

                        return (
                          <div key={resource} className="border-b border-gray-100 last:border-0 pb-3">
                            {/* Resource Header */}
                            <div
                              className="flex items-center gap-2 mb-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                              onClick={() => toggleAllResourcePermissions(resource, resourceData)}
                            >
                              {allSelected ? (
                                <CheckSquare className="h-5 w-5 text-blue-600" />
                              ) : someSelected ? (
                                <div className="h-5 w-5 flex items-center justify-center">
                                  <div className="h-3 w-3 bg-blue-600 rounded" />
                                </div>
                              ) : (
                                <Square className="h-5 w-5 text-gray-400" />
                              )}
                              <span className="font-semibold text-gray-700">{resourceData.label}</span>
                            </div>

                            {/* Permissions Grid */}
                            <div className="grid grid-cols-2 gap-2 ml-7">
                              {resourceData.permissions.map((perm) => (
                                <label
                                  key={perm.code}
                                  className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={formData.permissions.has(perm.code)}
                                    onChange={() => togglePermission(perm.code)}
                                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-gray-600">{perm.action_label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Обрано дозволів: {formData.permissions.size}
                    </p>
                  </div>

                  {/* Form Actions */}
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      fullWidth
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      {editingRole ? 'Зберегти' : 'Створити'}
                    </Button>
                    <Button type="button" variant="outline" fullWidth onClick={resetForm}>
                      Скасувати
                    </Button>
                  </div>
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
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{role.display_name}</h3>
                        {role.is_system && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <Shield className="h-3 w-3" />
                            Системна
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mb-2">
                        {role.description || 'Без опису'}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {role.user_count || 0} користувачів
                        </span>
                        <span>
                          {role.permissions.length} дозволів
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(role)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      {!role.is_system && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(role)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}
