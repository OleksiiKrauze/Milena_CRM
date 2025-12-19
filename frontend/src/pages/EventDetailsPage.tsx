import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsApi } from '@/api/events';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Button, Loading } from '@/components/ui';
import { formatDateTime } from '@/utils/formatters';

export function EventDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: eventData, isLoading, error } = useQuery({
    queryKey: ['event', id],
    queryFn: () => eventsApi.get(Number(id)),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Подія" showBack />
        <Container className="py-6">
          <Loading text="Завантаження події..." />
        </Container>
      </div>
    );
  }

  if (error || !eventData) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Подія" showBack />
        <Container className="py-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">Помилка завантаження події</p>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-nav">
      <Header title={`Подія #${eventData.id}`} showBack />

      <Container className="py-6">
        <div className="space-y-4">
          {/* Edit Button */}
          <Button
            onClick={() => navigate(`/events/${eventData.id}/edit`)}
            fullWidth
            variant="outline"
          >
            Редагувати подію
          </Button>

          {/* Main Info */}
          <Card>
            <CardHeader>
              <CardTitle>Основна інформація</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Тип події</p>
                <p className="font-medium text-lg">{eventData.event_type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Дата та час події</p>
                <p className="font-medium">{formatDateTime(eventData.event_datetime)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Опис</p>
                <p className="font-medium whitespace-pre-wrap">{eventData.description}</p>
              </div>
              {eventData.media_files && eventData.media_files.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Медіа файли ({eventData.media_files.length})</p>
                  <div className="grid grid-cols-2 gap-2">
                    {eventData.media_files.map((file, index) => {
                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
                      const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(file);
                      const isAudio = /\.(mp3|wav|ogg|m4a|aac)$/i.test(file);

                      if (isImage) {
                        return (
                          <a
                            key={index}
                            href={file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <img
                              src={file}
                              alt={`Файл ${index + 1}`}
                              className="w-full h-32 object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity"
                            />
                          </a>
                        );
                      } else if (isVideo) {
                        return (
                          <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                            <video
                              src={file}
                              controls
                              className="w-full h-32 object-cover bg-black"
                            />
                          </div>
                        );
                      } else if (isAudio) {
                        return (
                          <div key={index} className="p-2 bg-gray-50 border border-gray-200 rounded-lg">
                            <div className="text-2xl text-center mb-1">🎵</div>
                            <audio
                              src={file}
                              controls
                              className="w-full"
                            />
                          </div>
                        );
                      } else {
                        return (
                          <a
                            key={index}
                            href={file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-center"
                          >
                            <div className="text-2xl mb-1">📎</div>
                            <p className="text-xs text-gray-600 truncate">Файл {index + 1}</p>
                          </a>
                        );
                      }
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Метадані</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Створено</p>
                <p className="font-medium">{formatDateTime(eventData.created_at)}</p>
              </div>
              {eventData.created_by && (
                <div>
                  <p className="text-sm text-gray-600">Створив</p>
                  <p className="font-medium">{eventData.created_by.full_name}</p>
                </div>
              )}
              {eventData.updated_at && (
                <div>
                  <p className="text-sm text-gray-600">Останнє редагування</p>
                  <p className="font-medium">{formatDateTime(eventData.updated_at)}</p>
                </div>
              )}
              {eventData.updated_by && (
                <div>
                  <p className="text-sm text-gray-600">Відредагував</p>
                  <p className="font-medium">{eventData.updated_by.full_name}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <Button
            onClick={() => navigate(`/searches/${eventData.search_id}`)}
            fullWidth
            variant="outline"
          >
            ← Повернутися до пошуку
          </Button>
        </div>
      </Container>
    </div>
  );
}
