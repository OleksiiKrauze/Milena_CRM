import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardContent, Button, Loading } from '@/components/ui';
import { asteriskApi } from '@/api/asterisk';
import { Bot, Save, RotateCcw } from 'lucide-react';

const DEFAULT_HINT = `Підказка: промпт повинен містити:
- Роль бота та його завдання
- Правила ведення діалогу
- Список питань у потрібному порядку
- Фразу привітання на початку`;

export function VoiceBotSettingsPage() {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['asterisk-settings'],
    queryFn: () => asteriskApi.getSettings(),
  });

  useEffect(() => {
    if (data) {
      setPrompt(data.voice_bot_prompt || '');
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (newPrompt: string) =>
      asteriskApi.updateSettings({ voice_bot_prompt: newPrompt || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asterisk-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const handleReset = () => {
    setPrompt('');
  };

  if (isLoading) return (
    <div className="min-h-screen pb-nav">
      <Header title="Налаштування бота" showBack />
      <Container className="py-6"><Loading /></Container>
    </div>
  );

  return (
    <div className="min-h-screen pb-nav">
      <Header title="Бот збору інформації" showBack />

      <Container className="py-4 space-y-4">

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="h-5 w-5 text-violet-600" />
              <h2 className="font-semibold text-gray-900">Системний промпт</h2>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              Визначає поведінку голосового бота: як він вітається, які питання задає і в якому порядку.
              Якщо поле порожнє — використовується промпт за замовчуванням.
            </p>

            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={20}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-mono"
              placeholder={DEFAULT_HINT}
            />

            <div className="flex items-center gap-2 mt-3">
              <Button
                onClick={() => mutation.mutate(prompt)}
                disabled={mutation.isPending}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {mutation.isPending ? 'Збереження...' : saved ? '✓ Збережено' : 'Зберегти'}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                className="flex items-center gap-2 text-gray-600"
                title="Очистити (використовуватиметься промпт за замовчуванням)"
              >
                <RotateCcw className="h-4 w-4" />
                Скинути до замовчування
              </Button>
            </div>

            {mutation.isError && (
              <p className="text-sm text-red-600 mt-2">Помилка збереження</p>
            )}
          </CardContent>
        </Card>

      </Container>
    </div>
  );
}
