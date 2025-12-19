import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { eventsApi } from '@/api/events';
import { searchesApi } from '@/api/searches';
import { uploadApi } from '@/api/upload';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Input, Button, Loading } from '@/components/ui';
import type { EventCreate } from '@/types/api';
import { useState } from 'react';

interface CreateEventForm {
  event_datetime: string;
  event_type: string;
  description: string;
}

export function CreateEventPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { searchId } = useParams<{ searchId: string }>();
  const [apiError, setApiError] = useState<string>('');
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<CreateEventForm>();

  // Get search details
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['search', searchId],
    queryFn: () => searchesApi.get(Number(searchId)),
    enabled: !!searchId,
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setApiError('');

    try {
      const fileArray = Array.from(files);
      const urls = await uploadApi.uploadMedia(fileArray);
      setUploadedFiles((prev) => [...prev, ...urls]);
    } catch (error: any) {
      setApiError(error.message || 'Помилка завантаження файлів');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateEventForm) => {
      const eventData: EventCreate = {
        search_id: Number(searchId),
        event_datetime: data.event_datetime,
        event_type: data.event_type,
        description: data.description,
        media_files: uploadedFiles,
      };

      return eventsApi.create(eventData);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['search', searchId] });
      queryClient.invalidateQueries({ queryKey: ['search-full', searchId] });
      navigate(`/searches/${searchId}`);
    },
    onError: (error: any) => {
      setApiError(error.response?.data?.error?.message || error.message || 'Помилка створення події');
    },
  });

  const onSubmit = (data: CreateEventForm) => {
    setApiError('');
    createMutation.mutate(data);
  };

  if (searchLoading) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Додати подію" showBack />
        <Container className="py-6">
          <Loading text="Завантаження..." />
        </Container>
      </div>
    );
  }

  if (!searchData) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Додати подію" showBack />
        <Container className="py-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">Пошук не знайдено</p>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-nav">
      <Header title="Додати подію" showBack />

      <Container className="py-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {apiError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{apiError}</p>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Інформація про подію</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Пошук</p>
                <p className="font-medium">Пошук #{searchData.id}</p>
              </div>

              <Input
                label="Тип події"
                {...register('event_type', { required: 'Вкажіть тип події' })}
                placeholder="Наприклад: Показання свідка, Фото, Відео, Дзвінок..."
                error={errors.event_type?.message}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Дата та час події <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  {...register('event_datetime', { required: 'Вкажіть дату та час події' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.event_datetime && (
                  <p className="mt-1 text-sm text-red-600">{errors.event_datetime.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Опис події <span className="text-red-500">*</span>
                </label>
                <textarea
                  {...register('description', { required: 'Опишіть подію' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={6}
                  placeholder="Детальний опис події: що сталося, хто був присутній, що було виявлено тощо..."
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Медіа файли (фото, відео, аудіо)
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Макс. розмір файлу: 50 МБ. Макс. кількість: 10 файлів
                </p>
                {uploading && (
                  <p className="mt-2 text-sm text-primary-600">Завантаження файлів...</p>
                )}
              </div>

              {uploadedFiles.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Завантажені файли ({uploadedFiles.length})
                  </p>
                  <div className="space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-lg"
                      >
                        <span className="text-sm text-gray-600 truncate flex-1">
                          {file.split('/').pop()}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="ml-2 text-red-600 hover:text-red-800"
                        >
                          Видалити
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => navigate(`/searches/${searchId}`)}
            >
              Скасувати
            </Button>
            <Button
              type="submit"
              fullWidth
              disabled={createMutation.isPending || uploading}
            >
              {createMutation.isPending ? 'Створення...' : 'Створити подію'}
            </Button>
          </div>
        </form>
      </Container>
    </div>
  );
}
