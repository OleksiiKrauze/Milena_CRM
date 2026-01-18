import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { searchesApi } from '@/api/searches';
import { orientationsApi } from '@/api/orientations';
import { uploadApi } from '@/api/upload';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Badge, Loading, Button, getStatusBadgeVariant } from '@/components/ui';
import { formatDate, formatDateTime } from '@/utils/formatters';
import { useAuthStore } from '@/store/authStore';
import { hasPermission } from '@/utils/permissions';

export function SearchDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [uploadingOrientationId, setUploadingOrientationId] = useState<number | null>(null);
  const [isCreatingWithUpload, setIsCreatingWithUpload] = useState(false);
  const [showDeleteSearchConfirm, setShowDeleteSearchConfirm] = useState(false);

  const { data: searchData, isLoading, error } = useQuery({
    queryKey: ['search-full', id],
    queryFn: () => searchesApi.getFull(Number(id)),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: (orientationId: number) => orientationsApi.delete(orientationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-full', id] });
      setDeleteConfirmId(null);
    },
  });

  const deleteSearchMutation = useMutation({
    mutationFn: () => searchesApi.delete(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['searches'] });
      queryClient.invalidateQueries({ queryKey: ['case-full', searchData?.case_id.toString()] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      // Redirect to case page
      if (searchData?.case_id) {
        navigate(`/cases/${searchData.case_id}`);
      } else {
        navigate('/searches');
      }
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: async ({ orientationId, files }: { orientationId: number; files: File[] }) => {
      const uploadedUrls = await uploadApi.uploadImages(files);
      const orientation = searchData?.orientations?.find(o => o.id === orientationId);
      if (!orientation) throw new Error('Orientation not found');

      return orientationsApi.update(orientationId, {
        uploaded_images: [...orientation.uploaded_images, ...uploadedUrls],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-full', id] });
      setUploadingOrientationId(null);
    },
    onError: (error) => {
      console.error('Failed to upload images:', error);
      alert('Помилка завантаження зображень');
      setUploadingOrientationId(null);
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: async ({ orientationId, imageUrl, isExported }: { orientationId: number; imageUrl: string; isExported: boolean }) => {
      const orientation = searchData?.orientations?.find(o => o.id === orientationId);
      if (!orientation) throw new Error('Orientation not found');

      // Delete from server
      const filename = imageUrl.split('/').pop();
      if (filename) {
        await uploadApi.deleteImage(filename);
      }

      // Update orientation - remove from appropriate array
      if (isExported) {
        return orientationsApi.update(orientationId, {
          exported_files: orientation.exported_files.filter(url => url !== imageUrl),
        });
      } else {
        return orientationsApi.update(orientationId, {
          uploaded_images: orientation.uploaded_images.filter(url => url !== imageUrl),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-full', id] });
    },
    onError: (error) => {
      console.error('Failed to delete image:', error);
      alert('Помилка видалення зображення');
    },
  });

  const createOrientationWithUploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      // Create new orientation
      const newOrientation = await orientationsApi.create({
        search_id: Number(id),
        is_approved: false,
      });

      // Upload images
      const uploadedUrls = await uploadApi.uploadImages(files);

      // Update orientation with uploaded images
      return orientationsApi.update(newOrientation.id, {
        uploaded_images: uploadedUrls,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-full', id] });
      setIsCreatingWithUpload(false);
    },
    onError: (error) => {
      console.error('Failed to create orientation with upload:', error);
      alert('Помилка створення орієнтування');
      setIsCreatingWithUpload(false);
    },
  });

  const handleDeleteOrientation = (orientationId: number) => {
    deleteMutation.mutate(orientationId);
  };

  const handleUploadImages = (orientationId: number, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    setUploadingOrientationId(orientationId);
    uploadImageMutation.mutate({ orientationId, files: fileArray });
  };

  const handleDeleteImage = (orientationId: number, imageUrl: string, isExported: boolean) => {
    if (confirm('Видалити це зображення?')) {
      deleteImageMutation.mutate({ orientationId, imageUrl, isExported });
    }
  };

  const handleCreateWithUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        const fileArray = Array.from(target.files);
        setIsCreatingWithUpload(true);
        createOrientationWithUploadMutation.mutate(fileArray);
      }
    };
    input.click();
  };

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
      case 'dead': return 'Виявлено';
      case 'location_known': return 'Місцезнаходження відомо';
      case 'not_found': return 'Пошук припинено';
      default: return result;
    }
  };

  return (
    <div className="min-h-screen pb-nav">
      <Header title={`Пошук #${searchData.id}`} showBack />

      <Container className="py-6">
        <div className="space-y-4">
          {/* Edit and Delete Buttons */}
          {(hasPermission(user, 'searches:update') || hasPermission(user, 'searches:delete')) && (
            <div className="flex gap-2">
              {hasPermission(user, 'searches:update') && (
                <Button
                  onClick={() => navigate(`/searches/${searchData.id}/edit`)}
                  fullWidth
                  variant="outline"
                >
                  Редагувати пошук
                </Button>
              )}
              {hasPermission(user, 'searches:delete') && (
                <Button
                  onClick={() => setShowDeleteSearchConfirm(true)}
                  fullWidth
                  variant="outline"
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
                  Видалити пошук
                </Button>
              )}
            </div>
          )}

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
              {searchData.case && (
                <>
                  <div>
                    <p className="text-sm text-gray-600">ПІБ заявника</p>
                    <p className="font-medium">{searchData.case.applicant_full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">ПІБ зниклого</p>
                    <p className="font-medium">{searchData.case.missing_full_name}</p>
                  </div>
                </>
              )}
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

          {/* Orientations */}
          <Card>
            <CardHeader>
              <div className="space-y-2">
                <CardTitle>Орієнтування ({searchData.orientations?.length || 0})</CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => navigate(`/searches/${searchData.id}/create-orientation`)}
                    fullWidth
                  >
                    🎨 Створити в конструкторі
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCreateWithUpload}
                    fullWidth
                    disabled={isCreatingWithUpload}
                    variant="outline"
                    className="border-blue-600 text-blue-600 hover:bg-blue-50"
                  >
                    {isCreatingWithUpload ? 'Завантаження...' : '📁 Завантажити готове'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!searchData.orientations || searchData.orientations.length === 0 ? (
                <p className="text-sm text-gray-600">Орієнтування не створено</p>
              ) : (
                <div className="space-y-3">
                  {searchData.orientations.map((orientation) => (
                    <div
                      key={orientation.id}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-medium">Орієнтування #{orientation.id}</p>
                        {orientation.is_approved && (
                          <Badge variant="success">Узгоджено</Badge>
                        )}
                      </div>

                      {/* Combined Gallery: Exported Files + Uploaded Images */}
                      {((orientation.exported_files && orientation.exported_files.length > 0) ||
                        (orientation.uploaded_images && orientation.uploaded_images.length > 0)) && (
                        <div className="mb-3">
                          <div className="grid grid-cols-2 gap-2">
                            {/* Exported Files from Constructor */}
                            {orientation.exported_files?.map((imageUrl, index) => (
                              <div key={`exported-${index}`} className="relative group">
                                <div className="relative">
                                  <img
                                    src={`${import.meta.env.VITE_API_URL || '/api'}${imageUrl}`}
                                    alt={`Орієнтування з конструктора ${index + 1}`}
                                    className="w-full rounded-lg border border-gray-300 hover:border-primary-500 transition-colors cursor-pointer"
                                    onClick={() => setSelectedImage(imageUrl)}
                                  />
                                  <div className="absolute top-1 left-1">
                                    <Badge variant="default" className="bg-purple-100 text-purple-800 text-xs">
                                      🎨 Конструктор
                                    </Badge>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteImage(orientation.id, imageUrl, true);
                                    }}
                                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700 shadow-md"
                                    title="Видалити"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            ))}

                            {/* Uploaded Images */}
                            {orientation.uploaded_images?.map((imageUrl, index) => (
                              <div key={`uploaded-${index}`} className="relative group">
                                <div className="relative">
                                  <img
                                    src={`${import.meta.env.VITE_API_URL || '/api'}${imageUrl}`}
                                    alt={`Завантажене зображення ${index + 1}`}
                                    className="w-full rounded-lg border border-gray-300 hover:border-primary-500 transition-colors cursor-pointer"
                                    onClick={() => setSelectedImage(imageUrl)}
                                  />
                                  <div className="absolute top-1 left-1">
                                    <Badge variant="default" className="bg-blue-100 text-blue-800 text-xs">
                                      📁 Завантажено
                                    </Badge>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteImage(orientation.id, imageUrl, false);
                                    }}
                                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700 shadow-md"
                                    title="Видалити"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1 text-sm text-gray-600 mb-3">
                        <p>Створено: {formatDateTime(orientation.created_at)}</p>
                        {orientation.selected_photos && orientation.selected_photos.length > 0 && (
                          <p>Фото: {orientation.selected_photos.length}</p>
                        )}
                        {orientation.exported_files && orientation.exported_files.length > 0 && (
                          <p>Експортовано файлів: {orientation.exported_files.length}</p>
                        )}
                        {orientation.uploaded_images && orientation.uploaded_images.length > 0 && (
                          <p>Завантажено зображень: {orientation.uploaded_images.length}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/searches/${searchData.id}/orientations/${orientation.id}`)}
                            fullWidth
                          >
                            Редагувати
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/searches/${searchData.id}/create-orientation?duplicate=${orientation.id}`)}
                            fullWidth
                          >
                            Редагувати як нове
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.multiple = true;
                              input.onchange = (e) => {
                                const target = e.target as HTMLInputElement;
                                handleUploadImages(orientation.id, target.files);
                              };
                              input.click();
                            }}
                            fullWidth
                            disabled={uploadingOrientationId === orientation.id}
                            className="text-blue-600 border-blue-600 hover:bg-blue-50"
                          >
                            {uploadingOrientationId === orientation.id ? 'Завантаження...' : '📁 Додати зображення'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteConfirmId(orientation.id)}
                            fullWidth
                            className="text-red-600 border-red-600 hover:bg-red-50"
                          >
                            Видалити
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Events */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Події ({searchData.events?.length || 0})</CardTitle>
                <Button
                  size="sm"
                  onClick={() => navigate(`/searches/${searchData.id}/create-event`)}
                >
                  + Додати подію
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!searchData.events || searchData.events.length === 0 ? (
                <p className="text-sm text-gray-600">Події не додано</p>
              ) : (
                <div className="space-y-3">
                  {searchData.events
                    .sort((a, b) => new Date(a.event_datetime).getTime() - new Date(b.event_datetime).getTime())
                    .map((event) => (
                    <div
                      key={event.id}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => navigate(`/events/${event.id}`)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-medium">{event.event_type}</p>
                        <span className="text-xs text-gray-500">
                          {formatDateTime(event.event_datetime)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{event.description}</p>
                      {event.media_files && event.media_files.length > 0 && (
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {event.media_files.slice(0, 5).map((mediaUrl, index) => (
                            <div
                              key={index}
                              className="relative aspect-square"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedImage(mediaUrl);
                              }}
                            >
                              <img
                                src={`${import.meta.env.VITE_API_URL || '/api'}${mediaUrl}`}
                                alt={`Медіафайл ${index + 1}`}
                                className="w-full h-full object-cover rounded-lg border border-gray-300 hover:border-primary-500 transition-colors cursor-pointer"
                              />
                            </div>
                          ))}
                          {event.media_files.length > 5 && (
                            <div className="aspect-square bg-gray-200 rounded-lg border border-gray-300 flex items-center justify-center text-sm text-gray-600 font-medium cursor-pointer hover:bg-gray-300 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedImage(event.media_files[5]);
                              }}
                            >
                              +{event.media_files.length - 5}
                            </div>
                          )}
                        </div>
                      )}
                      {event.created_by && (
                        <p className="text-xs text-gray-500 mt-2">
                          Додав: {event.created_by.full_name} • {formatDateTime(event.created_at)}
                        </p>
                      )}
                    </div>
                  ))}
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

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 text-white text-2xl font-bold hover:text-gray-300"
            >
              ×
            </button>
            <img
              src={`${import.meta.env.VITE_API_URL || '/api'}${selectedImage}`}
              alt="Орієнтування"
              className="w-full rounded-lg"
            />
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = `${import.meta.env.VITE_API_URL || '/api'}${selectedImage}`;
                  link.download = selectedImage.split('/').pop() || 'orientation.jpg';
                  link.click();
                }}
                fullWidth
              >
                Завантажити
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedImage(null)}
                fullWidth
              >
                Закрити
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div className="relative bg-white rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Видалити орієнтування?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Ця дія незворотна. Орієнтування буде видалено разом зі всіма пов'язаними файлами та даними.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmId(null)}
                fullWidth
              >
                Скасувати
              </Button>
              <Button
                onClick={() => handleDeleteOrientation(deleteConfirmId)}
                fullWidth
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Видалення...' : 'Видалити'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Search Confirmation Modal */}
      {showDeleteSearchConfirm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={() => setShowDeleteSearchConfirm(false)}
        >
          <div className="relative bg-white rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Видалити пошук?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Ця дія незворотна. Пошук буде видалено разом зі всіма пов'язаними орієнтуваннями, подіями, виїздами та іншими даними.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteSearchConfirm(false)}
                fullWidth
              >
                Скасувати
              </Button>
              <Button
                onClick={() => deleteSearchMutation.mutate()}
                fullWidth
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={deleteSearchMutation.isPending}
              >
                {deleteSearchMutation.isPending ? 'Видалення...' : 'Видалити'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
