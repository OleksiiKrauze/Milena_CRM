import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { casesApi } from '@/api/cases';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Badge, Loading, Button, getStatusBadgeVariant } from '@/components/ui';
import { formatDate, formatDateTime } from '@/utils/formatters';

export function CaseDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: caseData, isLoading, error } = useQuery({
    queryKey: ['case-full', id],
    queryFn: () => casesApi.getFull(Number(id)),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Заявка" showBack />
        <Container className="py-6">
          <Loading text="Завантаження заявки..." />
        </Container>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Заявка" showBack />
        <Container className="py-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">Помилка завантаження заявки</p>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-nav">
      <Header title={`Заявка #${caseData.id}`} showBack />

      <Container className="py-6">
        <div className="space-y-4">
          {/* Edit Button */}
          <Button
            onClick={() => navigate(`/cases/${caseData.id}/edit`)}
            fullWidth
            variant="outline"
          >
            Редагувати заявку
          </Button>
          {/* Main Info */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle>Основна інформація</CardTitle>
                <Badge variant={getStatusBadgeVariant(caseData.case_status)}>
                  {caseData.case_status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Дата створення</p>
                <p className="font-medium">{formatDateTime(caseData.created_at)}</p>
              </div>
              {caseData.created_by && (
                <div>
                  <p className="text-sm text-gray-600">Створив</p>
                  <p className="font-medium">{caseData.created_by.full_name}</p>
                </div>
              )}
              {caseData.updated_at && (
                <div>
                  <p className="text-sm text-gray-600">Останнє редагування</p>
                  <p className="font-medium">{formatDateTime(caseData.updated_at)}</p>
                </div>
              )}
              {caseData.updated_by && (
                <div>
                  <p className="text-sm text-gray-600">Відредагував</p>
                  <p className="font-medium">{caseData.updated_by.full_name}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Рішення по заявці</p>
                <p className="font-medium">{caseData.decision_type}</p>
              </div>
              {caseData.decision_comment && (
                <div>
                  <p className="text-sm text-gray-600">Коментар до рішення</p>
                  <p className="font-medium">{caseData.decision_comment}</p>
                </div>
              )}
              {caseData.tags && caseData.tags.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Теги</p>
                  <div className="flex flex-wrap gap-1">
                    {caseData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Info */}
          <Card>
            <CardHeader>
              <CardTitle>Статус</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Статус заявки</p>
                <div className="mt-1">
                  <Badge variant={getStatusBadgeVariant(caseData.case_status)}>
                    {caseData.case_status}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Рішення по заявці</p>
                <p className="font-medium text-lg">{caseData.decision_type}</p>
              </div>
              {caseData.decision_comment && (
                <div>
                  <p className="text-sm text-gray-600">Коментар до рішення</p>
                  <p className="font-medium whitespace-pre-wrap">{caseData.decision_comment}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Applicant Info */}
          <Card>
            <CardHeader>
              <CardTitle>Дані заявника</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">ПІБ</p>
                <p className="font-medium">{caseData.applicant_full_name}</p>
              </div>
              {caseData.applicant_phone && (
                <div>
                  <p className="text-sm text-gray-600">Телефон</p>
                  <p className="font-medium">
                    <a href={`tel:${caseData.applicant_phone}`} className="text-primary-600 hover:underline">
                      {caseData.applicant_phone}
                    </a>
                  </p>
                </div>
              )}
              {caseData.applicant_relation && (
                <div>
                  <p className="text-sm text-gray-600">Ким приходиться</p>
                  <p className="font-medium">{caseData.applicant_relation}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Missing Person Info */}
          <Card>
            <CardHeader>
              <CardTitle>Дані пропавшого</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {caseData.missing_settlement && (
                <div>
                  <p className="text-sm text-gray-600">Населений пункт</p>
                  <p className="font-medium">{caseData.missing_settlement}</p>
                </div>
              )}
              {caseData.missing_region && (
                <div>
                  <p className="text-sm text-gray-600">Область</p>
                  <p className="font-medium">{caseData.missing_region}</p>
                </div>
              )}
              {caseData.missing_address && (
                <div>
                  <p className="text-sm text-gray-600">Адреса проживання</p>
                  <p className="font-medium">{caseData.missing_address}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">ПІБ</p>
                <p className="font-medium text-lg">{caseData.missing_full_name}</p>
              </div>
              {caseData.missing_gender && (
                <div>
                  <p className="text-sm text-gray-600">Стать</p>
                  <p className="font-medium">{caseData.missing_gender}</p>
                </div>
              )}
              {caseData.missing_birthdate && (
                <div>
                  <p className="text-sm text-gray-600">Дата народження</p>
                  <p className="font-medium">{formatDate(caseData.missing_birthdate)}</p>
                </div>
              )}
              {caseData.missing_photos && caseData.missing_photos.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Фото ({caseData.missing_photos.length})</p>
                  <div className="grid grid-cols-2 gap-2">
                    {caseData.missing_photos.map((photoUrl, index) => (
                      <img
                        key={index}
                        src={photoUrl}
                        alt={`Фото ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(photoUrl, '_blank')}
                      />
                    ))}
                  </div>
                </div>
              )}
              {caseData.missing_last_seen_datetime && (
                <div>
                  <p className="text-sm text-gray-600">Коли бачили востаннє</p>
                  <p className="font-medium">{formatDateTime(caseData.missing_last_seen_datetime)}</p>
                </div>
              )}
              {caseData.missing_last_seen_place && (
                <div>
                  <p className="text-sm text-gray-600">Де бачили востаннє</p>
                  <p className="font-medium">{caseData.missing_last_seen_place}</p>
                </div>
              )}
              {caseData.missing_description && (
                <div>
                  <p className="text-sm text-gray-600">Опис</p>
                  <p className="font-medium whitespace-pre-wrap">{caseData.missing_description}</p>
                </div>
              )}
              {caseData.missing_special_signs && (
                <div>
                  <p className="text-sm text-gray-600">Особливі прикмети</p>
                  <p className="font-medium whitespace-pre-wrap">{caseData.missing_special_signs}</p>
                </div>
              )}
              {caseData.missing_diseases && (
                <div>
                  <p className="text-sm text-gray-600">Захворювання</p>
                  <p className="font-medium whitespace-pre-wrap">{caseData.missing_diseases}</p>
                </div>
              )}
              {caseData.missing_phone && (
                <div>
                  <p className="text-sm text-gray-600">Номер телефону</p>
                  <p className="font-medium">
                    <a href={`tel:${caseData.missing_phone}`} className="text-primary-600 hover:underline">
                      {caseData.missing_phone}
                    </a>
                  </p>
                </div>
              )}
              {caseData.missing_clothing && (
                <div>
                  <p className="text-sm text-gray-600">Одяг</p>
                  <p className="font-medium whitespace-pre-wrap">{caseData.missing_clothing}</p>
                </div>
              )}
              {caseData.missing_belongings && (
                <div>
                  <p className="text-sm text-gray-600">Що було з собою</p>
                  <p className="font-medium whitespace-pre-wrap">{caseData.missing_belongings}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Search Information */}
          <Card>
            <CardHeader>
              <CardTitle>Інформація про пошук</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {caseData.additional_search_regions && caseData.additional_search_regions.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600">Додаткові області пошуку</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {caseData.additional_search_regions.map((region, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm"
                      >
                        {region}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Заява до поліції</p>
                <p className={`font-medium ${caseData.police_report_filed ? 'text-green-600' : 'text-red-600'}`}>
                  {caseData.police_report_filed ? 'Подана ✓' : 'Не подана ✗'}
                </p>
              </div>
              {caseData.search_terrain_type && (
                <div>
                  <p className="text-sm text-gray-600">Тип місцевості пошуку</p>
                  <p className="font-medium">{caseData.search_terrain_type}</p>
                </div>
              )}
              {caseData.disappearance_circumstances && (
                <div>
                  <p className="text-sm text-gray-600">Обставини зникнення</p>
                  <p className="font-medium whitespace-pre-wrap">{caseData.disappearance_circumstances}</p>
                </div>
              )}
              {caseData.additional_info && (
                <div>
                  <p className="text-sm text-gray-600">Додаткова інформація</p>
                  <p className="font-medium whitespace-pre-wrap">{caseData.additional_info}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Searches */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Пошуки ({caseData.searches?.length || 0})</CardTitle>
                <Button
                  size="sm"
                  onClick={() => navigate(`/cases/${caseData.id}/create-search`)}
                >
                  + Створити пошук
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!caseData.searches || caseData.searches.length === 0 ? (
                <p className="text-sm text-gray-600">Пошуки не розпочато</p>
              ) : (
                <div className="space-y-3">
                  {caseData.searches.map((search) => (
                    <div
                      key={search.id}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => navigate(`/searches/${search.id}`)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-medium">Пошук #{search.id}</p>
                        <Badge variant={getStatusBadgeVariant(search.status)}>
                          {search.status === 'planned' && 'Запланований'}
                          {search.status === 'active' && 'Активний'}
                          {search.status === 'completed' && 'Завершений'}
                          {search.status === 'cancelled' && 'Скасований'}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        {search.start_date && <p>Розпочато: {formatDate(search.start_date)}</p>}
                        {search.end_date && <p>Завершено: {formatDate(search.end_date)}</p>}
                        {search.result && (
                          <p>
                            Результат:{' '}
                            {search.result === 'alive' && 'Живий'}
                            {search.result === 'dead' && 'Мертвий'}
                            {search.result === 'location_known' && 'Місцезнаходження відомо'}
                            {search.result === 'not_found' && 'Не знайдений'}
                            {!['alive', 'dead', 'location_known', 'not_found'].includes(search.result) && search.result}
                          </p>
                        )}
                      </div>
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
