import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { searchesApi } from '@/api/searches';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Badge, Loading, Button, getStatusBadgeVariant } from '@/components/ui';
import { formatDate, formatDateTime } from '@/utils/formatters';

export function SearchDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: searchData, isLoading, error } = useQuery({
    queryKey: ['search-full', id],
    queryFn: () => searchesApi.getFull(Number(id)),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Пошук" showBack />
        <Container className="py-6">
          <Loading text="Завантаження пошуку..." />
        </Container>
      </div>
    );
  }

  if (error || !searchData) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Пошук" showBack />
        <Container className="py-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">Помилка завантаження пошуку</p>
          </div>
        </Container>
      </div>
    );
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'planned': return 'Запланований';
      case 'active': return 'Активний';
      case 'completed': return 'Завершений';
      case 'cancelled': return 'Скасований';
      default: return status;
    }
  };

  const getResultLabel = (result: string | null) => {
    if (!result) return null;
    switch (result) {
      case 'alive': return 'Живий';
      case 'dead': return 'Мертвий';
      case 'location_known': return 'Місцезнаходження відомо';
      case 'not_found': return 'Не знайдений';
      default: return result;
    }
  };

  return (
    <div className="min-h-screen pb-nav">
      <Header title={`Пошук #${searchData.id}`} showBack />

      <Container className="py-6">
        <div className="space-y-4">
          {/* Edit Button */}
          <Button
            onClick={() => navigate(`/searches/${searchData.id}/edit`)}
            fullWidth
            variant="outline"
          >
            Редагувати пошук
          </Button>

          {/* Main Info */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle>Основна інформація</CardTitle>
                <Badge variant={getStatusBadgeVariant(searchData.status)}>
                  {getStatusLabel(searchData.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Дата створення</p>
                <p className="font-medium">{formatDateTime(searchData.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Заявка</p>
                <p
                  className="font-medium text-primary-600 hover:underline cursor-pointer"
                  onClick={() => navigate(`/cases/${searchData.case_id}`)}
                >
                  №{searchData.case_id}
                </p>
              </div>
              {searchData.initiator_inforg && (
                <div>
                  <p className="text-sm text-gray-600">Ініціатор (інфорг)</p>
                  <p className="font-medium">{searchData.initiator_inforg.full_name}</p>
                </div>
              )}
              {searchData.start_date && (
                <div>
                  <p className="text-sm text-gray-600">Дата початку</p>
                  <p className="font-medium">{formatDate(searchData.start_date)}</p>
                </div>
              )}
              {searchData.end_date && (
                <div>
                  <p className="text-sm text-gray-600">Дата завершення</p>
                  <p className="font-medium">{formatDate(searchData.end_date)}</p>
                </div>
              )}
              {searchData.result && (
                <div>
                  <p className="text-sm text-gray-600">Результат</p>
                  <p className="font-medium">{getResultLabel(searchData.result)}</p>
                </div>
              )}
              {searchData.result_comment && (
                <div>
                  <p className="text-sm text-gray-600">Коментар до результату</p>
                  <p className="font-medium whitespace-pre-wrap">{searchData.result_comment}</p>
                </div>
              )}
              {searchData.notes && (
                <div>
                  <p className="text-sm text-gray-600">Примітки</p>
                  <p className="font-medium whitespace-pre-wrap">{searchData.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Field Searches */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Виїзди на місцевість ({searchData.field_searches?.length || 0})</CardTitle>
                <Button
                  size="sm"
                  onClick={() => navigate(`/searches/${searchData.id}/create-field-search`)}
                >
                  + Створити виїзд
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!searchData.field_searches || searchData.field_searches.length === 0 ? (
                <p className="text-sm text-gray-600">Виїзди не заплановано</p>
              ) : (
                <div className="space-y-3">
                  {searchData.field_searches.map((fieldSearch) => (
                    <div
                      key={fieldSearch.id}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => navigate(`/field-searches/${fieldSearch.id}`)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-medium">Виїзд #{fieldSearch.id}</p>
                        <Badge variant={getStatusBadgeVariant(fieldSearch.status)}>
                          {fieldSearch.status}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        {fieldSearch.start_date && (
                          <p>Початок: {formatDate(fieldSearch.start_date)}</p>
                        )}
                        {fieldSearch.end_date && (
                          <p>Завершення: {formatDate(fieldSearch.end_date)}</p>
                        )}
                        {fieldSearch.meeting_datetime && (
                          <p>Зустріч: {formatDateTime(fieldSearch.meeting_datetime)}</p>
                        )}
                        {fieldSearch.meeting_place && (
                          <p>Місце зустрічі: {fieldSearch.meeting_place}</p>
                        )}
                        {fieldSearch.result && (
                          <p>Результат: {fieldSearch.result}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Flyers */}
          <Card>
            <CardHeader>
              <CardTitle>Орієнтовки ({searchData.flyers?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {!searchData.flyers || searchData.flyers.length === 0 ? (
                <p className="text-sm text-gray-600">Орієнтовки не створено</p>
              ) : (
                <div className="space-y-3">
                  {searchData.flyers.map((flyer: any) => (
                    <div
                      key={flyer.id}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <p className="font-medium mb-2">Орієнтовка #{flyer.id}</p>
                      {flyer.title && (
                        <p className="text-sm text-gray-600">Назва: {flyer.title}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Distributions */}
          <Card>
            <CardHeader>
              <CardTitle>Розсилки ({searchData.distributions?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {!searchData.distributions || searchData.distributions.length === 0 ? (
                <p className="text-sm text-gray-600">Розсилки не проводились</p>
              ) : (
                <div className="space-y-3">
                  {searchData.distributions.map((distribution: any) => (
                    <div
                      key={distribution.id}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-medium">Розсилка #{distribution.id}</p>
                        <Badge variant={getStatusBadgeVariant(distribution.status)}>
                          {distribution.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Map Grids */}
          <Card>
            <CardHeader>
              <CardTitle>Карти ({searchData.map_grids?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {!searchData.map_grids || searchData.map_grids.length === 0 ? (
                <p className="text-sm text-gray-600">Карти не створено</p>
              ) : (
                <div className="space-y-3">
                  {searchData.map_grids.map((mapGrid: any) => (
                    <div
                      key={mapGrid.id}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <p className="font-medium">Карта #{mapGrid.id}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Container>
    </div>
  );
}
