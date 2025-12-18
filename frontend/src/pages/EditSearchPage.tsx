import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { searchesApi } from '@/api/searches';
import { usersApi } from '@/api/users';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Input, Button, Loading } from '@/components/ui';
import type { SearchUpdate } from '@/types/api';
import { useState, useEffect } from 'react';

interface EditSearchForm {
  initiator_inforg_id: string;
  start_date: string;
  end_date: string;
  result: string;
  result_comment: string;
  status: string;
  notes: string;
}

export function EditSearchPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState<string>('');

  const { register, handleSubmit, formState: { errors }, reset } = useForm<EditSearchForm>();

  // Get search details
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['search', id],
    queryFn: () => searchesApi.get(Number(id)),
    enabled: !!id,
  });

  // Get users for initiator select
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  // Populate form with existing data
  useEffect(() => {
    if (searchData) {
      reset({
        initiator_inforg_id: searchData.initiator_inforg_id?.toString() || '',
        start_date: searchData.start_date || '',
        end_date: searchData.end_date || '',
        result: searchData.result || '',
        result_comment: searchData.result_comment || '',
        status: searchData.status || 'planned',
        notes: searchData.notes || '',
      });
    }
  }, [searchData, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: EditSearchForm) => {
      const cleanedData: any = {};

      // Convert empty strings to undefined for optional fields
      for (const [key, value] of Object.entries(data)) {
        if (value === '') {
          cleanedData[key] = undefined;
        } else {
          cleanedData[key] = value;
        }
      }

      // Convert initiator_inforg_id to number
      if (cleanedData.initiator_inforg_id) {
        cleanedData.initiator_inforg_id = Number(cleanedData.initiator_inforg_id);
      }

      const searchUpdate: SearchUpdate = cleanedData;

      return searchesApi.update(Number(id), searchUpdate);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['search', id] });
      queryClient.invalidateQueries({ queryKey: ['search-full', id] });
      queryClient.invalidateQueries({ queryKey: ['searches'] });
      queryClient.invalidateQueries({ queryKey: ['case-full', data.case_id.toString()] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      navigate(`/searches/${data.id}`);
    },
    onError: (error: any) => {
      setApiError(error.response?.data?.error?.message || error.message || 'Помилка оновлення пошуку');
    },
  });

  const onSubmit = (data: EditSearchForm) => {
    setApiError('');
    updateMutation.mutate(data);
  };

  if (searchLoading || usersLoading) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Редагувати пошук" showBack />
        <Container className="py-6">
          <Loading text="Завантаження..." />
        </Container>
      </div>
    );
  }

  if (!searchData) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Редагувати пошук" showBack />
        <Container className="py-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">Пошук не знайдений</p>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-nav">
      <Header title={`Редагувати пошук #${searchData.id}`} showBack />

      <Container className="py-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Case info */}
          <Card>
            <CardHeader>
              <CardTitle>Заявка</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Номер:</span>
                <span
                  className="font-medium text-primary-600 hover:underline cursor-pointer"
                  onClick={() => navigate(`/cases/${searchData.case_id}`)}
                >
                  #{searchData.case_id}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Search info */}
          <Card>
            <CardHeader>
              <CardTitle>Інформація про пошук</CardTitle>
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

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Статус <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('status', { required: 'Статус обов\'язковий' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="planned">Запланований</option>
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

              {/* Result */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Результат
                </label>
                <select
                  {...register('result')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Не визначено</option>
                  <option value="alive">Живий</option>
                  <option value="dead">Мертвий</option>
                  <option value="location_known">Місцезнаходження відомо</option>
                  <option value="not_found">Не знайдений</option>
                </select>
              </div>

              {/* Result comment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Коментар до результату
                </label>
                <textarea
                  {...register('result_comment')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Детальний опис результату пошуку"
                />
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
                  placeholder="Додаткова інформація про пошук"
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
