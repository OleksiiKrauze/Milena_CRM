import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { casesApi } from '@/api/cases';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardContent, Loading, Button } from '@/components/ui';
import { formatDate } from '@/utils/formatters';
import { Search, RefreshCw } from 'lucide-react';

export function CasesListPage() {
  const [searchParams] = useSearchParams();
  const urlDecisionType = searchParams.get('decision_type') || '';
  const [decisionTypeFilter, setDecisionTypeFilter] = useState<string>(urlDecisionType);

  useEffect(() => {
    if (urlDecisionType) {
      setDecisionTypeFilter(urlDecisionType);
    }
  }, [urlDecisionType]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['cases', decisionTypeFilter],
    queryFn: () => casesApi.list(decisionTypeFilter ? { decision_type_filter: decisionTypeFilter } : {}),
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  return (
    <div className="min-h-screen pb-nav">
      <Header title="Заявки" />

      <Container className="py-6">
        {/* Filter */}
        <div className="mb-4">
          <select
            value={decisionTypeFilter}
            onChange={(e) => setDecisionTypeFilter(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Всі рішення</option>
            <option value="На розгляді">На розгляді</option>
            <option value="Пошук">Пошук</option>
            <option value="Відмова">Відмова</option>
          </select>
        </div>

        {/* Refresh button */}
        <div className="mb-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Оновити
          </Button>
        </div>

        {isLoading && <Loading text="Завантаження заявок..." />}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">Помилка завантаження заявок</p>
          </div>
        )}

        {data && (
          <div className="space-y-3">
            {data.cases.length === 0 ? (
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Заявки не знайдено</p>
              </div>
            ) : (
              data.cases.map((caseItem) => {
                // Определяем цвет фона в зависимости от decision_type и latest_search_result
                let bgColor = '';
                let textColor = '';

                if (caseItem.decision_type === 'Відмова') {
                  bgColor = 'bg-white';
                } else if (caseItem.decision_type === 'На розгляді') {
                  bgColor = 'bg-pink-200';
                } else if (caseItem.decision_type === 'Пошук') {
                  // Если у заявки есть поиск с результатом
                  if (caseItem.latest_search_result === 'dead') {
                    bgColor = 'bg-gray-500';
                    textColor = 'text-white';
                  } else if (caseItem.latest_search_result === 'alive') {
                    bgColor = 'bg-green-300';
                  } else if (caseItem.latest_search_result === 'not_found') {
                    bgColor = 'bg-gray-300';
                  } else {
                    // Если нет результата поиска или другой результат
                    bgColor = 'bg-yellow-200';
                  }
                }

                // Получаем текст результата поиска
                const getSearchResultLabel = (result: string | null) => {
                  if (!result) return null;
                  switch (result) {
                    case 'alive': return 'Живий';
                    case 'dead': return 'Виявлено';
                    case 'location_known': return 'Місцезнаходження відомо';
                    case 'not_found': return 'Пошук припинено';
                    default: return result;
                  }
                };

                return (
                  <Link key={caseItem.id} to={`/cases/${caseItem.id}`}>
                    <Card className={`active:opacity-90 transition-colors ${bgColor}`}>
                      <CardContent className="p-4">
                      <div className="mb-2 flex items-baseline gap-2">
                        <span className={`text-sm font-medium ${textColor || 'text-gray-500'}`}>#{caseItem.id}</span>
                        <h3 className={`font-semibold ${textColor || 'text-gray-900'}`}>
                          {caseItem.missing_full_name}
                        </h3>
                      </div>
                      <div className={`space-y-1 text-sm ${textColor || 'text-gray-600'}`}>
                        <p>
                          <span className="font-medium">Заявник:</span>{' '}
                          {caseItem.applicant_full_name}
                        </p>
                        <p>
                          <span className="font-medium">Створена:</span>{' '}
                          {formatDate(caseItem.created_at)}
                        </p>
                        <p>
                          <span className="font-medium">Рішення:</span>{' '}
                          {caseItem.decision_type}
                        </p>
                        {caseItem.latest_search_result && (
                          <p>
                            <span className="font-medium">Результат пошуку:</span>{' '}
                            {getSearchResultLabel(caseItem.latest_search_result)}
                          </p>
                        )}
                        {caseItem.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {caseItem.tags.map((tag) => (
                              <span
                                key={tag}
                                className={`px-2 py-1 rounded text-xs ${textColor ? 'bg-gray-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })
            )}
          </div>
        )}

        {data && data.total > data.cases.length && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Показано {data.cases.length} з {data.total}
          </p>
        )}
      </Container>
    </div>
  );
}
