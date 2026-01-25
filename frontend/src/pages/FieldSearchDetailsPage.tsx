import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { fieldSearchesApi } from '@/api/field-searches';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Badge, Loading, Button, getStatusBadgeVariant } from '@/components/ui';
import { formatDate, formatDateTime, getOriginalFilename } from '@/utils/formatters';
import { FileText } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { hasPermission } from '@/utils/permissions';

export function FieldSearchDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [isOrientationFullscreen, setIsOrientationFullscreen] = useState(false);

  const { data: fieldSearchData, isLoading, error } = useQuery({
    queryKey: ['field-search', id],
    queryFn: () => fieldSearchesApi.get(Number(id)),
    enabled: !!id,
  });

  const handleDownloadGrid = async () => {
    if (!id) return;

    try {
      const blob = await fieldSearchesApi.downloadGrid(Number(id));

      // Create a temporary URL for the blob
      const url = window.URL.createObjectURL(blob);

      // Create a temporary anchor element to trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = fieldSearchData?.preparation_grid_file?.split('/').pop() || 'grid.gpx';
      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error('Failed to download grid file:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Виїзд" showBack />
        <Container className="py-6">
          <Loading text="Завантаження виїзду..." />
        </Container>
      </div>
    );
  }

  if (error || !fieldSearchData) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Виїзд" showBack />
        <Container className="py-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">Помилка завантаження виїзду</p>
          </div>
        </Container>
      </div>
    );
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'planning': return 'Планування';
      case 'prepared': return 'Підготовлено';
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
      case 'dead': return 'Виявлено';
      case 'location_known': return 'Місцезнаходження відомо';
      case 'not_found': return 'Пошук припинено';
      case 'person_identified': return 'Особу встановлено';
      default: return result;
    }
  };

  return (
    <div className="min-h-screen pb-nav">
      <Header title={`Виїзд #${fieldSearchData.id}`} showBack />

      <Container className="py-6">
        <div className="space-y-4">
          {/* Edit Button */}
          {hasPermission(user, 'field_searches:update') && (
            <Button
              onClick={() => navigate(`/field-searches/${fieldSearchData.id}/edit`)}
              fullWidth
              variant="outline"
            >
              Редагувати виїзд
            </Button>
          )}

          {/* Main Info */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle>Основна інформація</CardTitle>
                <Badge variant={getStatusBadgeVariant(fieldSearchData.status)}>
                  {getStatusLabel(fieldSearchData.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Дата створення</p>
                <p className="font-medium">{formatDateTime(fieldSearchData.created_at)}</p>
              </div>
              {fieldSearchData.search && (
                <div>
                  <p className="text-sm text-gray-600">Пошук</p>
                  <p
                    className="font-medium text-primary-600 hover:underline cursor-pointer"
                    onClick={() => navigate(`/searches/${fieldSearchData.search_id}`)}
                  >
                    №{fieldSearchData.search_id}
                  </p>
                </div>
              )}
              {fieldSearchData.case_id && (
                <div>
                  <p className="text-sm text-gray-600">Заявка</p>
                  <p
                    className="font-medium text-primary-600 hover:underline cursor-pointer"
                    onClick={() => navigate(`/cases/${fieldSearchData.case_id}`)}
                  >
                    №{fieldSearchData.case_id}
                  </p>
                </div>
              )}
              {fieldSearchData.search?.case && (
                <div>
                  <p className="text-sm text-gray-600">Зниклий</p>
                  <p className="font-medium">{fieldSearchData.search.case.missing_full_name}</p>
                </div>
              )}
              {fieldSearchData.initiator_inforg && (
                <div>
                  <p className="text-sm text-gray-600">Ініціатор (інфорг)</p>
                  <p className="font-medium">{fieldSearchData.initiator_inforg.full_name}</p>
                </div>
              )}
              {fieldSearchData.coordinator && (
                <div>
                  <p className="text-sm text-gray-600">Координатор</p>
                  <p className="font-medium">{fieldSearchData.coordinator.full_name}</p>
                </div>
              )}
              {fieldSearchData.start_date && (
                <div>
                  <p className="text-sm text-gray-600">Дата початку</p>
                  <p className="font-medium">{formatDate(fieldSearchData.start_date)}</p>
                </div>
              )}
              {fieldSearchData.end_date && (
                <div>
                  <p className="text-sm text-gray-600">Дата завершення</p>
                  <p className="font-medium">{formatDate(fieldSearchData.end_date)}</p>
                </div>
              )}
              {fieldSearchData.meeting_datetime && (
                <div>
                  <p className="text-sm text-gray-600">Дата та час збору</p>
                  <p className="font-medium">{formatDateTime(fieldSearchData.meeting_datetime)}</p>
                </div>
              )}
              {fieldSearchData.meeting_place && (
                <div>
                  <p className="text-sm text-gray-600">Місце збору</p>
                  <p className="font-medium">{fieldSearchData.meeting_place}</p>
                </div>
              )}
              {fieldSearchData.result && (
                <div>
                  <p className="text-sm text-gray-600">Результат</p>
                  <p className="font-medium">{getResultLabel(fieldSearchData.result)}</p>
                </div>
              )}
              {fieldSearchData.notes && (
                <div>
                  <p className="text-sm text-gray-600">Примітки</p>
                  <p className="font-medium whitespace-pre-wrap">{fieldSearchData.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected Orientation */}
          {fieldSearchData.orientation && (
            <Card>
              <CardHeader>
                <CardTitle>Обране ориентування</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">Орієнтування #{fieldSearchData.orientation.id}</p>
                    {fieldSearchData.orientation.is_approved && (
                      <Badge variant="success">Узгоджено</Badge>
                    )}
                  </div>

                  {/* Combined gallery of images */}
                  {((fieldSearchData.orientation.exported_files && fieldSearchData.orientation.exported_files.length > 0) ||
                    (fieldSearchData.orientation.uploaded_images && fieldSearchData.orientation.uploaded_images.length > 0)) && (
                    <div className="grid grid-cols-2 gap-2">
                      {/* Exported Files from Constructor */}
                      {fieldSearchData.orientation.exported_files?.map((imageUrl, index) => (
                        <div key={`exported-${index}`} className="relative">
                          <img
                            src={`${import.meta.env.VITE_API_URL || '/api'}${imageUrl}`}
                            alt={`Орієнтування з конструктора ${index + 1}`}
                            className="w-full rounded-lg border border-gray-300 hover:border-primary-500 transition-colors cursor-pointer"
                            onClick={() => setIsOrientationFullscreen(true)}
                          />
                          <div className="absolute top-1 left-1">
                            <Badge variant="default" className="bg-purple-100 text-purple-800 text-xs">
                              🎨 Конструктор
                            </Badge>
                          </div>
                        </div>
                      ))}

                      {/* Uploaded Images */}
                      {fieldSearchData.orientation.uploaded_images?.map((imageUrl, index) => (
                        <div key={`uploaded-${index}`} className="relative">
                          <img
                            src={`${import.meta.env.VITE_API_URL || '/api'}${imageUrl}`}
                            alt={`Завантажене зображення ${index + 1}`}
                            className="w-full rounded-lg border border-gray-300 hover:border-primary-500 transition-colors cursor-pointer"
                            onClick={() => setIsOrientationFullscreen(true)}
                          />
                          <div className="absolute top-1 left-1">
                            <Badge variant="default" className="bg-blue-100 text-blue-800 text-xs">
                              📁 Завантажено
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-gray-500 mt-2">
                    Створено: {formatDateTime(fieldSearchData.orientation.created_at)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preparation Section */}
          {(fieldSearchData.preparation_grid_file || fieldSearchData.preparation_map_image) && (
            <Card>
              <CardHeader>
                <CardTitle>Підготовка</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fieldSearchData.preparation_grid_file && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Файл сітки квадратів</p>
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <FileText className="w-5 h-5 text-gray-600" />
                      <button
                        type="button"
                        onClick={handleDownloadGrid}
                        className="text-sm text-primary-600 hover:underline flex-1 text-left"
                      >
                        {fieldSearchData.preparation_grid_file.split('/').pop()}
                      </button>
                    </div>
                  </div>
                )}
                {fieldSearchData.preparation_map_image && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Карта</p>
                    <img
                      src={fieldSearchData.preparation_map_image}
                      alt="Карта"
                      className="w-full max-h-96 object-contain rounded-lg border border-gray-200"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Search Progress Section */}
          {(fieldSearchData.search_tracks?.length > 0 || fieldSearchData.search_photos?.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Хід пошуку</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fieldSearchData.search_tracks && fieldSearchData.search_tracks.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Треки ({fieldSearchData.search_tracks.length})</p>
                    <div className="space-y-2">
                      {fieldSearchData.search_tracks.map((track, index) => (
                        <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                          <FileText className="w-5 h-5 text-gray-600" />
                          <a
                            href={track}
                            download={getOriginalFilename(track)}
                            className="text-sm text-primary-600 hover:underline flex-1"
                          >
                            {getOriginalFilename(track)}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {fieldSearchData.search_photos && fieldSearchData.search_photos.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Фотографії ({fieldSearchData.search_photos.length})</p>
                    <div className="grid grid-cols-2 gap-2">
                      {fieldSearchData.search_photos.map((photo, index) => (
                        <a
                          key={index}
                          href={photo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={photo}
                            alt={`Фото ${index + 1}`}
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
        </div>

        {/* Fullscreen orientation image */}
        {isOrientationFullscreen && fieldSearchData?.orientation && (
          <div
            className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
            onClick={() => setIsOrientationFullscreen(false)}
          >
            <button
              onClick={() => setIsOrientationFullscreen(false)}
              className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 transition-colors"
              aria-label="Закрити"
            >
              ×
            </button>
            <img
              src={`${import.meta.env.VITE_API_URL || '/api'}${
                fieldSearchData.orientation.exported_files?.[0] ||
                fieldSearchData.orientation.uploaded_images?.[0]
              }`}
              alt="Ориентування"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </Container>
    </div>
  );
}
