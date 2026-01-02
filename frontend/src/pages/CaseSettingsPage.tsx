import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardContent, Button, Loading } from '@/components/ui';
import { Save, ArrowLeft } from 'lucide-react';

export function CaseSettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
  });

  // Update prompt when settings load
  useEffect(() => {
    if (settings) {
      setPrompt(settings.case_autofill_prompt);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: settingsApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      alert('Налаштування збережено ✓');
    },
    onError: (error) => {
      console.error('Failed to save settings:', error);
      alert('Помилка збереження налаштувань');
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      case_autofill_prompt: prompt,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-nav">
        <Header title="Налаштування заявок" />
        <Container className="py-6">
          <Loading />
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-nav">
      <Header title="Налаштування заявок" showBack />

      <Container className="py-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  ChatGPT промпт для автозаповнення
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Цей промпт використовується для витягування структурованих даних з первинної інформації
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Системний промпт
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={25}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="Введіть системний промпт для ChatGPT..."
                />
                <p className="text-xs text-gray-500 mt-2">
                  Модель: gpt-4o-mini | Temperature: 0.2 | Format: JSON
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="flex-1"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? 'Збереження...' : 'Зберегти'}
                </Button>
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
