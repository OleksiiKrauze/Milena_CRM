import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { casesApi } from '@/api/cases';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardContent, Loading } from '@/components/ui';
import { formatDate } from '@/utils/formatters';
import { Search } from 'lucide-react';

export function CasesListPage() {
  const [searchParams] = useSearchParams();
  const urlDecisionType = searchParams.get('decision_type') || '';
  const [decisionTypeFilter, setDecisionTypeFilter] = useState<string>(urlDecisionType);

  useEffect(() => {
    if (urlDecisionType) {
      setDecisionTypeFilter(urlDecisionType);
    }
  }, [urlDecisionType]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['cases', decisionTypeFilter],
    queryFn: () => casesApi.list(decisionTypeFilter ? { decision_type_filter: decisionTypeFilter } : {}),
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
                // Определяем цвет фона в зависимости от decision_type
                let bgColor = '';
                if (caseItem.decision_type === 'Пошук') {
                  bgColor = 'bg-green-50';
                } else if (caseItem.decision_type === 'Відмова') {
                  bgColor = 'bg-gray-100';
                } else if (caseItem.decision_type === 'На розгляді') {
                  bgColor = 'bg-pink-50';
                }

                return (
                  <Link key={caseItem.id} to={`/cases/${caseItem.id}`}>
                    <Card className={`active:opacity-90 transition-colors ${bgColor}`}>
                      <CardContent className="p-4">
                      <div className="mb-2 flex items-baseline gap-2">
                        <span className="text-sm font-medium text-gray-500">#{caseItem.id}</span>
                        <h3 className="font-semibold text-gray-900">
                          {caseItem.missing_full_name}
                        </h3>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
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
                        {caseItem.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {caseItem.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
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
