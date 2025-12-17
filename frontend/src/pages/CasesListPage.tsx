import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { casesApi } from '@/api/cases';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardContent, Badge, Loading, getStatusBadgeVariant } from '@/components/ui';
import { formatDate } from '@/utils/formatters';
import { Search } from 'lucide-react';

export function CasesListPage() {
  const [decisionTypeFilter, setDecisionTypeFilter] = useState<string>('');

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
              data.cases.map((caseItem) => (
                <Link key={caseItem.id} to={`/cases/${caseItem.id}`}>
                  <Card className="active:bg-gray-50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {caseItem.missing_full_name}
                        </h3>
                        <Badge variant={getStatusBadgeVariant(caseItem.case_status)}>
                          {caseItem.case_status}
                        </Badge>
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
              ))
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
