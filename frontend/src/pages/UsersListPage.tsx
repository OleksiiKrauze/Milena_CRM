import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { usersApi } from '@/api/users';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardContent, Badge, Loading, getStatusBadgeVariant } from '@/components/ui';
import { Users } from 'lucide-react';

export function UsersListPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['users', statusFilter],
    queryFn: () => usersApi.list({ status_filter: statusFilter || undefined }),
  });

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: 'Активний',
      inactive: 'Неактивний',
      pending: 'На розгляді',
    };
    return labels[status] || status;
  };

  return (
    <div className="min-h-screen pb-nav">
      <Header title="Користувачі" />

      <Container className="py-6">
        {/* Filter */}
        <div className="mb-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Всі статуси</option>
            <option value="active">Активні</option>
            <option value="inactive">Неактивні</option>
            <option value="pending">На розгляді</option>
          </select>
        </div>

        {isLoading && <Loading text="Завантаження користувачів..." />}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">Помилка завантаження користувачів</p>
          </div>
        )}

        {data && (
          <div className="space-y-3">
            {data?.users?.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Користувачі не знайдені</p>
              </div>
            ) : (
              data?.users?.map((user) => (
                <Link key={user.id} to={`/users/${user.id}`}>
                  <Card className="active:bg-gray-50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {user.full_name}
                        </h3>
                        <Badge variant={getStatusBadgeVariant(user.status)}>
                          {getStatusLabel(user.status)}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>
                          <span className="font-medium">Email:</span>{' '}
                          {user.email}
                        </p>
                        <p>
                          <span className="font-medium">Телефон:</span>{' '}
                          {user.phone}
                        </p>
                        <p>
                          <span className="font-medium">Місто:</span>{' '}
                          {user.city}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        )}

        {data && data?.total > (data?.users?.length || 0) && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Показано {data?.users?.length || 0} з {data?.total || 0}
          </p>
        )}
      </Container>
    </div>
  );
}
