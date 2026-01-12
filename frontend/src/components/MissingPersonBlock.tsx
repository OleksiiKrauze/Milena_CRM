import { Input } from '@/components/ui';
import { Upload, X, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { uploadApi } from '@/api/upload';

interface MissingPersonBlockProps {
  index: number;
  register: any;
  errors: any;
  watch: any;
  setValue: any;
  onRemove?: () => void;
  canRemove: boolean;
}

export function MissingPersonBlock({
  index,
  register,
  errors,
  watch,
  setValue,
  onRemove,
  canRemove,
}: MissingPersonBlockProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Watch photos for this missing person
  const photos = watch(`missing_persons.${index}.photos`) || [];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const filesArray = Array.from(files);
      const uploadedUrls = await uploadApi.uploadImages(filesArray);
      const currentPhotos = photos || [];
      setValue(`missing_persons.${index}.photos`, [...currentPhotos, ...uploadedUrls]);
    } catch (error: any) {
      setUploadError(error.message || 'Помилка завантаження фото');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (photoUrl: string) => {
    const updatedPhotos = photos.filter((url: string) => url !== photoUrl);
    setValue(`missing_persons.${index}.photos`, updatedPhotos);
  };

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-6 relative">
      {/* Header with remove button */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Зниклий #{index + 1}
        </h3>
        {canRemove && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Видалити цього зниклого"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Personal Info */}
      <div className="space-y-4">
        <Input
          label="Прізвище зниклого"
          placeholder="Коваль"
          error={errors?.missing_persons?.[index]?.last_name?.message}
          {...register(`missing_persons.${index}.last_name`)}
          required
        />

        <Input
          label="Ім'я зниклого"
          placeholder="Іван"
          error={errors?.missing_persons?.[index]?.first_name?.message}
          {...register(`missing_persons.${index}.first_name`)}
          required
        />

        <Input
          label="По батькові зниклого (необов'язково)"
          placeholder="Петрович"
          error={errors?.missing_persons?.[index]?.middle_name?.message}
          {...register(`missing_persons.${index}.middle_name`)}
        />

        {/* Gender */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Стать
          </label>
          <select
            {...register(`missing_persons.${index}.gender`)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Не вказано</option>
            <option value="чоловіча">Чоловіча</option>
            <option value="жіноча">Жіноча</option>
          </select>
          {errors?.missing_persons?.[index]?.gender && (
            <p className="text-sm text-red-600 mt-1">
              {errors.missing_persons[index].gender.message}
            </p>
          )}
        </div>

        <Input
          label="Дата народження"
          type="date"
          error={errors?.missing_persons?.[index]?.birthdate?.message}
          {...register(`missing_persons.${index}.birthdate`)}
        />

        <Input
          label="Телефон зниклого (необов'язково)"
          placeholder="+380..."
          error={errors?.missing_persons?.[index]?.phone?.message}
          {...register(`missing_persons.${index}.phone`)}
        />

        {/* Photos Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Фото зниклого
          </label>

          <div className="mb-3">
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
              <Upload className="h-4 w-4" />
              <span>{isUploading ? 'Завантаження...' : 'Вибрати фото'}</span>
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

          {uploadError && (
            <p className="text-sm text-red-600 mb-2">{uploadError}</p>
          )}

          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {photos.map((photoUrl: string, photoIndex: number) => (
                <div key={photoIndex} className="relative group">
                  <img
                    src={photoUrl}
                    alt={`Фото ${photoIndex + 1}`}
                    className="w-full h-32 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(photoUrl)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Last Seen */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Дата коли бачили востаннє"
            type="date"
            error={errors?.missing_persons?.[index]?.last_seen_date?.message}
            {...register(`missing_persons.${index}.last_seen_date`)}
          />
          <Input
            label="Час коли бачили востаннє"
            type="time"
            error={errors?.missing_persons?.[index]?.last_seen_time?.message}
            {...register(`missing_persons.${index}.last_seen_time`)}
          />
        </div>

        <Input
          label="Останнє місце, де бачили"
          placeholder="м. Київ, вул. Хрещатик, буд. 1"
          error={errors?.missing_persons?.[index]?.last_seen_place?.message}
          {...register(`missing_persons.${index}.last_seen_place`)}
        />

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Опис (зріст, тілобудова, одяг тощо)
          </label>
          <textarea
            {...register(`missing_persons.${index}.description`)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows={3}
            placeholder="Зріст 175 см, худорлявої статури, була в синій куртці..."
          />
          {errors?.missing_persons?.[index]?.description && (
            <p className="text-sm text-red-600 mt-1">
              {errors.missing_persons[index].description.message}
            </p>
          )}
        </div>

        {/* Special Signs */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Особливі прикмети (шрами, татуювання, особливості)
          </label>
          <textarea
            {...register(`missing_persons.${index}.special_signs`)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows={2}
            placeholder="Татуювання на лівому плечі, шрам на правій щоці..."
          />
          {errors?.missing_persons?.[index]?.special_signs && (
            <p className="text-sm text-red-600 mt-1">
              {errors.missing_persons[index].special_signs.message}
            </p>
          )}
        </div>

        {/* Diseases */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Захворювання (якщо є)
          </label>
          <textarea
            {...register(`missing_persons.${index}.diseases`)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows={2}
            placeholder="Цукровий діабет, астма..."
          />
          {errors?.missing_persons?.[index]?.diseases && (
            <p className="text-sm text-red-600 mt-1">
              {errors.missing_persons[index].diseases.message}
            </p>
          )}
        </div>

        {/* Clothing */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Одяг
          </label>
          <textarea
            {...register(`missing_persons.${index}.clothing`)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows={2}
            placeholder="Чорна куртка, сині джинси, білі кросівки..."
          />
          {errors?.missing_persons?.[index]?.clothing && (
            <p className="text-sm text-red-600 mt-1">
              {errors.missing_persons[index].clothing.message}
            </p>
          )}
        </div>

        {/* Belongings */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Речі при собі
          </label>
          <textarea
            {...register(`missing_persons.${index}.belongings`)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows={2}
            placeholder="Рюкзак чорний, мобільний телефон iPhone..."
          />
          {errors?.missing_persons?.[index]?.belongings && (
            <p className="text-sm text-red-600 mt-1">
              {errors.missing_persons[index].belongings.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
