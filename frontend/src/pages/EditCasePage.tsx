import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { casesApi } from '@/api/cases';
import { uploadApi } from '@/api/upload';
import { Header } from '@/components/layout/Header';
import { Container, Button, Input, Card, CardContent, Loading } from '@/components/ui';
import { X, Upload } from 'lucide-react';

const editCaseSchema = z.object({
  // Applicant - split name fields
  applicant_last_name: z.string().min(2, 'Мінімум 2 символи'),
  applicant_first_name: z.string().min(2, 'Мінімум 2 символи'),
  applicant_middle_name: z.string().optional(),
  applicant_phone: z.string().optional(),
  applicant_relation: z.string().optional(),
  // Missing person - location fields
  missing_settlement: z.string().optional(),
  missing_region: z.string().optional(),
  missing_address: z.string().optional(),
  // Missing person - split name fields
  missing_last_name: z.string().min(2, 'Мінімум 2 символи'),
  missing_first_name: z.string().min(2, 'Мінімум 2 символи'),
  missing_middle_name: z.string().optional(),
  missing_gender: z.string().optional(),
  missing_birthdate: z.string().optional(),
  missing_last_seen_datetime: z.string().optional(),
  missing_last_seen_place: z.string().optional(),
  missing_description: z.string().optional(),
  missing_special_signs: z.string().optional(),
  missing_diseases: z.string().optional(),
  missing_phone: z.string().optional(),
  missing_clothing: z.string().optional(),
  missing_belongings: z.string().optional(),
  // Additional case information
  additional_search_regions: z.string().optional(),
  police_report_filed: z.boolean().optional().default(false),
  search_terrain_type: z.string().optional(),
  initial_info: z.string().optional(),
  disappearance_circumstances: z.string().optional(),
  additional_info: z.string().optional(),
  // Case metadata
  decision_type: z.string().optional().default('На розгляді'),
  decision_comment: z.string().optional(),
  tags: z.string().optional(),
});

export function EditCasePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState<string | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const { data: caseData, isLoading } = useQuery({
    queryKey: ['case', id],
    queryFn: () => casesApi.get(Number(id)),
    enabled: !!id,
  });

  const form: any = useForm({
    resolver: zodResolver(editCaseSchema) as any,
    defaultValues: {
      police_report_filed: false,
      decision_type: 'На розгляді',
    },
  });
  const { register, handleSubmit, formState, reset } = form;
  const errors = formState.errors;

  // Populate form when data loads
  useEffect(() => {
    if (caseData) {
      reset({
        applicant_last_name: caseData.applicant_last_name,
        applicant_first_name: caseData.applicant_first_name,
        applicant_middle_name: caseData.applicant_middle_name || '',
        applicant_phone: caseData.applicant_phone || '',
        applicant_relation: caseData.applicant_relation || '',
        missing_settlement: caseData.missing_settlement || '',
        missing_region: caseData.missing_region || '',
        missing_address: caseData.missing_address || '',
        missing_last_name: caseData.missing_last_name,
        missing_first_name: caseData.missing_first_name,
        missing_middle_name: caseData.missing_middle_name || '',
        missing_gender: caseData.missing_gender || '',
        missing_birthdate: caseData.missing_birthdate ? caseData.missing_birthdate.split('T')[0] : '',
        missing_last_seen_datetime: caseData.missing_last_seen_datetime
          ? caseData.missing_last_seen_datetime.substring(0, 16)
          : '',
        missing_last_seen_place: caseData.missing_last_seen_place || '',
        missing_description: caseData.missing_description || '',
        missing_special_signs: caseData.missing_special_signs || '',
        missing_diseases: caseData.missing_diseases || '',
        decision_type: caseData.decision_type,
        decision_comment: caseData.decision_comment || '',
        tags: caseData.tags.join(', '),
      });
      setUploadedPhotos(caseData.missing_photos || []);
    }
  }, [caseData, reset]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setApiError(null);

    try {
      const filesArray = Array.from(files);
      const uploadedUrls = await uploadApi.uploadImages(filesArray);
      setUploadedPhotos((prev) => [...prev, ...uploadedUrls]);
    } catch (error: any) {
      setApiError(error.message || 'Помилка завантаження фото');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (photoUrl: string) => {
    setUploadedPhotos((prev) => prev.filter((url) => url !== photoUrl));
  };

  const updateMutation = useMutation({
    mutationFn: (data: any) => {
      const { tags, additional_search_regions, ...rest } = data;

      // Convert empty strings to undefined for optional fields
      const cleanedData: any = {};
      for (const [key, value] of Object.entries(rest)) {
        if (value === '') {
          cleanedData[key] = undefined;
        } else {
          cleanedData[key] = value;
        }
      }

      return casesApi.update(Number(id), {
        ...cleanedData,
        missing_photos: uploadedPhotos,
        tags: tags ? tags.split(',').map((t: any) => t.trim()).filter(Boolean) : [],
        additional_search_regions: additional_search_regions
          ? additional_search_regions.split(',').map((r: any) => r.trim()).filter(Boolean)
          : [],
      });
    },
    onSuccess: (data) => {
      // Invalidate cache to refresh data
      queryClient.invalidateQueries({ queryKey: ['case', id] });
      queryClient.invalidateQueries({ queryKey: ['case-full', id] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      navigate(`/cases/${data.id}`);
    },
    onError: (error: any) => {
      setApiError(error.message || 'Помилка при оновленні заявки');
    },
  });

  const onSubmit = (data: any) => {
    setApiError(null);
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Редагувати заявку" showBack />
        <Container className="py-6">
          <Loading text="Завантаження заявки..." />
        </Container>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Редагувати заявку" showBack />
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
      <Header title={`Редагувати заявку #${id}`} showBack />

      <Container className="py-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Applicant Info */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold text-gray-900 mb-4">Дані заявника</h3>

              <Input
                label="Прізвище заявника"
                placeholder="Шевченко"
                error={errors.applicant_last_name?.message}
                {...register('applicant_last_name')}
                required
              />

              <Input
                label="Ім'я заявника"
                placeholder="Тарас"
                error={errors.applicant_first_name?.message}
                {...register('applicant_first_name')}
                required
              />

              <Input
                label="По батькові заявника (необов'язково)"
                placeholder="Григорович"
                error={errors.applicant_middle_name?.message}
                {...register('applicant_middle_name')}
              />

              <Input
                label="Телефон заявника"
                type="tel"
                placeholder="+380991234567"
                error={errors.applicant_phone?.message}
                {...register('applicant_phone')}
              />

              <Input
                label="Ким приходиться пропавший"
                placeholder="Мати, батько, друг..."
                error={errors.applicant_relation?.message}
                {...register('applicant_relation')}
              />
            </CardContent>
          </Card>

          {/* Missing Person Info */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold text-gray-900 mb-4">Дані пропавшого</h3>

              <Input
                label="Населений пункт"
                placeholder="Київ"
                error={errors.missing_settlement?.message}
                {...register('missing_settlement')}
              />

              <Input
                label="Область"
                placeholder="Київська область"
                error={errors.missing_region?.message}
                {...register('missing_region')}
              />

              <Input
                label="Адреса проживання"
                placeholder="вул. Хрещатик, буд. 1, кв. 5"
                error={errors.missing_address?.message}
                {...register('missing_address')}
              />

              <Input
                label="Прізвище пропавшого"
                placeholder="Коваль"
                error={errors.missing_last_name?.message}
                {...register('missing_last_name')}
                required
              />

              <Input
                label="Ім'я пропавшого"
                placeholder="Іван"
                error={errors.missing_first_name?.message}
                {...register('missing_first_name')}
                required
              />

              <Input
                label="По батькові пропавшого (необов'язково)"
                placeholder="Петрович"
                error={errors.missing_middle_name?.message}
                {...register('missing_middle_name')}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Стать
                </label>
                <select
                  {...register('missing_gender')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Не вказано</option>
                  <option value="чоловіча">Чоловіча</option>
                  <option value="жіноча">Жіноча</option>
                </select>
                {errors.missing_gender && (
                  <p className="text-sm text-red-600 mt-1">{errors.missing_gender.message}</p>
                )}
              </div>

              <Input
                label="Дата народження"
                type="date"
                error={errors.missing_birthdate?.message}
                {...register('missing_birthdate')}
              />

              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Фото пропавшого
                </label>

                {/* Upload Button */}
                <div className="mb-3">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                    <Upload className="h-4 w-4" />
                    <span>{isUploading ? 'Завантаження...' : 'Додати фото'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={isUploading}
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Можна завантажити декілька фото. Максимум 10 файлів, до 10 МБ кожен.
                  </p>
                </div>

                {/* Photo Previews */}
                {uploadedPhotos.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {uploadedPhotos.map((photoUrl, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={photoUrl}
                          alt={`Фото ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(photoUrl)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Input
                label="Дата та час коли бачили востаннє"
                type="datetime-local"
                error={errors.missing_last_seen_datetime?.message}
                {...register('missing_last_seen_datetime')}
              />

              <Input
                label="Останнє місце, де бачили"
                placeholder="м. Київ, вул. Хрещатик, буд. 1"
                error={errors.missing_last_seen_place?.message}
                {...register('missing_last_seen_place')}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Опис (зріст, тілобудова, одяг тощо)
                </label>
                <textarea
                  {...register('missing_description')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  placeholder="Зріст 175 см, худорлявої статури, була в синій куртці..."
                />
                {errors.missing_description && (
                  <p className="text-sm text-red-600 mt-1">{errors.missing_description.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Особливі прикмети (шрами, татуювання, особливості)
                </label>
                <textarea
                  {...register('missing_special_signs')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={2}
                  placeholder="Татуювання на лівому плечі, шрам на правій щоці..."
                />
                {errors.missing_special_signs && (
                  <p className="text-sm text-red-600 mt-1">{errors.missing_special_signs.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Захворювання (якщо є важливі діагнози)
                </label>
                <textarea
                  {...register('missing_diseases')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={2}
                  placeholder="Діабет, деменція, епілепсія..."
                />
                {errors.missing_diseases && (
                  <p className="text-sm text-red-600 mt-1">{errors.missing_diseases.message}</p>
                )}
              </div>

              <Input
                label="Номер телефону зниклого"
                type="tel"
                placeholder="+380991234567"
                error={errors.missing_phone?.message}
                {...register('missing_phone')}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Одяг
                </label>
                <textarea
                  {...register('missing_clothing')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={2}
                  placeholder="Синя куртка, чорні джинси, білі кросівки..."
                />
                {errors.missing_clothing && (
                  <p className="text-sm text-red-600 mt-1">{errors.missing_clothing.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Що було з собою
                </label>
                <textarea
                  {...register('missing_belongings')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={2}
                  placeholder="Рюкзак, телефон, документи..."
                />
                {errors.missing_belongings && (
                  <p className="text-sm text-red-600 mt-1">{errors.missing_belongings.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Additional Search Information */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold text-gray-900 mb-4">Додаткова інформація про пошук</h3>

              <Input
                label="Додаткові області пошуку (через кому)"
                placeholder="Київська область, Житомирська область"
                error={errors.additional_search_regions?.message}
                {...register('additional_search_regions')}
              />

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register('police_report_filed')}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Заява до поліції подана <span className="text-red-500">*</span>
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  Без заяви до поліції пошук не може бути розпочатий
                </p>
                {errors.police_report_filed && (
                  <p className="text-sm text-red-600 mt-1">{errors.police_report_filed.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Тип місцевості пошуку
                </label>
                <select
                  {...register('search_terrain_type')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Не вказано</option>
                  <option value="Місто">Місто</option>
                  <option value="Ліс">Ліс</option>
                  <option value="Поле">Поле</option>
                  <option value="Вода">Вода</option>
                  <option value="Інше">Інше</option>
                </select>
                {errors.search_terrain_type && (
                  <p className="text-sm text-red-600 mt-1">{errors.search_terrain_type.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Первинна інформація
                </label>
                <textarea
                  {...register('initial_info')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={6}
                  placeholder="Введіть всю відому інформацію про зниклого та обставини зникнення. Пізніше ці дані можна буде розподілити по відповідних полях..."
                />
                {errors.initial_info && (
                  <p className="text-sm text-red-600 mt-1">{errors.initial_info.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Обставини зникнення
                </label>
                <textarea
                  {...register('disappearance_circumstances')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  placeholder="Опишіть обставини за яких людина зникла..."
                />
                {errors.disappearance_circumstances && (
                  <p className="text-sm text-red-600 mt-1">{errors.disappearance_circumstances.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Додаткова інформація
                </label>
                <textarea
                  {...register('additional_info')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  placeholder="Будь-яка інша важлива інформація..."
                />
                {errors.additional_info && (
                  <p className="text-sm text-red-600 mt-1">{errors.additional_info.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Case Metadata */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold text-gray-900 mb-4">Статус</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Рішення по заявці
                </label>
                <select
                  {...register('decision_type')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="На розгляді">На розгляді</option>
                  <option value="Пошук">Пошук</option>
                  <option value="Відмова">Відмова</option>
                </select>
                {errors.decision_type && (
                  <p className="text-sm text-red-600 mt-1">{errors.decision_type.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Коментар до рішення
                </label>
                <textarea
                  {...register('decision_comment')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={2}
                  placeholder="Додатковий коментар щодо рішення..."
                />
                {errors.decision_comment && (
                  <p className="text-sm text-red-600 mt-1">{errors.decision_comment.message}</p>
                )}
              </div>

              <Input
                label="Теги (через кому)"
                placeholder="дитина, літня людина, деменція"
                error={errors.tags?.message}
                {...register('tags')}
              />
              <p className="text-xs text-gray-500 -mt-2">
                Введіть теги через кому для полегшення пошуку (наприклад: дитина, пожилий, деменція)
              </p>
            </CardContent>
          </Card>

          {apiError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{apiError}</p>
            </div>
          )}

          <Button
            type="submit"
            fullWidth
            loading={updateMutation.isPending}
          >
            Зберегти зміни
          </Button>
        </form>
      </Container>
    </div>
  );
}
