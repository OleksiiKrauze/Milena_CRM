import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { organizationsApi } from '@/api/organizations';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Button, Loading } from '@/components/ui';
import { formatDateTime } from '@/utils/formatters';
import { useAuthStore } from '@/store/authStore';
import { hasPermission } from '@/utils/permissions';
import { getOrganizationTypeLabel } from '@/constants/organizationTypes';

export function OrganizationDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: organization, isLoading, error } = useQuery({
    queryKey: ['organization', id],
    queryFn: () => organizationsApi.get(Number(id)),
    enabled: !!id,
  });

  const deleteOrganizationMutation = useMutation({
    mutationFn: () => organizationsApi.delete(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      navigate('/organizations');
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Організація" showBack />
        <Container className="py-6">
          <Loading text="Завантаження організації..." />
        </Container>
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Організація" showBack />
        <Container className="py-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">Помилка завантаження організації</p>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-nav">
      <Header title={organization.name} showBack />

      <Container className="py-6">
        <div className="space-y-4">
          {/* Edit and Delete Buttons */}
          {(hasPermission(user, 'organizations:update') || hasPermission(user, 'organizations:delete')) && (
            <div className="flex gap-2">
              {hasPermission(user, 'organizations:update') && (
                <Button
                  onClick={() => navigate(`/organizations/${organization.id}/edit`)}
                  fullWidth
                  variant="outline"
                >
                  Редагувати
                </Button>
              )}
              {hasPermission(user, 'organizations:delete') && (
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  fullWidth
                  variant="outline"
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
                  Видалити
                </Button>
              )}
            </div>
          )}

          {/* Main Info */}
          <Card>
            <CardHeader>
              <CardTitle>Основна інформація</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Назва</p>
                <p className="font-medium text-lg">{organization.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Тип організації</p>
                <div className="mt-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-primary-100 text-primary-800">
                    {getOrganizationTypeLabel(organization.type)}
                  </span>
                </div>
              </div>
              {organization.region && (
                <div>
                  <p className="text-sm text-gray-600">Область</p>
                  <p className="font-medium">{organization.region}</p>
                </div>
              )}
              {organization.city && (
                <div>
                  <p className="text-sm text-gray-600">Населений пункт</p>
                  <p className="font-medium">{organization.city}</p>
                </div>
              )}
              {organization.address && (
                <div>
                  <p className="text-sm text-gray-600">Адреса</p>
                  <p className="font-medium">{organization.address}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contact Info */}
          {organization.contact_info && (
            <Card>
              <CardHeader>
                <CardTitle>Контактна інформація</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{organization.contact_info}</p>
              </CardContent>
            </Card>
          )}

          {/* Additional Info */}
          {organization.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Додаткова інформація</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <p className="text-sm text-gray-600">Коментар</p>
                  <p className="whitespace-pre-wrap mt-1">{organization.notes}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Метадані</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Створено</p>
                <p className="font-medium">{formatDateTime(organization.created_at)}</p>
                {organization.created_by && (
                  <p className="text-sm text-gray-600 mt-1">
                    Користувач: {organization.created_by.full_name}
                  </p>
                )}
              </div>
              {organization.updated_at && (
                <div>
                  <p className="text-sm text-gray-600">Оновлено</p>
                  <p className="font-medium">{formatDateTime(organization.updated_at)}</p>
                  {organization.updated_by && (
                    <p className="text-sm text-gray-600 mt-1">
                      Користувач: {organization.updated_by.full_name}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Container>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-2">Видалити організацію?</h3>
            <p className="text-gray-600 mb-4">
              Ви впевнені, що хочете видалити організацію "{organization.name}"? Цю дію не можна буде скасувати.
            </p>
            <div className="flex gap-2">
              <Button
                fullWidth
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Скасувати
              </Button>
              <Button
                fullWidth
                onClick={() => deleteOrganizationMutation.mutate()}
                disabled={deleteOrganizationMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteOrganizationMutation.isPending ? 'Видалення...' : 'Видалити'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
