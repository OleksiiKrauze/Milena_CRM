import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '@/api/dashboard';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Loading } from '@/components/ui';

export function DashboardPage() {
  const navigate = useNavigate();
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
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/cases')}
          >
            <CardHeader>
              <CardTitle>Заявки</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-3xl font-bold text-primary-600">
                    {stats?.cases?.total || 0}
                  </p>
                  <p className="text-sm text-gray-600">Всього заявок</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-yellow-600">
                    {stats?.cases?.by_status?.new || 0}
                  </p>
                  <p className="text-sm text-gray-600">Нові</p>
                </div>
              </div>
              {stats?.cases?.by_status && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                  {Object.entries(stats.cases.by_status).map(([status, count]) => (
                    <div key={status} className="flex justify-between text-sm">
                      <span className="text-gray-600 capitalize">
                        {status.replace(/_/g, ' ')}
                      </span>
                      <span className="font-medium">{count as number}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Searches Stats */}
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/searches')}
          >
            <CardHeader>
              <CardTitle>Пошуки</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-3xl font-bold text-primary-600">
                    {stats?.searches?.total || 0}
                  </p>
                  <p className="text-sm text-gray-600">Всього пошуків</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-green-600">
                    {stats?.searches?.by_status?.active || 0}
                  </p>
                  <p className="text-sm text-gray-600">Активні</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Field Searches Stats */}
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/field-searches')}
          >
            <CardHeader>
              <CardTitle>Виїзди на місцевість</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-3xl font-bold text-primary-600">
                    {stats?.field_searches?.total || 0}
                  </p>
                  <p className="text-sm text-gray-600">Всього виїздів</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-yellow-600">
                    {stats?.field_searches?.by_status?.planned || 0}
                  </p>
                  <p className="text-sm text-gray-600">Заплановано</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Other Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Інше</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Орієнтування</span>
                  <span className="font-medium">{stats?.flyers?.total || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Розсилки</span>
                  <span className="font-medium">{stats?.distributions?.total || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Прозвони</span>
                  <span className="font-medium">{stats?.institutions_calls?.total || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Container>
    </div>
  );
}
