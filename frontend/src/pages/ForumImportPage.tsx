import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { forumImportApi } from '@/api/forumImport';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardContent, Button, Loading, Input } from '@/components/ui';
import { Play, Square, ArrowLeft, Settings as SettingsIcon, RefreshCw } from 'lucide-react';

export function ForumImportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form state
  const [forumUrl, setForumUrl] = useState('https://milena.in.ua/forum');
  const [forumUsername, setForumUsername] = useState('');
  const [forumPassword, setForumPassword] = useState('');
  const [subforumId, setSubforumId] = useState(150);
  const [maxTopics, setMaxTopics] = useState(10);
  const [apiEmail, setApiEmail] = useState('');
  const [apiPassword, setApiPassword] = useState('');

  // Get status
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['forumImportStatus'],
    queryFn: forumImportApi.getStatus,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Get settings
  const { data: settings } = useQuery({
    queryKey: ['forumImportSettings'],
    queryFn: forumImportApi.getSettings,
  });

  // Load settings into form
  useEffect(() => {
    if (settings) {
      if (settings.forum_url) setForumUrl(settings.forum_url);
      if (settings.forum_username) setForumUsername(settings.forum_username);
      if (settings.forum_password) setForumPassword(settings.forum_password);
      if (settings.forum_subforum_id) setSubforumId(settings.forum_subforum_id);
    }
  }, [settings]);

  // Start import mutation
  const startMutation = useMutation({
    mutationFn: forumImportApi.startImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forumImportStatus'] });
    },
    onError: (error: any) => {
      console.error('Failed to start import:', error);
      alert(`Помилка запуску імпорту: ${error.response?.data?.detail || error.message}`);
    },
  });

  // Stop import mutation
  const stopMutation = useMutation({
    mutationFn: forumImportApi.stopImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forumImportStatus'] });
    },
    onError: (error: any) => {
      console.error('Failed to stop import:', error);
      alert('Помилка зупинки імпорту');
    },
  });

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: forumImportApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forumImportSettings'] });
      alert('Налаштування збережено ✓');
    },
    onError: (error) => {
      console.error('Failed to save settings:', error);
      alert('Помилка збереження налаштувань');
    },
  });

  const handleStart = () => {
    if (!forumUsername || !forumPassword) {
      alert('Введіть логін та пароль форуму');
      return;
    }
    if (!apiEmail || !apiPassword) {
      alert('Введіть email та пароль для API');
      return;
    }

    startMutation.mutate({
      forum_url: forumUrl,
      forum_username: forumUsername,
      forum_password: forumPassword,
      subforum_id: subforumId,
      max_topics: maxTopics,
      api_email: apiEmail,
      api_password: apiPassword,
    });
  };

  const handleStop = () => {
    if (confirm('Зупинити імпорт?')) {
      stopMutation.mutate();
    }
  };

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate({
      forum_url: forumUrl,
      forum_username: forumUsername,
      forum_password: forumPassword,
      forum_subforum_id: subforumId,
    });
  };

  const progress = status
    ? Math.round((status.processed_topics / status.total_topics) * 100) || 0
    : 0;

  if (statusLoading) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Імпорт з форуму" />
        <Container className="py-6">
          <Loading />
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-nav">
      <Header title="Імпорт з форуму" showBack />

      <Container className="py-6 space-y-6">
        {/* Status Card */}
        {status && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Статус імпорту</h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refetchStatus()}
                  disabled={statusLoading}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Оновити
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Status indicator */}
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    status.is_running ? 'bg-green-500 animate-pulse' :
                    status.status === 'completed' ? 'bg-blue-500' :
                    status.status === 'error' ? 'bg-red-500' :
                    'bg-gray-400'
                  }`} />
                  <span className="font-medium">
                    {status.is_running ? 'Виконується' :
                     status.status === 'completed' ? 'Завершено' :
                     status.status === 'error' ? 'Помилка' :
                     'Очікування'}
                  </span>
                </div>

                {/* Progress bar */}
                {status.total_topics > 0 && (
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Прогрес</span>
                      <span>{status.processed_topics} / {status.total_topics} ({progress}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Statistics */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">{status.successful_topics}</div>
                    <div className="text-sm text-gray-600">Успішно</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-red-700">{status.failed_topics}</div>
                    <div className="text-sm text-gray-600">Помилки</div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">{status.total_topics}</div>
                    <div className="text-sm text-gray-600">Всього</div>
                  </div>
                </div>

                {/* Current operation */}
                {status.current_operation && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-blue-900 mb-1">Поточна операція:</div>
                    <div className="text-sm text-blue-700">{status.current_operation}</div>
                    {status.current_topic_title && (
                      <div className="text-xs text-blue-600 mt-1 truncate">{status.current_topic_title}</div>
                    )}
                  </div>
                )}

                {/* Last error */}
                {status.last_error && (
                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-red-900 mb-1">Остання помилка:</div>
                    <div className="text-sm text-red-700 whitespace-pre-wrap">{status.last_error}</div>
                  </div>
                )}

                {/* Timestamps */}
                {(status.started_at || status.finished_at) && (
                  <div className="text-sm text-gray-600 space-y-1">
                    {status.started_at && (
                      <div>Початок: {new Date(status.started_at).toLocaleString('uk-UA')}</div>
                    )}
                    {status.finished_at && (
                      <div>Завершення: {new Date(status.finished_at).toLocaleString('uk-UA')}</div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Settings Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Налаштування імпорту</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveSettings}
                disabled={saveSettingsMutation.isPending || status?.is_running}
              >
                <SettingsIcon className="h-4 w-4 mr-2" />
                Зберегти налаштування
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Forum settings */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL форуму
                </label>
                <Input
                  value={forumUrl}
                  onChange={(e) => setForumUrl(e.target.value)}
                  disabled={status?.is_running}
                  placeholder="https://milena.in.ua/forum"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Логін форуму
                  </label>
                  <Input
                    value={forumUsername}
                    onChange={(e) => setForumUsername(e.target.value)}
                    disabled={status?.is_running}
                    placeholder="username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Пароль форуму
                  </label>
                  <Input
                    type="password"
                    value={forumPassword}
                    onChange={(e) => setForumPassword(e.target.value)}
                    disabled={status?.is_running}
                    placeholder="password"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ID підфоруму
                  </label>
                  <Input
                    type="number"
                    value={subforumId}
                    onChange={(e) => setSubforumId(parseInt(e.target.value) || 150)}
                    disabled={status?.is_running}
                    placeholder="150"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Максимум тем
                  </label>
                  <Input
                    type="number"
                    value={maxTopics}
                    onChange={(e) => setMaxTopics(parseInt(e.target.value) || 10)}
                    disabled={status?.is_running}
                    placeholder="10"
                  />
                </div>
              </div>

              <hr className="my-4" />

              {/* API credentials */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email для API (ваш логін в CRM)
                  </label>
                  <Input
                    type="email"
                    value={apiEmail}
                    onChange={(e) => setApiEmail(e.target.value)}
                    disabled={status?.is_running}
                    placeholder="admin@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Пароль для API (ваш пароль в CRM)
                  </label>
                  <Input
                    type="password"
                    value={apiPassword}
                    onChange={(e) => setApiPassword(e.target.value)}
                    disabled={status?.is_running}
                    placeholder="password"
                  />
                </div>
              </div>

              {/* Control buttons */}
              <div className="flex gap-3 pt-4">
                {!status?.is_running ? (
                  <Button
                    onClick={handleStart}
                    disabled={startMutation.isPending}
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {startMutation.isPending ? 'Запуск...' : 'Запустити імпорт'}
                  </Button>
                ) : (
                  <Button
                    onClick={handleStop}
                    disabled={stopMutation.isPending}
                    variant="outline"
                    className="flex-1 text-red-600 border-red-600 hover:bg-red-50"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    {stopMutation.isPending ? 'Зупинка...' : 'Зупинити'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => navigate('/settings')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Назад
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </Container>
    </div>
  );
}
