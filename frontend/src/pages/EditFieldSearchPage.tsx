import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { fieldSearchesApi } from '@/api/field-searches';
import { usersApi } from '@/api/users';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Input, Button, Loading } from '@/components/ui';
import type { FieldSearchUpdate } from '@/api/field-searches';
import { useState } from 'react';

interface EditFieldSearchForm {
  initiator_inforg_id: string;
  start_date: string;
  meeting_datetime: string;
  meeting_place: string;
  coordinator_id: string;
  status: string;
  end_date: string;
  result: string;
  notes: string;
}

export function EditFieldSearchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const [apiError, setApiError] = useState<string>('');

  // Get field search details
  const { data: fieldSearchData, isLoading: fieldSearchLoading } = useQuery({
    queryKey: ['field-search', id],
    queryFn: () => fieldSearchesApi.get(Number(id)),
    enabled: !!id,
  });

  const { register, handleSubmit, formState: { errors } } = useForm<EditFieldSearchForm>({
    values: fieldSearchData ? {
      initiator_inforg_id: fieldSearchData.initiator_inforg_id?.toString() || '',
      start_date: fieldSearchData.start_date || '',
      meeting_datetime: fieldSearchData.meeting_datetime || '',
      meeting_place: fieldSearchData.meeting_place || '',
      coordinator_id: fieldSearchData.coordinator_id?.toString() || '',
      status: fieldSearchData.status || 'planning',
      end_date: fieldSearchData.end_date || '',
      result: fieldSearchData.result || '',
      notes: fieldSearchData.notes || '',
    } : undefined,
  });

  // Get users for initiator and coordinator select
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  const updateMutation = useMutation({
    mutationFn: (data: EditFieldSearchForm) => {
      const cleanedData: any = {};

      // Convert empty strings to undefined for optional fields
      for (const [key, value] of Object.entries(data)) {
        if (value === '') {
          cleanedData[key] = undefined;
        } else {
          cleanedData[key] = value;
        }
      }

      // Convert IDs to numbers
      if (cleanedData.initiator_inforg_id) {
        cleanedData.initiator_inforg_id = Number(cleanedData.initiator_inforg_id);
      }
      if (cleanedData.coordinator_id) {
        cleanedData.coordinator_id = Number(cleanedData.coordinator_id);
      }

      const fieldSearchUpdateData: FieldSearchUpdate = cleanedData;

      return fieldSearchesApi.update(Number(id), fieldSearchUpdateData);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['field-searches'] });
      queryClient.invalidateQueries({ queryKey: ['field-search', id] });
      if (fieldSearchData?.search_id) {
        queryClient.invalidateQueries({ queryKey: ['search', fieldSearchData.search_id.toString()] });
        queryClient.invalidateQueries({ queryKey: ['search-full', fieldSearchData.search_id.toString()] });
      }
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      navigate(`/field-searches/${data.id}`);
    },
    onError: (error: any) => {
      setApiError(error.response?.data?.error?.message || error.message || 'Помилка оновлення виїзду');
    },
  });

  const onSubmit = (data: EditFieldSearchForm) => {
    setApiError('');
    updateMutation.mutate(data);
  };

  if (fieldSearchLoading || usersLoading) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Редагувати виїзд" showBack />
        <Container className="py-6">
          <Loading text="Завантаження..." />
        </Container>
      </div>
    );
  }

  if (!fieldSearchData) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Редагувати виїзд" showBack />
        <Container className="py-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">Виїзд не знайдено</p>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-nav">
      <Header title={`Редагувати виїзд #${id}`} showBack />

      <Container className="py-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Search Info */}
          {fieldSearchData.search && (
            <Card>
              <CardHeader>
                <CardTitle>Пошук</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-blue-50 rounded-lg space-y-1">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Пошук:</span> №{fieldSearchData.search_id}
                  </p>
                  {fieldSearchData.case_id && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Заявка:</span> №{fieldSearchData.case_id}
                    </p>
                  )}
                  {fieldSearchData.search.case && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Зниклий:</span> {fieldSearchData.search.case.missing_full_name}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Field Search Info */}
          <Card>
            <CardHeader>
              <CardTitle>Інформація про виїзд</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Initiator */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ініціатор (інфорг)
                </label>
                <select
                  {...register('initiator_inforg_id')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Не вказано</option>
                  {usersData?.users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Coordinator */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Координатор
                </label>
                <select
                  {...register('coordinator_id')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Не вказано</option>
                  {usersData?.users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Статус <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('status', { required: 'Статус обов\'язковий' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="planning">Планування</option>
                  <option value="prepared">Підготовлено</option>
                  <option value="active">Активний</option>
                  <option value="completed">Завершений</option>
                  <option value="cancelled">Скасований</option>
                </select>
                {errors.status && (
                  <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
                )}
              </div>

              {/* Dates */}
              <Input
                label="Дата початку"
                type="date"
                {...register('start_date')}
                error={errors.start_date?.message}
              />

              <Input
                label="Дата завершення"
                type="date"
                {...register('end_date')}
                error={errors.end_date?.message}
              />

              <Input
                label="Дата та час збору"
                type="datetime-local"
                {...register('meeting_datetime')}
                error={errors.meeting_datetime?.message}
              />

              <Input
                label="Місце збору"
                placeholder="вул. Хрещатик, 1, біля метро"
                {...register('meeting_place')}
                error={errors.meeting_place?.message}
              />

              {/* Result */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Результат
                </label>
                <select
                  {...register('result')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Не вказано</option>
                  <option value="alive">Живий</option>
                  <option value="dead">Мертвий</option>
                  <option value="location_known">Місцезнаходження відомо</option>
                  <option value="not_found">Не знайдений</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Примітки
                </label>
                <textarea
                  {...register('notes')}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Додаткова інформація про виїзд"
                />
              </div>
            </CardContent>
          </Card>

          {/* Error message */}
          {apiError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{apiError}</p>
            </div>
          )}

          {/* Submit button */}
          <Button
            type="submit"
            fullWidth
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Збереження...' : 'Зберегти зміни'}
          </Button>
        </form>
      </Container>
    </div>
  );
}
