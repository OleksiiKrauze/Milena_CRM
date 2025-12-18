import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fieldSearchesApi } from '@/api/field-searches';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardContent, Badge, Loading, Button, getStatusBadgeVariant } from '@/components/ui';
import { formatDateTime } from '@/utils/formatters';

export function FieldSearchListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const caseIdParam = searchParams.get('case_id');

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [caseIdFilter, setCaseIdFilter] = useState<string>(caseIdParam || '');

  const { data, isLoading, error } = useQuery({
    queryKey: ['field-searches', statusFilter, caseIdFilter],
    queryFn: () => {
      const params: any = {};
      if (statusFilter) params.status_filter = statusFilter;
      if (caseIdFilter) params.case_id = Number(caseIdFilter);
      return fieldSearchesApi.list(params);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Виїзди на місцевість" showBack />
        <Container className="py-6">
          <Loading text="Завантаження виїздів..." />
        </Container>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Виїзди на місцевість" showBack />
        <Container className="py-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">Помилка завантаження виїздів</p>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-nav">
      <Header title="Виїзди на місцевість" showBack />

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
                  <option value="planning">Планування</option>
                  <option value="prepared">Підготовлено</option>
                  <option value="active">Активний</option>
                  <option value="completed">Завершений</option>
                  <option value="cancelled">Скасований</option>
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

              {(statusFilter || caseIdFilter) && (
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => {
                    setStatusFilter('');
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
            Знайдено: {data?.total || 0} виїздів
          </div>

          {/* Field Searches list */}
          {!data?.field_searches || data.field_searches.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                Виїзди не знайдено
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.field_searches.map((fieldSearch) => {
                // Определяем цвет фона в зависимости от результата
                let bgColor = 'bg-white'; // По умолчанию белый
                if (fieldSearch.result === 'alive') {
                  bgColor = 'bg-green-100';
                } else if (fieldSearch.result === 'dead') {
                  bgColor = 'bg-gray-300';
                } else if (fieldSearch.result === 'not_found') {
                  bgColor = 'bg-white';
                }

                return (
                  <Card
                    key={fieldSearch.id}
                    className={`cursor-pointer active:opacity-90 transition-colors ${bgColor}`}
                    onClick={() => navigate(`/field-searches/${fieldSearch.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">Виїзд #{fieldSearch.id}</h3>
                        <Badge variant={getStatusBadgeVariant(fieldSearch.status)}>
                          {fieldSearch.status === 'planning' && 'Планування'}
                          {fieldSearch.status === 'prepared' && 'Підготовлено'}
                          {fieldSearch.status === 'active' && 'Активний'}
                          {fieldSearch.status === 'completed' && 'Завершений'}
                          {fieldSearch.status === 'cancelled' && 'Скасований'}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>
                          <span className="font-medium">Заявка:</span>{' '}
                          <span
                            className="text-primary-600 hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/cases/${fieldSearch.case_id}`);
                            }}
                          >
                            №{fieldSearch.case_id}
                          </span>
                        </p>
                        {fieldSearch.search?.case && (
                          <p>
                            <span className="font-medium">Зниклий:</span>{' '}
                            {fieldSearch.search.case.missing_full_name}
                          </p>
                        )}
                        {fieldSearch.initiator_inforg && (
                          <p>
                            <span className="font-medium">Ініціатор:</span>{' '}
                            {fieldSearch.initiator_inforg.full_name}
                          </p>
                        )}
                        {fieldSearch.coordinator && (
                          <p>
                            <span className="font-medium">Координатор:</span>{' '}
                            {fieldSearch.coordinator.full_name}
                          </p>
                        )}
                        {fieldSearch.meeting_datetime && (
                          <p>
                            <span className="font-medium">Збір:</span>{' '}
                            {formatDateTime(fieldSearch.meeting_datetime)}
                          </p>
                        )}
                        {fieldSearch.meeting_place && (
                          <p>
                            <span className="font-medium">Місце збору:</span>{' '}
                            {fieldSearch.meeting_place}
                          </p>
                        )}
                        {fieldSearch.result && (
                          <p>
                            <span className="font-medium">Результат:</span>{' '}
                            {fieldSearch.result === 'alive' && 'Живий'}
                            {fieldSearch.result === 'dead' && 'Мертвий'}
                            {fieldSearch.result === 'location_known' && 'Місцезнаходження відомо'}
                            {fieldSearch.result === 'not_found' && 'Не знайдений'}
                            {!['alive', 'dead', 'location_known', 'not_found'].includes(fieldSearch.result) && fieldSearch.result}
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
