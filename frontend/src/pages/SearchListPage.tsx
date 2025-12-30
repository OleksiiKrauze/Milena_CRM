import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchesApi } from '@/api/searches';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardContent, Badge, Loading, Button, getStatusBadgeVariant } from '@/components/ui';
import { formatDate } from '@/utils/formatters';

export function SearchListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const caseIdParam = searchParams.get('case_id');

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [resultFilter, setResultFilter] = useState<string>('');
  const [caseIdFilter, setCaseIdFilter] = useState<string>(caseIdParam || '');

  const { data, isLoading, error } = useQuery({
    queryKey: ['searches', statusFilter, resultFilter, caseIdFilter],
    queryFn: () => {
      const params: any = {};
      if (statusFilter) params.status_filter = statusFilter;
      if (resultFilter) params.result_filter = resultFilter;
      if (caseIdFilter) params.case_id = Number(caseIdFilter);
      return searchesApi.list(params);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Пошуки" showBack />
        <Container className="py-6">
          <Loading text="Завантаження пошуків..." />
        </Container>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Пошуки" showBack />
        <Container className="py-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">Помилка завантаження пошуків</p>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-nav">
      <Header title="Пошуки" showBack />

      <Container className="py-6">
        <div className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="space-y-3 pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Статус
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">Всі статуси</option>
                  <option value="planned">Запланований</option>
                  <option value="active">Активний</option>
                  <option value="completed">Завершений</option>
                  <option value="cancelled">Скасований</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Результат
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={resultFilter}
                  onChange={(e) => setResultFilter(e.target.value)}
                >
                  <option value="">Всі результати</option>
                  <option value="alive">Живий</option>
                  <option value="dead">Виявлено</option>
                  <option value="location_known">Місцезнаходження відомо</option>
                  <option value="not_found">Пошук припинено</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Заявка №
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Введіть номер заявки"
                  value={caseIdFilter}
                  onChange={(e) => setCaseIdFilter(e.target.value)}
                />
              </div>

              {(statusFilter || resultFilter || caseIdFilter) && (
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => {
                    setStatusFilter('');
                    setResultFilter('');
                    setCaseIdFilter('');
                  }}
                >
                  Скинути фільтри
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Results count */}
          <div className="text-sm text-gray-600">
            Знайдено: {data?.total || 0} пошуків
          </div>

          {/* Searches list */}
          {!data?.searches || data.searches.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                Пошуки не знайдено
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.searches.map((search) => {
                // Определяем цвет фона в зависимости от результата
                let bgColor = 'bg-white'; // По умолчанию белый для "не визначено"
                let textColor = 'text-gray-900'; // По умолчанию черный текст
                if (search.result === 'alive') {
                  bgColor = 'bg-green-200';
                } else if (search.result === 'dead') {
                  bgColor = 'bg-gray-500';
                  textColor = 'text-white';
                } else if (search.result === 'not_found') {
                  bgColor = 'bg-gray-300';
                }
                // location_known оставляем белым

                return (
                  <Card
                    key={search.id}
                    className={`cursor-pointer active:opacity-90 transition-colors ${bgColor}`}
                    onClick={() => navigate(`/searches/${search.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className={`font-semibold ${textColor}`}>Пошук #{search.id}</h3>
                        <Badge variant={getStatusBadgeVariant(search.status)}>
                          {search.status === 'planned' && 'Запланований'}
                          {search.status === 'active' && 'Активний'}
                          {search.status === 'completed' && 'Завершений'}
                          {search.status === 'cancelled' && 'Скасований'}
                        </Badge>
                      </div>
                      <div className={`space-y-1 text-sm ${textColor}`}>
                        {search.case && (
                          <p>
                            <span className="font-medium">Зниклий:</span>{' '}
                            {search.case.missing_full_name}
                          </p>
                        )}
                        <p>
                          <span className="font-medium">Заявка:</span>{' '}
                          <span
                            className="text-primary-600 hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/cases/${search.case_id}`);
                            }}
                          >
                            №{search.case_id}
                          </span>
                        </p>
                        {search.initiator_inforg && (
                          <p>
                            <span className="font-medium">Ініціатор:</span>{' '}
                            {search.initiator_inforg.full_name}
                          </p>
                        )}
                        {search.start_date && (
                          <p>
                            <span className="font-medium">Початок:</span>{' '}
                            {formatDate(search.start_date)}
                          </p>
                        )}
                        {search.result && (
                          <p>
                            <span className="font-medium">Результат:</span>{' '}
                            {search.result === 'alive' && 'Живий'}
                            {search.result === 'dead' && 'Виявлено'}
                            {search.result === 'location_known' && 'Місцезнаходження відомо'}
                            {search.result === 'not_found' && 'Пошук припинено'}
                            {!['alive', 'dead', 'location_known', 'not_found'].includes(search.result) && search.result}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
