import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '@/api/dashboard';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Loading } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { hasPermission } from '@/utils/permissions';

export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.getStats,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Головна" />
        <Container className="py-6">
          <Loading text="Завантаження статистики..." />
        </Container>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Головна" />
        <Container className="py-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">Помилка завантаження даних</p>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-nav">
      <Header title="Головна" />
      <Container className="py-6">
        <div className="space-y-4">
          {/* Cases Stats */}
          {hasPermission(user, 'cases:read') && (
            <Card>
              <CardHeader>
                <CardTitle>Заявки</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div
                    className="cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors"
                    onClick={() => navigate('/cases')}
                  >
                    <p className="text-3xl font-bold text-primary-600">
                      {stats?.cases?.total || 0}
                    </p>
                    <p className="text-sm text-gray-600">Всього заявок</p>
                  </div>
                  <div
                    className="cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors"
                    onClick={() => navigate('/cases?decision_type=%D0%9D%D0%B0%20%D1%80%D0%BE%D0%B7%D0%B3%D0%BB%D1%8F%D0%B4%D1%96')}
                  >
                    <p className="text-3xl font-bold text-pink-600">
                      {stats?.cases?.by_decision?.['На розгляді'] || 0}
                    </p>
                    <p className="text-sm text-gray-600">На розгляді</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Searches Stats */}
          {hasPermission(user, 'searches:read') && (
            <Card>
              <CardHeader>
                <CardTitle>Пошуки</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div
                    className="cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors"
                    onClick={() => navigate('/searches')}
                  >
                    <p className="text-3xl font-bold text-primary-600">
                      {stats?.searches?.total || 0}
                    </p>
                    <p className="text-sm text-gray-600">Всього пошуків</p>
                  </div>
                  <div
                    className="cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors"
                    onClick={() => navigate('/searches?status_filter=active')}
                  >
                    <p className="text-3xl font-bold text-green-600">
                      {stats?.searches?.by_status?.active || 0}
                    </p>
                    <p className="text-sm text-gray-600">Активні</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Field Searches Stats */}
          {hasPermission(user, 'field_searches:read') && (
            <Card>
              <CardHeader>
                <CardTitle>Виїзди на місцевість</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <div
                    className="cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors"
                    onClick={() => navigate('/field-searches')}
                  >
                    <p className="text-2xl font-bold text-primary-600">
                      {stats?.field_searches?.total || 0}
                    </p>
                    <p className="text-xs text-gray-600">Всього</p>
                  </div>
                  <div
                    className="cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors"
                    onClick={() => navigate('/field-searches?status_filter=planning')}
                  >
                    <p className="text-2xl font-bold text-yellow-600">
                      {stats?.field_searches?.by_status?.planned || 0}
                    </p>
                    <p className="text-xs text-gray-600">Заплановано</p>
                  </div>
                  <div
                    className="cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors"
                    onClick={() => navigate('/field-searches?status_filter=active')}
                  >
                    <p className="text-2xl font-bold text-green-600">
                      {stats?.field_searches?.by_status?.active || 0}
                    </p>
                    <p className="text-xs text-gray-600">Активні</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Other Stats */}
          {(hasPermission(user, 'orientations:read') ||
            hasPermission(user, 'distributions:read')) && (
            <Card>
              <CardHeader>
                <CardTitle>Інше</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {hasPermission(user, 'orientations:read') && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Орієнтування</span>
                      <span className="font-medium">{stats?.flyers?.total || 0}</span>
                    </div>
                  )}
                  {hasPermission(user, 'distributions:read') && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Розсилки</span>
                      <span className="font-medium">{stats?.distributions?.total || 0}</span>
                    </div>
                  )}
                  {hasPermission(user, 'orientations:read') && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Прозвони</span>
                      <span className="font-medium">{stats?.institutions_calls?.total || 0}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </Container>
    </div>
  );
}
