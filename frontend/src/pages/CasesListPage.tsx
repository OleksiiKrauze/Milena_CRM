import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { casesApi } from '@/api/cases';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardContent, Loading, Button } from '@/components/ui';
import { formatDate } from '@/utils/formatters';
import { Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

export function CasesListPage() {
  const [searchParams] = useSearchParams();
  const urlDecisionType = searchParams.get('decision_type') || '';

  // Filters state
  const [decisionTypeFilter, setDecisionTypeFilter] = useState<string>(urlDecisionType);
  const [searchStatusFilter, setSearchStatusFilter] = useState<string>('');
  const [searchResultFilter, setSearchResultFilter] = useState<string>('');
  const [period, setPeriod] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination state
  const [page, setPage] = useState(0);
  const limit = 50;

  useEffect(() => {
    if (urlDecisionType) {
      setDecisionTypeFilter(urlDecisionType);
    }
  }, [urlDecisionType]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['cases', decisionTypeFilter, searchStatusFilter, searchResultFilter, period, dateFrom, dateTo, searchQuery, page],
    queryFn: () => {
      const params: any = { skip: page * limit, limit };
      if (decisionTypeFilter) params.decision_type_filter = decisionTypeFilter;
      if (searchStatusFilter) params.search_status_filter = searchStatusFilter;
      if (searchResultFilter) params.search_result_filter = searchResultFilter;
      if (period && period !== 'all') params.period = period;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (searchQuery) params.search_query = searchQuery;
      return casesApi.list(params);
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0);
  }, [decisionTypeFilter, searchStatusFilter, searchResultFilter, period, dateFrom, dateTo, searchQuery]);

  const totalPages = data ? Math.ceil(data.total / limit) : 0;
  const hasNextPage = page < totalPages - 1;
  const hasPrevPage = page > 0;

  const clearFilters = () => {
    setDecisionTypeFilter('');
    setSearchStatusFilter('');
    setSearchResultFilter('');
    setPeriod('all');
    setDateFrom('');
    setDateTo('');
    setSearchQuery('');
  };

  const hasActiveFilters = decisionTypeFilter || searchStatusFilter || searchResultFilter || period !== 'all' || dateFrom || dateTo || searchQuery;

  return (
    <div className="min-h-screen pb-nav">
      <Header title="Заявки" />

      <Container className="py-6">
        {/* Filters Card */}
        <Card className="mb-4">
          <CardContent className="p-4 space-y-3">
            {/* Search Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Пошук по заявці
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ПІБ, телефон, текст з первинної інформації..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Period Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Період
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setPeriod('10d')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    period === '10d'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  10 днів
                </button>
                <button
                  onClick={() => setPeriod('30d')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    period === '30d'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  30 днів
                </button>
                <button
                  onClick={() => setPeriod('all')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    period === 'all'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Всі
                </button>
              </div>
            </div>

            {/* Date Range Filter */}
            {period === 'all' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Від дати
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    До дати
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            )}

            {/* Decision Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Рішення
              </label>
              <select
                value={decisionTypeFilter}
                onChange={(e) => setDecisionTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Всі рішення</option>
                <option value="На розгляді">На розгляді</option>
                <option value="Пошук">Пошук</option>
                <option value="Без пошуку - живий">Без пошуку - живий</option>
                <option value="Без пошуку - виявлено">Без пошуку - виявлено</option>
                <option value="Відмова">Відмова</option>
              </select>
            </div>

            {/* Search Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Статус пошуку
              </label>
              <select
                value={searchStatusFilter}
                onChange={(e) => setSearchStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Всі статуси</option>
                <option value="planned">Запланований</option>
                <option value="active">Активний</option>
                <option value="completed">Завершений</option>
                <option value="cancelled">Скасований</option>
              </select>
            </div>

            {/* Search Result Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Результат пошуку
              </label>
              <select
                value={searchResultFilter}
                onChange={(e) => setSearchResultFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Всі результати</option>
                <option value="alive">Живий</option>
                <option value="dead">Виявлено</option>
                <option value="location_known">Місцезнаходження відомо</option>
                <option value="not_found">Пошук припинено</option>
                <option value="person_identified">Особу встановлено</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <Button
                variant="outline"
                fullWidth
                onClick={clearFilters}
              >
                Скинути фільтри
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Results Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {data && (
              <>
                Показано {page * limit + 1}-{Math.min((page + 1) * limit, data.total)} з {data.total}
              </>
            )}
          </div>
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
                } else if (caseItem.decision_type === 'Без пошуку - живий') {
                  bgColor = 'bg-green-300';
                } else if (caseItem.decision_type === 'Без пошуку - виявлено') {
                  bgColor = 'bg-gray-500';
                  textColor = 'text-white';
                } else if (caseItem.decision_type === 'Пошук') {
                  // Если у заявки есть поиск с результатом
                  if (caseItem.latest_search_result === 'dead' || caseItem.latest_search_result === 'person_identified') {
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
                    case 'person_identified': return 'Особу встановлено';
                    default: return result;
                  }
                };

                // Get all missing persons names
                const missingPersonsNames = caseItem.missing_persons && caseItem.missing_persons.length > 0
                  ? caseItem.missing_persons
                      .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
                      .map((mp: any) =>
                        [mp.last_name, mp.first_name, mp.middle_name]
                          .filter(Boolean)
                          .join(' ')
                      )
                  : [caseItem.missing_full_name];

                return (
                  <Link key={caseItem.id} to={`/cases/${caseItem.id}`}>
                    <Card className={`active:opacity-90 transition-colors ${bgColor}`}>
                      <CardContent className="p-4">
                      <div className="mb-2 flex items-baseline gap-2">
                        <span className={`text-sm font-medium ${textColor || 'text-gray-500'}`}>#{caseItem.id}</span>
                        <div className="flex-1">
                          {missingPersonsNames.map((name, idx) => (
                            <h3 key={idx} className={`font-semibold ${textColor || 'text-gray-900'}`}>
                              {missingPersonsNames.length > 1 && `${idx + 1}. `}{name}
                            </h3>
                          ))}
                        </div>
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

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setPage(page - 1)}
              disabled={!hasPrevPage || isLoading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Попередня
            </Button>

            <div className="text-sm text-gray-600">
              Сторінка {page + 1} з {totalPages}
            </div>

            <Button
              variant="outline"
              onClick={() => setPage(page + 1)}
              disabled={!hasNextPage || isLoading}
            >
              Наступна
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </Container>
    </div>
  );
}
