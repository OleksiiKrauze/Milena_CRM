import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { fieldSearchesApi } from '@/api/field-searches';
import { usersApi } from '@/api/users';
import { uploadApi } from '@/api/upload';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Input, Button, Loading } from '@/components/ui';
import type { FieldSearchUpdate } from '@/api/field-searches';
import { useState, useEffect } from 'react';
import { X, Upload, FileText, Image as ImageIcon } from 'lucide-react';
import { getOriginalFilename } from '@/utils/formatters';
import { GridMapSelector } from '@/components/GridMapSelector';

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

  // File upload states
  const [preparationGridFile, setPreparationGridFile] = useState<string | null>(null);
  const [preparationMapImage, setPreparationMapImage] = useState<string | null>(null);
  const [searchTracks, setSearchTracks] = useState<string[]>([]);
  const [searchPhotos, setSearchPhotos] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Grid parameters
  const [gridCenterLat, setGridCenterLat] = useState<number | null>(null);
  const [gridCenterLon, setGridCenterLon] = useState<number | null>(null);
  const [gridCols, setGridCols] = useState<number | null>(null);
  const [gridRows, setGridRows] = useState<number | null>(null);
  const [gridCellSize, setGridCellSize] = useState<number | null>(null);
  const [isGeneratingGrid, setIsGeneratingGrid] = useState(false);
  const [generatedGridUrl, setGeneratedGridUrl] = useState<string | null>(null);

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

  // Initialize file states and grid parameters from existing data
  useEffect(() => {
    if (fieldSearchData) {
      setPreparationGridFile(fieldSearchData.preparation_grid_file);
      setPreparationMapImage(fieldSearchData.preparation_map_image);
      setSearchTracks(fieldSearchData.search_tracks || []);
      setSearchPhotos(fieldSearchData.search_photos || []);
      setGridCenterLat(fieldSearchData.grid_center_lat);
      setGridCenterLon(fieldSearchData.grid_center_lon);
      setGridCols(fieldSearchData.grid_cols);
      setGridRows(fieldSearchData.grid_rows);
      setGridCellSize(fieldSearchData.grid_cell_size);
    }
  }, [fieldSearchData]);

  // File upload handlers
  const handleGridFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const urls = await uploadApi.uploadMedia([file]);
      setPreparationGridFile(urls[0]);
    } catch (error: any) {
      setApiError(error.message || 'Помилка завантаження файлу сітки');
    } finally {
      setIsUploading(false);
    }
  };

  const handleMapImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const urls = await uploadApi.uploadImages([file]);
      setPreparationMapImage(urls[0]);
    } catch (error: any) {
      setApiError(error.message || 'Помилка завантаження карти');
    } finally {
      setIsUploading(false);
    }
  };

  const handleTracksUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const urls = await uploadApi.uploadMedia(files);
      setSearchTracks([...searchTracks, ...urls]);
    } catch (error: any) {
      setApiError(error.message || 'Помилка завантаження треків');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const urls = await uploadApi.uploadImages(files);
      setSearchPhotos([...searchPhotos, ...urls]);
    } catch (error: any) {
      setApiError(error.message || 'Помилка завантаження фото');
    } finally {
      setIsUploading(false);
    }
  };

  const removeTrack = (index: number) => {
    setSearchTracks(searchTracks.filter((_, i) => i !== index));
  };

  const removePhoto = (index: number) => {
    setSearchPhotos(searchPhotos.filter((_, i) => i !== index));
  };

  const handleGenerateGrid = async () => {
    if (!id) return;
    if (!gridCenterLat || !gridCenterLon || !gridCols || !gridRows || !gridCellSize) {
      setApiError('Будь ласка, заповніть всі параметри сітки та вкажіть центр на карті');
      return;
    }

    setIsGeneratingGrid(true);
    setApiError('');

    try {
      // The API now triggers a direct download
      await fieldSearchesApi.generateGrid(Number(id));
      setGeneratedGridUrl('downloaded'); // Mark as generated for UI feedback
      // Refresh field search data to get updated preparation_grid_file
      await queryClient.invalidateQueries({ queryKey: ['field-search', id] });
    } catch (error: any) {
      setApiError(error.response?.data?.error?.message || error.message || 'Помилка генерації сітки');
    } finally {
      setIsGeneratingGrid(false);
    }
  };

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

      // Add file upload fields
      cleanedData.preparation_grid_file = preparationGridFile;
      cleanedData.preparation_map_image = preparationMapImage;
      cleanedData.search_tracks = searchTracks;
      cleanedData.search_photos = searchPhotos;

      // Add grid parameters
      cleanedData.grid_center_lat = gridCenterLat;
      cleanedData.grid_center_lon = gridCenterLon;
      cleanedData.grid_cols = gridCols;
      cleanedData.grid_rows = gridRows;
      cleanedData.grid_cell_size = gridCellSize;

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

          {/* Preparation Section */}
          <Card>
            <CardHeader>
              <CardTitle>Підготовка</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Grid Parameters */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700">Параметри сітки квадратів</h3>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Кількість квадратів по горизонталі
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={gridCols || ''}
                      onChange={(e) => setGridCols(e.target.value ? Number(e.target.value) : null)}
                      placeholder="10"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Кількість квадратів по вертикалі
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={gridRows || ''}
                      onChange={(e) => setGridRows(e.target.value ? Number(e.target.value) : null)}
                      placeholder="10"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Розмір квадрата м.
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={gridCellSize || ''}
                      onChange={(e) => setGridCellSize(e.target.value ? Number(e.target.value) : null)}
                      placeholder="100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                {/* Grid Map Selector */}
                <GridMapSelector
                  centerLat={gridCenterLat}
                  centerLon={gridCenterLon}
                  onLocationSelect={(lat, lon) => {
                    setGridCenterLat(lat);
                    setGridCenterLon(lon);
                  }}
                  cols={gridCols}
                  rows={gridRows}
                  cellSize={gridCellSize}
                />

                {/* Generate Grid Button */}
                <button
                  type="button"
                  onClick={handleGenerateGrid}
                  disabled={isGeneratingGrid || !gridCenterLat || !gridCenterLon || !gridCols || !gridRows || !gridCellSize}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isGeneratingGrid ? 'Генерація...' : 'Згенерувати GPX файл'}
                </button>

                {generatedGridUrl && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">Сітка успішно згенерована та завантажена!</p>
                  </div>
                )}
              </div>

              {/* Grid File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Файл сітки квадратів (GPX/KML)
                </label>
                {preparationGridFile ? (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <FileText className="w-5 h-5 text-gray-600" />
                    <a
                      href={preparationGridFile}
                      download={preparationGridFile.split('/').pop()}
                      className="text-sm text-primary-600 hover:underline flex-1"
                    >
                      {preparationGridFile.split('/').pop()}
                    </a>
                    <button
                      type="button"
                      onClick={() => setPreparationGridFile(null)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 hover:bg-primary-50">
                    <Upload className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-600">Завантажити файл сітки</span>
                    <input
                      type="file"
                      accept=".gpx,.kml"
                      onChange={handleGridFileUpload}
                      disabled={isUploading}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Map Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Карта (зображення)
                </label>
                {preparationMapImage ? (
                  <div className="space-y-2">
                    <img
                      src={preparationMapImage}
                      alt="Карта"
                      className="w-full max-h-64 object-contain rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => setPreparationMapImage(null)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
                    >
                      <X className="w-4 h-4" />
                      Видалити
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 hover:bg-primary-50">
                    <ImageIcon className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-600">Завантажити карту</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleMapImageUpload}
                      disabled={isUploading}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Search Progress Section */}
          <Card>
            <CardHeader>
              <CardTitle>Хід пошуку</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tracks Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Треки (GPX/KML)
                </label>
                <div className="space-y-2">
                  {searchTracks.map((track, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <FileText className="w-5 h-5 text-gray-600" />
                      <a
                        href={track}
                        download={getOriginalFilename(track)}
                        className="text-sm text-primary-600 hover:underline flex-1"
                      >
                        {getOriginalFilename(track)}
                      </a>
                      <button
                        type="button"
                        onClick={() => removeTrack(index)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 hover:bg-primary-50">
                    <Upload className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-600">Додати треки</span>
                    <input
                      type="file"
                      accept=".gpx,.kml"
                      multiple
                      onChange={handleTracksUpload}
                      disabled={isUploading}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Photos Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Фотографії
                </label>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {searchPhotos.map((photo, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={photo}
                          alt={`Фото ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 hover:bg-primary-50">
                    <ImageIcon className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-600">Додати фото</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotosUpload}
                      disabled={isUploading}
                      className="hidden"
                    />
                  </label>
                </div>
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
