import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { organizationsApi } from '@/api/organizations';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Input, Button } from '@/components/ui';
import { ORGANIZATION_TYPES } from '@/constants/organizationTypes';
import { PRIORITY_REGIONS, OTHER_REGIONS } from '@/constants/regions';
import type { OrganizationCreate } from '@/types/api';

interface CreateOrganizationForm {
  name: string;
  type: string;
  region: string;
  city: string;
  address: string;
  contact_info: string;
  notes: string;
}

export function CreateOrganizationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState<string>('');

  const { register, handleSubmit, formState: { errors } } = useForm<CreateOrganizationForm>();

  const createMutation = useMutation({
    mutationFn: (data: CreateOrganizationForm) => {
      const organizationData: OrganizationCreate = {
        name: data.name,
        type: data.type,
        region: data.region || undefined,
        city: data.city || undefined,
        address: data.address || undefined,
        contact_info: data.contact_info || undefined,
        notes: data.notes || undefined,
      };

      return organizationsApi.create(organizationData);
    },
    onSuccess: (newOrganization) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      navigate(`/organizations/${newOrganization.id}`);
    },
    onError: (error: any) => {
      setApiError(error.response?.data?.error?.message || error.message || 'Помилка створення організації');
    },
  });

  const onSubmit = (data: CreateOrganizationForm) => {
    setApiError('');
    createMutation.mutate(data);
  };

  return (
    <div className="min-h-screen pb-nav">
      <Header title="Створити організацію" showBack />

      <Container className="py-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {apiError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{apiError}</p>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Основна інформація</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Назва організації"
                required
                {...register('name', {
                  required: 'Вкажіть назву організації',
                  minLength: { value: 2, message: 'Мінімум 2 символи' },
                })}
                placeholder="Наприклад: 8-й відділ поліції Шевченківського району"
                error={errors.name?.message}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Тип організації <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('type', { required: 'Оберіть тип організації' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Оберіть тип</option>
                  {ORGANIZATION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {errors.type && (
                  <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Область
                </label>
                <select
                  {...register('region')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Оберіть область</option>
                  <optgroup label="Пріоритетні">
                    {PRIORITY_REGIONS.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Інші">
                    {OTHER_REGIONS.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <Input
                label="Населений пункт"
                {...register('city')}
                placeholder="Наприклад: Харків"
              />

              <Input
                label="Адреса"
                {...register('address')}
                placeholder="Наприклад: вул. Сумська, 1"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Контактна інформація</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Контактна інформація
                </label>
                <textarea
                  {...register('contact_info')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={5}
                  placeholder="Телефони, email, години роботи тощо&#10;Наприклад:&#10;+380 (57) 123-45-67&#10;email@example.com&#10;Пн-Пт: 9:00-18:00"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Додаткова інформація</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Коментар
                </label>
                <textarea
                  {...register('notes')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  placeholder="Додаткові нотатки про організацію..."
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => navigate('/organizations')}
            >
              Скасувати
            </Button>
            <Button
              type="submit"
              fullWidth
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Створення...' : 'Створити організацію'}
            </Button>
          </div>
        </form>
      </Container>
    </div>
  );
}
