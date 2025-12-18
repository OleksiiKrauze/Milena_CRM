import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { searchesApi } from '@/api/searches';
import { usersApi } from '@/api/users';
import { casesApi } from '@/api/cases';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Input, Button, Loading } from '@/components/ui';
import type { SearchCreate } from '@/types/api';
import { useState } from 'react';

interface CreateSearchForm {
  initiator_inforg_id: string;
  start_date: string;
  end_date: string;
  result: string;
  result_comment: string;
  status: string;
  notes: string;
}

export function CreateSearchPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState<string>('');

  const { register, handleSubmit, formState: { errors } } = useForm<CreateSearchForm>({
    defaultValues: {
      status: 'planned',
      result: '',
    },
  });

  // Get case details
  const { data: caseData, isLoading: caseLoading } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => casesApi.get(Number(caseId)),
    enabled: !!caseId,
  });

  // Get users for initiator select
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateSearchForm) => {
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

      const searchData: SearchCreate = {
        case_id: Number(caseId),
        ...cleanedData,
      };

      return searchesApi.create(searchData);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['searches'] });
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['case-full', caseId] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      navigate(`/searches/${data.id}`);
    },
    onError: (error: any) => {
      setApiError(error.response?.data?.error?.message || error.message || 'Помилка створення пошуку');
    },
  });

  const onSubmit = (data: CreateSearchForm) => {
    setApiError('');
    createMutation.mutate(data);
  };

  if (caseLoading || usersLoading) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Створити пошук" showBack />
        <Container className="py-6">
          <Loading text="Завантаження..." />
        </Container>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Створити пошук" showBack />
        <Container className="py-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">Заявка не знайдена</p>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-nav">
      <Header title="Створити пошук" showBack />

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
                <span className="font-medium">#{caseData.id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Зниклий:</span>
                <span className="font-medium">{caseData.missing_full_name}</span>
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
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Створення...' : 'Створити пошук'}
          </Button>
        </form>
      </Container>
    </div>
  );
}
