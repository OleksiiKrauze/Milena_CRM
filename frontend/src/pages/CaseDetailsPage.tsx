import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { casesApi } from '@/api/cases';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Loading, Button } from '@/components/ui';
import { formatDate, formatDateTime } from '@/utils/formatters';

export function CaseDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { data: caseData, isLoading, error } = useQuery({
    queryKey: ['case-full', id],
    queryFn: () => casesApi.getFull(Number(id)),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => casesApi.delete(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      navigate('/cases');
    },
  });

  const handleDeleteConfirm = () => {
    deleteMutation.mutate();
    setShowDeleteModal(false);
  };

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
          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={() => navigate(`/cases/${caseData.id}/edit`)}
              fullWidth
              variant="outline"
            >
              Редагувати заявку
            </Button>
            <Button
              onClick={() => setShowDeleteModal(true)}
              variant="outline"
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              Видалити
            </Button>
          </div>
          {/* Main Info */}
          <Card>
            <CardHeader>
              <CardTitle>Основна інформація</CardTitle>
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
              {caseData.basis && (
                <div>
                  <p className="text-sm text-gray-600">Підстава</p>
                  <p className="font-medium">{caseData.basis}</p>
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
              <div>
                <p className="text-sm text-gray-600">Телефон</p>
                <p className="font-medium">
                  {caseData.applicant_phone ? (
                    <a href={`tel:${caseData.applicant_phone}`} className="text-primary-600 hover:underline">
                      {caseData.applicant_phone}
                    </a>
                  ) : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Ким приходиться</p>
                <p className="font-medium">{caseData.applicant_relation || '-'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Missing Persons - Display all */}
          {caseData.missing_persons && caseData.missing_persons.length > 0 ? (
            caseData.missing_persons.map((person: any, index: number) => (
              <Card key={person.id || index}>
                <CardHeader>
                  <CardTitle>
                    Дані зниклого {caseData.missing_persons.length > 1 ? `#${index + 1}` : ''}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">ПІБ</p>
                    <p className="font-medium text-lg">
                      {[person.last_name, person.first_name, person.middle_name].filter(Boolean).join(' ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Стать</p>
                    <p className="font-medium">{person.gender || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Дата народження</p>
                    <p className="font-medium">{person.birthdate ? formatDate(person.birthdate) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Телефон</p>
                    <p className="font-medium">
                      {person.phone ? (
                        <a href={`tel:${person.phone}`} className="text-primary-600 hover:underline">
                          {person.phone}
                        </a>
                      ) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Населений пункт</p>
                    <p className="font-medium">{person.settlement || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Область</p>
                    <p className="font-medium">{person.region || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Адреса проживання</p>
                    <p className="font-medium">{person.address || '-'}</p>
                  </div>
                  {person.photos && person.photos.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Фото ({person.photos.length})</p>
                      <div className="grid grid-cols-2 gap-2">
                        {person.photos.map((photoUrl: string, photoIndex: number) => (
                          <img
                            key={photoIndex}
                            src={photoUrl}
                            alt={`Фото ${photoIndex + 1}`}
                            className="w-full h-32 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(photoUrl, '_blank')}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">Коли бачили востаннє</p>
                    <p className="font-medium">{person.last_seen_datetime ? formatDateTime(person.last_seen_datetime) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Де бачили востаннє</p>
                    <p className="font-medium">{person.last_seen_place || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Опис</p>
                    <p className="font-medium whitespace-pre-wrap">{person.description || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Особливі прикмети</p>
                    <p className="font-medium whitespace-pre-wrap">{person.special_signs || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Захворювання</p>
                    <p className="font-medium whitespace-pre-wrap">{person.diseases || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Одяг</p>
                    <p className="font-medium whitespace-pre-wrap">{person.clothing || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Що було з собою</p>
                    <p className="font-medium whitespace-pre-wrap">{person.belongings || '-'}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Дані зниклого</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">Немає даних про зниклих</p>
              </CardContent>
            </Card>
          )}

          {/* Additional Search Information */}
          <Card>
            <CardHeader>
              <CardTitle>Інформація про пошук</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Додаткові області пошуку</p>
                {caseData.additional_search_regions && caseData.additional_search_regions.length > 0 ? (
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
                ) : (
                  <p className="font-medium">-</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600">Тип місцевості пошуку</p>
                <p className="font-medium">{caseData.search_terrain_type || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Первинна інформація</p>
                <p className="font-medium whitespace-pre-wrap">{caseData.initial_info || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Обставини зникнення</p>
                <p className="font-medium whitespace-pre-wrap">{caseData.disappearance_circumstances || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Додаткова інформація</p>
                <p className="font-medium whitespace-pre-wrap">{caseData.additional_info || '-'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Police Information */}
          <Card>
            <CardHeader>
              <CardTitle>Поліція</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Заява до поліції</p>
                <p className="font-medium">{caseData.police_report_filed ? 'Так' : 'Ні'}</p>
              </div>
              {caseData.police_report_date && (
                <div>
                  <p className="text-sm text-gray-600">Дата заяви</p>
                  <p className="font-medium">{formatDate(caseData.police_report_date)}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Райвідділок</p>
                <p className="font-medium">{caseData.police_department || '-'}</p>
              </div>
              {caseData.police_contact && (
                <div>
                  <p className="text-sm text-gray-600">Зв'язок з поліцією</p>
                  <p className="font-medium">{caseData.police_contact.full_name}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {(caseData.notes_text || (caseData.notes_images && caseData.notes_images.length > 0)) && (
            <Card>
              <CardHeader>
                <CardTitle>Примітки</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {caseData.notes_text && (
                  <div>
                    <p className="text-sm text-gray-600">Текст</p>
                    <p className="font-medium whitespace-pre-wrap">{caseData.notes_text}</p>
                  </div>
                )}
                {caseData.notes_images && caseData.notes_images.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Зображення ({caseData.notes_images.length})</p>
                    <div className="grid grid-cols-2 gap-2">
                      {caseData.notes_images.map((imageUrl, index) => (
                        <a
                          key={index}
                          href={imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={imageUrl}
                            alt={`Примітка ${index + 1}`}
                            className="w-full h-40 object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
                      <div className="mb-2">
                        <p className="font-medium">Пошук #{search.id}</p>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>
                          Статус:{' '}
                          {search.status === 'planned' && 'Запланований'}
                          {search.status === 'active' && 'Активний'}
                          {search.status === 'completed' && 'Завершений'}
                          {search.status === 'cancelled' && 'Скасований'}
                        </p>
                        {search.start_date && <p>Розпочато: {formatDate(search.start_date)}</p>}
                        {search.end_date && <p>Завершено: {formatDate(search.end_date)}</p>}
                        {search.result && (
                          <p>
                            Результат:{' '}
                            {search.result === 'alive' && 'Живий'}
                            {search.result === 'dead' && 'Виявлено'}
                            {search.result === 'location_known' && 'Місцезнаходження відомо'}
                            {search.result === 'not_found' && 'Пошук припинено'}
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Видалити заявку?</h3>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Ця дія незворотна. Буде видалено:
              </p>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                <li>Заявку #{caseData.id}</li>
                <li>Усі пов'язані пошуки</li>
                <li>Орієнтування та експортовані файли</li>
                <li>Роздачі листівок</li>
                <li>Сітки карт</li>
                <li>Виходи в поле</li>
                <li>Події та медіа-файли</li>
              </ul>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setShowDeleteModal(false)}
                variant="outline"
                fullWidth
                disabled={deleteMutation.isPending}
              >
                Скасувати
              </Button>
              <Button
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700 text-white"
                fullWidth
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Видалення...' : 'Видалити'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
