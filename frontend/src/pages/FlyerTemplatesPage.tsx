import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { flyerTemplatesApi } from '@/api/flyerTemplates';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Button, Loading } from '@/components/ui';
import { formatDateTime } from '@/utils/formatters';
import { Trash2, Upload, Save } from 'lucide-react';

type TemplateType = 'main' | 'additional' | 'logo';

interface TemplateSection {
  type: TemplateType;
  title: string;
  description: string;
}

const templateSections: TemplateSection[] = [
  {
    type: 'main',
    title: 'Завантажити шаблони',
    description: 'Графічні файли основних шаблонів орієнтувань',
  },
  {
    type: 'additional',
    title: 'Завантажити додаткові шаблони',
    description: 'Додаткові шаблони для орієнтувань',
  },
  {
    type: 'logo',
    title: 'Завантажити лого',
    description: 'Логотипи для використання в орієнтуваннях',
  },
];

const DEFAULT_GPT_PROMPT = `Ти — досвідчений інфорг пошуково-рятувальної організації.
Твоя задача — зі всього наданого тексту СТВОРИТИ ГОТОВЕ ОРІЄНТУВАННЯ НА ПОШУК людини.

❗ ВАЖЛИВО:
- Не вигадуй жодної інформації.
- Якщо якихось даних немає — просто пропусти відповідний пункт.
- Текст має бути лаконічний, зрозумілий, придатний для публікації в соцмережах.
- Формулювання мають відповідати стандартам пошукових орієнтувань.
- Дотримуйся наведеної структури і правил без відхилень.

ВИХІДНИЙ JSON ФОРМАТ:
Поверни відповідь СТРОГО у форматі JSON з такою структурою:
{
  "sections": [
    {
      "text": "текст розділу",
      "fontSize": розмір_шрифту_число,
      "color": "#hex_колір",
      "bold": true/false,
      "align": "center"
    }
  ]
}

СТРУКТУРА ОРІЄНТУВАННЯ:

1. УВАГА! (якщо є критична інформація):
   fontSize: 42, color: "#8B0000" (бордовий), bold: true, align: "center"

2. ПІБ зниклого:
   fontSize: 48, color: "#000000" (чорний), bold: true, align: "center"

3. Вік та загальна інформація:
   fontSize: 40, color: "#000000", bold: true, align: "center"

4. Прикмети зовнішності:
   fontSize: 36, color: "#000000", bold: true, align: "center"

5. Одяг:
   fontSize: 36, color: "#000000", bold: true, align: "center"

6. Обставини зникнення:
   fontSize: 34, color: "#000000", bold: true, align: "center"

7. Місце зникнення:
   fontSize: 34, color: "#000000", bold: true, align: "center"

8. Доповнення (критична медична інформація):
   fontSize: 40, color: "#8B0000" (бордовий), bold: true, align: "center"

9. Заклик до дії:
   fontSize: 38, color: "#000000", bold: true, align: "center"

10. Контактна інформація:
    fontSize: 36, color: "#000000", bold: true, align: "center"

11. Підпис:
    fontSize: 28, color: "#666666" (сірий), bold: false, align: "center"

Додай порожні рядки між розділами для читабельності (окремий об'єкт з text: "", fontSize: 20).

ІНСТРУКЦІЯ:
1. Проаналізуй наданий текст з інформацією про заявку
2. Сформуй орієнтування згідно структури вище
3. Поверни ТІЛЬКИ JSON без жодних пояснень
4. Кожний розділ має бути окремим об'єктом в масиві sections`;

export function FlyerTemplatesPage() {
  const queryClient = useQueryClient();
  const [uploadingType, setUploadingType] = useState<TemplateType | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<{ [key in TemplateType]?: File }>({});
  const [gptPrompt, setGptPrompt] = useState<string>('');

  // Fetch templates for all types
  const { data: mainTemplates, isLoading: mainLoading } = useQuery({
    queryKey: ['flyer-templates', 'main'],
    queryFn: () => flyerTemplatesApi.list({ template_type: 'main', is_active: 1 }),
  });

  const { data: additionalTemplates, isLoading: additionalLoading } = useQuery({
    queryKey: ['flyer-templates', 'additional'],
    queryFn: () => flyerTemplatesApi.list({ template_type: 'additional', is_active: 1 }),
  });

  const { data: logoTemplates, isLoading: logoLoading } = useQuery({
    queryKey: ['flyer-templates', 'logo'],
    queryFn: () => flyerTemplatesApi.list({ template_type: 'logo', is_active: 1 }),
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (data: { type: TemplateType; file: File }) =>
      flyerTemplatesApi.upload({
        template_type: data.type,
        file: data.file,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['flyer-templates', variables.type] });
      setSelectedFiles((prev) => {
        const updated = { ...prev };
        delete updated[variables.type];
        return updated;
      });
      setUploadingType(null);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: flyerTemplatesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flyer-templates'] });
    },
  });

  // Update GPT prompt mutation
  const updatePromptMutation = useMutation({
    mutationFn: (data: { id: number; gpt_prompt: string }) =>
      flyerTemplatesApi.update(data.id, { gpt_prompt: data.gpt_prompt }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flyer-templates', 'main'] });
    },
  });

  // Load GPT prompt from first main template
  useEffect(() => {
    if (mainTemplates?.templates && mainTemplates.templates.length > 0) {
      const firstTemplate = mainTemplates.templates[0];
      setGptPrompt(firstTemplate.gpt_prompt || DEFAULT_GPT_PROMPT);
    } else {
      setGptPrompt(DEFAULT_GPT_PROMPT);
    }
  }, [mainTemplates]);

  const handleFileSelect = (type: TemplateType, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFiles((prev) => ({ ...prev, [type]: file }));
    }
  };

  const handleUpload = async (type: TemplateType) => {
    const file = selectedFiles[type];
    if (!file) return;

    setUploadingType(type);
    await uploadMutation.mutateAsync({ type, file });
  };

  const handleDelete = async (id: number) => {
    if (confirm('Ви впевнені, що хочете видалити цей шаблон?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleSavePrompt = async () => {
    if (mainTemplates?.templates && mainTemplates.templates.length > 0) {
      const firstTemplate = mainTemplates.templates[0];
      await updatePromptMutation.mutateAsync({
        id: firstTemplate.id,
        gpt_prompt: gptPrompt,
      });
    }
  };

  const getTemplates = (type: TemplateType) => {
    switch (type) {
      case 'main':
        return mainTemplates?.templates || [];
      case 'additional':
        return additionalTemplates?.templates || [];
      case 'logo':
        return logoTemplates?.templates || [];
    }
  };

  const isLoading = (type: TemplateType) => {
    switch (type) {
      case 'main':
        return mainLoading;
      case 'additional':
        return additionalLoading;
      case 'logo':
        return logoLoading;
    }
  };

  return (
    <div className="min-h-screen pb-nav">
      <Header title="Шаблони орієнтувань" showBack />

      <Container className="py-6">
        <div className="space-y-6">
          {/* GPT Prompt Section */}
          <Card>
            <CardHeader>
              <CardTitle>Промт для ChatGPT</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Промт, який використовується для автоматичної генерації тексту орієнтування
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {mainLoading ? (
                <Loading text="Завантаження..." />
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Текст промта
                    </label>
                    <textarea
                      value={gptPrompt}
                      onChange={(e) => setGptPrompt(e.target.value)}
                      rows={20}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                      placeholder="Введіть промт для ChatGPT..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Цей промт буде використовуватись для генерації тексту орієнтування на основі даних із заявки
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSavePrompt}
                      disabled={updatePromptMutation.isPending || !mainTemplates?.templates?.length}
                      size="sm"
                    >
                      {updatePromptMutation.isPending ? (
                        <span className="flex items-center gap-2">
                          <Loading text="" />
                          Збереження...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Save className="h-4 w-4" />
                          Зберегти промт
                        </span>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setGptPrompt(DEFAULT_GPT_PROMPT)}
                      size="sm"
                    >
                      Скинути до базового
                    </Button>
                  </div>

                  {!mainTemplates?.templates?.length && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        Спочатку завантажте хоча б один основний шаблон, щоб зберегти промт
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {templateSections.map((section) => (
            <Card key={section.type}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                <p className="text-sm text-gray-600 mt-1">{section.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload form */}
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Виберіть файл
                    </label>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf,.svg"
                      onChange={(e) => handleFileSelect(section.type, e)}
                      className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-lg file:border-0
                        file:text-sm file:font-medium
                        file:bg-primary-50 file:text-primary-700
                        hover:file:bg-primary-100"
                    />
                    {selectedFiles[section.type] && (
                      <p className="text-xs text-gray-500 mt-1">
                        Обрано: {selectedFiles[section.type]?.name}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={() => handleUpload(section.type)}
                    disabled={!selectedFiles[section.type] || uploadingType === section.type}
                    size="sm"
                  >
                    {uploadingType === section.type ? (
                      <span className="flex items-center gap-2">
                        <Loading text="" />
                        Завантаження...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Завантажити
                      </span>
                    )}
                  </Button>
                </div>

                {/* List of uploaded templates */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Завантажені файли</h4>

                  {isLoading(section.type) ? (
                    <Loading text="Завантаження..." />
                  ) : getTemplates(section.type).length === 0 ? (
                    <p className="text-sm text-gray-500">Файлів не завантажено</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {getTemplates(section.type).map((template) => (
                        <div
                          key={template.id}
                          className="relative group bg-gray-50 rounded-lg border border-gray-200 overflow-hidden"
                        >
                          {/* Image preview */}
                          <div className="aspect-square bg-gray-100 flex items-center justify-center">
                            <img
                              src={`${import.meta.env.VITE_API_URL || '/api'}${template.file_path}`}
                              alt={template.file_name}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                // Fallback for non-image files
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement!.innerHTML = '<div class="text-gray-400 text-4xl">📄</div>';
                              }}
                            />
                          </div>

                          {/* File info */}
                          <div className="p-2 bg-white">
                            <p className="font-medium text-xs truncate" title={template.file_name}>
                              {template.file_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDateTime(template.created_at)}
                            </p>
                          </div>

                          {/* Delete button - shown on hover */}
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(template.id)}
                              disabled={deleteMutation.isPending}
                              className="bg-white shadow-md"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </div>
  );
}
