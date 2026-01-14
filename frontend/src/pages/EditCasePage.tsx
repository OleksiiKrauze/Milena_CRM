import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { casesApi } from '@/api/cases';
import { uploadApi } from '@/api/upload';
import { usersApi } from '@/api/users';
import { Header } from '@/components/layout/Header';
import { utcToLocalDateTimeInput, localDateTimeInputToUtc } from '@/utils/formatters';
import { Container, Button, Input, Card, CardContent, Loading } from '@/components/ui';
import { X, Upload, Sparkles, Plus } from 'lucide-react';
import { MissingPersonBlock } from '@/components/MissingPersonBlock';
import { TagsCheckboxGroup } from '@/components/TagsCheckboxGroup';

// Schema for a single missing person
const missingPersonSchema = z.object({
  last_name: z.string().min(2, 'Мінімум 2 символи'),
  first_name: z.string().min(2, 'Мінімум 2 символи'),
  middle_name: z.string().optional(),
  gender: z.string().optional(),
  birthdate: z.string().optional(),
  phone: z.string().optional(),
  settlement: z.string().optional(),
  region: z.string().optional(),
  address: z.string().optional(),
  last_seen_date: z.string().optional(),
  last_seen_time: z.string().optional(),
  last_seen_place: z.string().optional(),
  photos: z.array(z.string()).optional(),
  videos: z.array(z.string()).optional(),
  description: z.string().optional(),
  special_signs: z.string().optional(),
  diseases: z.string().optional(),
  clothing: z.string().optional(),
  belongings: z.string().optional(),
});

const editCaseSchema = z.object({
  // Allow editing created_at
  created_at: z.string().optional(),
  // Basis
  basis: z.string().optional(),
  // Applicant - split name fields
  applicant_last_name: z.string().min(2, 'Мінімум 2 символи'),
  applicant_first_name: z.string().min(2, 'Мінімум 2 символи'),
  applicant_middle_name: z.string().optional(),
  applicant_phone: z.string().optional(),
  applicant_relation: z.string().optional(),
  // NEW: Array of missing persons
  missing_persons: z.array(missingPersonSchema).min(1, 'Потрібен хоча б один зниклий'),
  // Additional case information
  additional_search_regions: z.string().optional(),
  search_terrain_type: z.string().optional(),
  initial_info: z.string().optional(),
  disappearance_circumstances: z.string().optional(),
  additional_info: z.string().optional(),
  // Police information
  police_report_filed: z.boolean().optional().default(false),
  police_report_date: z.string().optional(),
  police_department: z.string().optional(),
  police_contact_user_id: z.string().optional(),
  // Notes
  notes_text: z.string().optional(),
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
  const [notesImages, setNotesImages] = useState<string[]>([]);
  const [isNotesUploading, setIsNotesUploading] = useState(false);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

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
      missing_persons: [{ last_name: '', first_name: '', photos: [] }],
    },
  });
  const { register, handleSubmit, formState, reset, setValue, getValues, watch, control } = form;
  const errors = formState.errors;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'missing_persons',
  });

  // Fetch users for police contact dropdown
  const { data: users = [] } = useQuery({
    queryKey: ['users-brief'],
    queryFn: () => usersApi.listBrief(),
  });

  // Watch initial_info field for autofill button
  const initialInfo = watch('initial_info');

  // Populate form when data loads
  useEffect(() => {
    if (caseData) {
      reset({
        created_at: caseData.created_at ? utcToLocalDateTimeInput(caseData.created_at) : '',
        basis: caseData.basis || '',
        applicant_last_name: caseData.applicant_last_name,
        applicant_first_name: caseData.applicant_first_name,
        applicant_middle_name: caseData.applicant_middle_name || '',
        applicant_phone: caseData.applicant_phone || '',
        applicant_relation: caseData.applicant_relation || '',
        missing_persons: caseData.missing_persons && caseData.missing_persons.length > 0
          ? caseData.missing_persons.map((mp: any) => ({
              last_name: mp.last_name || '',
              first_name: mp.first_name || '',
              middle_name: mp.middle_name || '',
              gender: mp.gender || '',
              birthdate: mp.birthdate ? mp.birthdate.split('T')[0] : '',
              phone: mp.phone || '',
              settlement: mp.settlement || '',
              region: mp.region || '',
              address: mp.address || '',
              last_seen_date: mp.last_seen_datetime ? utcToLocalDateTimeInput(mp.last_seen_datetime).split('T')[0] : '',
              last_seen_time: mp.last_seen_datetime ? utcToLocalDateTimeInput(mp.last_seen_datetime).split('T')[1] : '',
              last_seen_place: mp.last_seen_place || '',
              photos: mp.photos || [],
              description: mp.description || '',
              special_signs: mp.special_signs || '',
              diseases: mp.diseases || '',
              clothing: mp.clothing || '',
              belongings: mp.belongings || '',
            }))
          : [{ last_name: '', first_name: '', photos: [] }],
        additional_search_regions: caseData.additional_search_regions?.join(', ') || '',
        search_terrain_type: caseData.search_terrain_type || '',
        disappearance_circumstances: caseData.disappearance_circumstances || '',
        initial_info: caseData.initial_info || '',
        additional_info: caseData.additional_info || '',
        police_report_filed: caseData.police_report_filed || false,
        police_report_date: caseData.police_report_date ? caseData.police_report_date.split('T')[0] : '',
        police_department: caseData.police_department || '',
        police_contact_user_id: caseData.police_contact_user_id ? String(caseData.police_contact_user_id) : '',
        notes_text: caseData.notes_text || '',
        decision_type: caseData.decision_type,
        decision_comment: caseData.decision_comment || '',
      });
      setNotesImages(caseData.notes_images || []);
      setSelectedTags(caseData.tags || []);
    }
  }, [caseData, reset]);


  const handleNotesImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsNotesUploading(true);
    setApiError(null);

    try {
      const filesArray = Array.from(files);
      const uploadedUrls = await uploadApi.uploadImages(filesArray);
      setNotesImages((prev) => [...prev, ...uploadedUrls]);
    } catch (error: any) {
      setApiError(error.message || 'Помилка завантаження зображень');
    } finally {
      setIsNotesUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveNotesImage = (imageUrl: string) => {
    setNotesImages((prev) => prev.filter((url) => url !== imageUrl));
  };

  const handleAutofill = async () => {
    const currentInitialInfo = getValues('initial_info');

    if (!currentInitialInfo || currentInitialInfo.trim().length === 0) {
      setApiError('Спочатку введіть первинну інформацію для автозаполнення');
      return;
    }

    setIsAutofilling(true);
    setApiError(null);

    try {
      const result = await casesApi.autofill(currentInitialInfo);
      const autofillData = result.fields;

      // Handle missing_persons array specially
      if (autofillData.missing_persons && Array.isArray(autofillData.missing_persons)) {
        // Clear existing missing persons from the form
        const currentFieldsLength = fields.length;
        for (let i = currentFieldsLength - 1; i >= 0; i--) {
          remove(i);
        }

        // Add each missing person from autofill result
        autofillData.missing_persons.forEach((mp: any) => {
          // Process date/time fields for this person
          const processedMp: any = {};

          // Copy only non-null values
          for (const [key, value] of Object.entries(mp)) {
            if (value !== null && value !== undefined) {
              processedMp[key] = value;
            }
          }

          // Handle birthdate - extract date part
          if (processedMp.birthdate) {
            processedMp.birthdate = String(processedMp.birthdate).split('T')[0];
          }

          // Handle last_seen_datetime - split into date and time
          if (processedMp.last_seen_datetime) {
            const datetime = utcToLocalDateTimeInput(String(processedMp.last_seen_datetime));
            const [date, time] = datetime.split('T');
            processedMp.last_seen_date = date;
            processedMp.last_seen_time = time;
            delete processedMp.last_seen_datetime;
          }

          // Ensure photos is an array
          if (!processedMp.photos) {
            processedMp.photos = [];
          }

          append(processedMp);
        });
      }

      // Fill all other extracted fields into the form
      Object.entries(autofillData).forEach(([key, value]) => {
        // Skip missing_persons as it's already handled
        if (key === 'missing_persons') {
          return;
        }

        // Only set value if it's not null or undefined
        if (value !== null && value !== undefined && value !== '') {
          // Handle array fields (tags, additional_search_regions)
          if (Array.isArray(value)) {
            setValue(key, value.join(', '));
          }
          // Handle date fields - extract date part for date input
          else if (key.includes('birthdate') && value) {
            setValue(key, String(value).split('T')[0]);
          }
          // Handle datetime fields - split into date and time
          else if (key.includes('last_seen_datetime') && value) {
            const datetime = utcToLocalDateTimeInput(String(value));
            const [date, time] = datetime.split('T');
            setValue(key.replace('_datetime', '_date'), date);
            setValue(key.replace('_datetime', '_time'), time);
          }
          // Handle region field - normalize by removing "область" suffix
          else if (key.includes('region') && value) {
            const normalizedRegion = String(value).replace(/\s*область$/i, '').trim();
            setValue(key, normalizedRegion);
          }
          // Handle all other fields
          else {
            setValue(key, value);
          }
        }
      });

      // Show success message
      setApiError(null);

    } catch (error: any) {
      setApiError(error.message || 'Помилка автозаполнения. Перевірте налаштування OpenAI API');
    } finally {
      setIsAutofilling(false);
    }
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

      const finalData = {
        ...cleanedData,
        notes_images: notesImages,
        tags: selectedTags,
        additional_search_regions: additional_search_regions
          ? additional_search_regions.split(',').map((r: any) => r.trim()).filter(Boolean)
          : [],
      };

      return casesApi.update(Number(id), finalData);
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

    // Process each missing person's date/time fields
    if (data.missing_persons && data.missing_persons.length > 0) {
      data.missing_persons = data.missing_persons.map((mp: any) => {
        // Clean empty strings - convert to undefined for optional fields
        const cleanedMp: any = {};
        for (const [key, value] of Object.entries(mp)) {
          if (value === '') {
            cleanedMp[key] = undefined;
          } else {
            cleanedMp[key] = value;
          }
        }

        // Combine last_seen_date and last_seen_time and convert to UTC
        if (cleanedMp.last_seen_date || cleanedMp.last_seen_time) {
          const date = cleanedMp.last_seen_date || new Date().toISOString().split('T')[0];
          const time = cleanedMp.last_seen_time || '00:00';
          const localDateTime = `${date}T${time}`;
          cleanedMp.last_seen_datetime = localDateTimeInputToUtc(localDateTime);
          delete cleanedMp.last_seen_date;
          delete cleanedMp.last_seen_time;
        }
        return cleanedMp;
      });
    }

    // Convert created_at from local to UTC if provided
    if (data.created_at) {
      data.created_at = localDateTimeInputToUtc(data.created_at);
    }

    // Convert police_contact_user_id from string to number
    if (data.police_contact_user_id) {
      data.police_contact_user_id = parseInt(data.police_contact_user_id, 10);
    }

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
          {/* Created Date */}
          <Card>
            <CardContent className="p-4">
              <Input
                type="datetime-local"
                label="Дата створення заявки"
                error={errors.created_at?.message}
                {...register('created_at')}
              />
              <p className="text-xs text-gray-500 mt-1">
                Залиште порожнім для автоматичної дати
              </p>
            </CardContent>
          </Card>

          {/* Basis */}
          <Card>
            <CardContent className="p-4">
              <Input
                label="Підстава"
                placeholder="Звернення поліції, дзвінок на гарячу лінію, соцмережі і тд"
                error={errors.basis?.message}
                {...register('basis')}
              />
            </CardContent>
          </Card>

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
                label="Ким приходиться заявник"
                placeholder="Мати, батько, друг..."
                error={errors.applicant_relation?.message}
                {...register('applicant_relation')}
              />
            </CardContent>
          </Card>

          {/* Missing Persons - Dynamic Blocks */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Дані зниклих</h2>
              <Button
                type="button"
                variant="outline"
                onClick={() => append({
                  last_name: '',
                  first_name: '',
                  photos: [],
                })}
                className="inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Додати ще одного зниклого
              </Button>
            </div>

            {fields.map((field, index) => (
              <MissingPersonBlock
                key={field.id}
                index={index}
                register={register}
                errors={errors}
                watch={watch}
                setValue={setValue}
                onRemove={() => remove(index)}
                canRemove={fields.length > 1}
              />
            ))}
          </div>

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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Первинна інформація
                  </label>
                  <Button
                    type="button"
                    onClick={handleAutofill}
                    disabled={!initialInfo || initialInfo.trim().length === 0 || isAutofilling}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {isAutofilling ? 'Обробка...' : 'Автозаповнення'}
                  </Button>
                </div>
                <textarea
                  {...register('initial_info')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={6}
                  placeholder="Введіть всю відому інформацію про зниклого та обставини зникнення. Після введення натисніть 'Автозаповнення' для розподілу даних по полях..."
                />
                {errors.initial_info && (
                  <p className="text-sm text-red-600 mt-1">{errors.initial_info.message}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  💡 Введіть будь-яку інформацію про зниклого і натисніть "Автозаповнення" - система автоматично розподілить дані по всіх полях форми
                </p>
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

          {/* Police Information */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold text-gray-900 mb-4">Поліція</h3>

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
                  Дата заяви до поліції
                </label>
                <input
                  type="date"
                  {...register('police_report_date')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.police_report_date && (
                  <p className="text-sm text-red-600 mt-1">{errors.police_report_date.message}</p>
                )}
              </div>

              <Input
                label="Райвідділок"
                placeholder="Назва райвідділку поліції"
                error={errors.police_department?.message}
                {...register('police_department')}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Зв'язок з поліцією
                </label>
                <select
                  {...register('police_contact_user_id')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Не вказано</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
                {errors.police_contact_user_id && (
                  <p className="text-sm text-red-600 mt-1">{errors.police_contact_user_id.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold text-gray-900 mb-4">Примітки</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Текст
                </label>
                <textarea
                  {...register('notes_text')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={4}
                  placeholder="Додаткові примітки..."
                />
                {errors.notes_text && (
                  <p className="text-sm text-red-600 mt-1">{errors.notes_text.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Зображення
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleNotesImageSelect}
                  disabled={isNotesUploading}
                  className="hidden"
                  id="notes-images-input"
                />
                <label
                  htmlFor="notes-images-input"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100"
                >
                  <Upload className="h-4 w-4" />
                  <span className="text-sm">
                    {isNotesUploading ? 'Завантаження...' : 'Завантажити зображення'}
                  </span>
                </label>

                {notesImages.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    {notesImages.map((imageUrl, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={imageUrl}
                          alt={`Примітка ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveNotesImage(imageUrl)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
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
                  <option value="Без пошуку - живий">Без пошуку - живий</option>
                  <option value="Без пошуку - виявлено">Без пошуку - виявлено</option>
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

              <TagsCheckboxGroup
                selectedTags={selectedTags}
                onChange={setSelectedTags}
                error={errors.tags?.message}
              />
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
