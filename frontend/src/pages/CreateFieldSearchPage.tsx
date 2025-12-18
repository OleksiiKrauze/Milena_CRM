import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { fieldSearchesApi } from '@/api/field-searches';
import { searchesApi } from '@/api/searches';
import { usersApi } from '@/api/users';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Input, Button, Loading } from '@/components/ui';
import type { FieldSearchCreate } from '@/api/field-searches';
import { useState } from 'react';

interface CreateFieldSearchForm {
  initiator_inforg_id: string;
  start_date: string;
  meeting_datetime: string;
  meeting_place: string;
  coordinator_id: string;
  status: string;
  notes: string;
}

export function CreateFieldSearchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { searchId } = useParams<{ searchId: string }>();
  const [apiError, setApiError] = useState<string>('');

  const { register, handleSubmit, formState: { errors } } = useForm<CreateFieldSearchForm>({
    defaultValues: {
      status: 'planning',
    },
  });

  // Get search details
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['search', searchId],
    queryFn: () => searchesApi.get(Number(searchId)),
    enabled: !!searchId,
  });

  // Get users for initiator and coordinator select
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateFieldSearchForm) => {
      const cleanedData: any = {
        search_id: Number(searchId),
      };

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

      const fieldSearchData: FieldSearchCreate = cleanedData;

      return fieldSearchesApi.create(fieldSearchData);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['field-searches'] });
      queryClient.invalidateQueries({ queryKey: ['search', searchId] });
      queryClient.invalidateQueries({ queryKey: ['search-full', searchId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      navigate(`/field-searches/${data.id}`);
    },
    onError: (error: any) => {
      setApiError(error.response?.data?.error?.message || error.message || 'Помилка створення виїзду');
    },
  });

  const onSubmit = (data: CreateFieldSearchForm) => {
    setApiError('');
    createMutation.mutate(data);
  };

  if (searchLoading || usersLoading) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Створити виїзд" showBack />
        <Container className="py-6">
          <Loading text="Завантаження..." />
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-nav">
      <Header title="Створити виїзд на місцевість" showBack />

      <Container className="py-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Search Info */}
          {searchData && (
            <Card>
              <CardHeader>
                <CardTitle>Пошук</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-blue-50 rounded-lg space-y-1">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Пошук:</span> №{searchData.id}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Заявка:</span> №{searchData.case_id}
                  </p>
                  {searchData.case && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Зниклий:</span> {searchData.case.missing_full_name}
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
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Створення...' : 'Створити виїзд'}
          </Button>
        </form>
      </Container>
    </div>
  );
}
